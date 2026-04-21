"""进度页端点:本周完成率 + 各模块时长占比 + 阶段推进 + 最新周度总结

v0.1-plus-dialog:module 泛化后,occupation 不再硬编码雅思四模块,
从 active plan 的 phases.focus_modules 汇总所有出现过的 module。

v0.2 S2:/progress/full 总体进度评估(plan 激活以来或最早 task 起)。
"""
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.llm import generate_status_assessment
from app.models import Goal, LearningPlan, Phase, Task, User, WeeklySummary
from app.schemas import (
    MilestonePrediction,
    ModuleHeat,
    ProgressFullResponse,
    ProgressResponse,
    WeeklyPoint,
)
from datetime import datetime as _dt

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=ProgressResponse)
def get_progress(db: Session = Depends(get_db)):
    user = db.query(User).first()
    if not user:
        raise HTTPException(404, "未初始化用户")

    today = date.today()
    goal = db.query(Goal).filter(Goal.user_id == user.id).first()
    if not goal:
        raise HTTPException(404, "无 goal")

    # 先查 active plan,为 phase 查询加防御性 plan_id 过滤
    active_plan = (
        db.query(LearningPlan)
        .filter(
            LearningPlan.user_id == user.id,
            LearningPlan.status == "active",
        )
        .order_by(LearningPlan.activated_at.desc().nullslast())
        .first()
    )

    phase_q = db.query(Phase).filter(
        Phase.goal_id == goal.id,
        Phase.start_date <= today,
        Phase.end_date >= today,
    )
    if active_plan:
        # 只查当前 active plan 的 phase,避免历史 orphan 干扰
        phase_q = phase_q.filter(Phase.plan_id == active_plan.id)
    phase = phase_q.first()

    days_to_exam = (user.exam_date - today).days

    # 阶段时间推进
    phase_progress = 0.0
    current_phase_name = "未定义"
    if phase:
        current_phase_name = phase.name
        total_days = (phase.end_date - phase.start_date).days + 1
        elapsed = (today - phase.start_date).days + 1
        phase_progress = min(max(elapsed / total_days, 0.0), 1.0)

    # 本周任务(周一为起点)
    week_start = today - timedelta(days=today.weekday())
    week_tasks = (
        db.query(Task)
        .filter(Task.user_id == user.id, Task.date >= week_start)
        .all()
    )
    done = sum(1 for t in week_tasks if t.status == "done")
    weekly_rate = (done / len(week_tasks)) if week_tasks else 0.0

    # ---- module 时长分布(动态泛化)----
    # 从 active plan 的所有 phase 拿全部 module(去重,保序)
    module_keys: list[str] = []
    seen: set[str] = set()
    if active_plan:
        for pd in active_plan.phases_data:
            for m in pd.get("focus_modules", []):
                if m and m not in seen:
                    seen.add(m)
                    module_keys.append(m)
    else:
        # 未导入 plan,默认显示硬编码 3 阶段会用到的雅思四模块
        module_keys = ["听力", "口语", "阅读", "写作"]

    # 2. 统计本周已完成任务,按 module 累计分钟
    minutes_by_module: dict[str, int] = defaultdict(int)
    done_tasks = [t for t in week_tasks if t.status == "done"]
    for t in done_tasks:
        minutes_by_module[t.module] += t.actual_minutes or t.estimated_minutes

    # 3. 合并:plan 里的 module + task 里真实出现的 module(防遗漏)
    for m in minutes_by_module.keys():
        if m not in seen:
            seen.add(m)
            module_keys.append(m)

    # 4. 计算占比,每个 key 都有值(没做过的是 0)
    total_mins = sum(minutes_by_module.values()) or 1
    module_dist: dict[str, float] = {
        m: minutes_by_module.get(m, 0) / total_mins for m in module_keys
    }

    feelings = [t.feeling for t in done_tasks if t.feeling is not None]
    avg_feeling = (sum(feelings) / len(feelings)) if feelings else 0.0

    latest = (
        db.query(WeeklySummary)
        .filter(WeeklySummary.user_id == user.id)
        .order_by(WeeklySummary.created_at.desc())
        .first()
    )

    return ProgressResponse(
        days_to_exam=days_to_exam,
        current_phase=current_phase_name,
        phase_progress=phase_progress,
        weekly_completion_rate=weekly_rate,
        module_distribution=module_dist,
        avg_feeling=avg_feeling,
        latest_summary=latest.summary_text if latest else None,
    )


def _aggregate_full(
    db: Session, user: User
) -> tuple[ProgressFullResponse, dict | None]:
    """聚合 /progress/full 响应 + 返回 LLM context(给 assessment refresh 用)。

    若无数据,返回 (empty_response, None)。
    """
    today = date.today()

    active_plan = (
        db.query(LearningPlan)
        .filter(
            LearningPlan.user_id == user.id,
            LearningPlan.status == "active",
        )
        .order_by(LearningPlan.activated_at.desc().nullslast())
        .first()
    )
    plan_activated: date | None = None
    if active_plan and active_plan.activated_at:
        plan_activated = active_plan.activated_at.date()

    earliest_task_date: date | None = (
        db.query(func.min(Task.date)).filter(Task.user_id == user.id).scalar()
    )

    # 选较早的那个作为 since
    candidates = [d for d in (plan_activated, earliest_task_date) if d is not None]
    if not candidates:
        return (
            ProgressFullResponse(
                overall_completion_rate=0.0,
                overall_avg_feeling=0.0,
            ),
            None,
        )
    since = min(candidates)
    days_covered = (today - since).days + 1

    tasks = (
        db.query(Task)
        .filter(Task.user_id == user.id, Task.date >= since, Task.date <= today)
        .all()
    )
    total = len(tasks)
    done_tasks = [t for t in tasks if t.status == "done"]
    done_count = len(done_tasks)
    overall_rate = done_count / total if total else 0.0

    feelings_all = [t.feeling for t in done_tasks if t.feeling is not None]
    overall_avg_feeling = sum(feelings_all) / len(feelings_all) if feelings_all else 0.0

    # ---- weekly_trajectory(按周分组,周一为 start)----
    weekly_buckets: dict[date, list[Task]] = defaultdict(list)
    for t in tasks:
        week_start = t.date - timedelta(days=t.date.weekday())
        weekly_buckets[week_start].append(t)

    trajectory: list[WeeklyPoint] = []
    for ws in sorted(weekly_buckets.keys()):
        wts = weekly_buckets[ws]
        wdone = [t for t in wts if t.status == "done"]
        wfeelings = [t.feeling for t in wdone if t.feeling is not None]
        trajectory.append(
            WeeklyPoint(
                week_start=ws.isoformat(),
                rate=len(wdone) / len(wts) if wts else 0.0,
                avg_feeling=sum(wfeelings) / len(wfeelings) if wfeelings else 0.0,
                tasks=len(wts),
            )
        )

    # ---- module_heatmap ----
    heat_raw: dict[str, dict] = defaultdict(
        lambda: {"total_min": 0, "done": 0, "total": 0, "feelings": []}
    )
    for t in tasks:
        h = heat_raw[t.module]
        h["total"] += 1
        if t.status == "done":
            h["done"] += 1
            h["total_min"] += t.actual_minutes or t.estimated_minutes or 0
            if t.feeling is not None:
                h["feelings"].append(t.feeling)

    heatmap: dict[str, ModuleHeat] = {}
    for m, h in heat_raw.items():
        heatmap[m] = ModuleHeat(
            total_min=h["total_min"],
            done_rate=h["done"] / h["total"] if h["total"] else 0.0,
            avg_feeling=(
                sum(h["feelings"]) / len(h["feelings"]) if h["feelings"] else 0.0
            ),
        )

    # ---- milestone_predictions(线性拟合) ----
    predictions: list[MilestonePrediction] = []
    goal = db.query(Goal).filter(Goal.user_id == user.id).first()
    if goal and active_plan:
        phases = (
            db.query(Phase)
            .filter(Phase.goal_id == goal.id, Phase.plan_id == active_plan.id)
            .order_by(Phase.start_date)
            .all()
        )
        for phase in phases:
            phase_done = (
                db.query(func.count(Task.id))
                .filter(
                    Task.phase_id == phase.id,
                    Task.status == "done",
                )
                .scalar()
            ) or 0
            phase_total_days = (phase.end_date - phase.start_date).days + 1
            # target fallback:activate_plan 目前硬编码 target_tasks=0,
            # 这里按每天 4 张估(保守,避免 on_track 永远 False)
            target = phase.target_tasks if phase.target_tasks else phase_total_days * 4

            base = MilestonePrediction(
                phase_name=phase.name,
                phase_end=phase.end_date.isoformat(),
                done_tasks=phase_done,
                target_tasks=target,
            )

            if phase.start_date > today:
                # 未开始
                predictions.append(base)
                continue
            if phase.end_date < today:
                # 已结束
                base.on_track = (phase_done >= target) if target else None
                base.confidence = 1.0
                base.completion_forecast = phase.end_date.isoformat()
                predictions.append(base)
                continue

            # 进行中:根据当前节奏外推
            elapsed = (today - phase.start_date).days + 1
            if phase_done <= 0 or target <= 0:
                # 没开工或没目标
                base.on_track = None if target else True
                predictions.append(base)
                continue

            # 前 10% 或 < 7 天,数据太少,只给不置信的 forecast(on_track 留空)
            data_ratio = elapsed / phase_total_days
            data_thin = elapsed < 7 or data_ratio < 0.1

            daily_done = phase_done / elapsed
            remain = target - phase_done
            if remain <= 0:
                base.on_track = True
                base.confidence = 0.9
                base.completion_forecast = today.isoformat()
                predictions.append(base)
                continue

            days_to_finish = remain / daily_done
            forecast = today + timedelta(days=int(round(days_to_finish)))
            base.on_track = None if data_thin else forecast <= phase.end_date
            base.confidence = round(min(0.9, 0.3 + data_ratio * 0.6), 2)
            delta = (forecast - phase.end_date).days
            forecast_label = forecast.isoformat()
            if delta < 0:
                forecast_label += f" (提前 {-delta} 天)"
            elif delta > 0:
                forecast_label += f" (延后 {delta} 天)"
            base.completion_forecast = forecast_label
            predictions.append(base)

    response = ProgressFullResponse(
        since_date=since.isoformat(),
        plan_activated_at=plan_activated.isoformat() if plan_activated else None,
        days_covered=days_covered,
        overall_completion_rate=round(overall_rate, 3),
        overall_avg_feeling=round(overall_avg_feeling, 2),
        total_tasks=total,
        weekly_trajectory=trajectory,
        module_heatmap=heatmap,
        milestone_predictions=predictions,
        status_assessment=(
            active_plan.latest_assessment if active_plan else None
        ),
        assessment_at=(
            active_plan.assessment_at.isoformat()
            if active_plan and active_plan.assessment_at
            else None
        ),
    )

    # ---- 组装给 LLM 评语用的 context ----
    current_phase = None
    if goal and active_plan:
        current_phase = (
            db.query(Phase)
            .filter(
                Phase.goal_id == goal.id,
                Phase.plan_id == active_plan.id,
                Phase.start_date <= today,
                Phase.end_date >= today,
            )
            .first()
        )

    trajectory_text = "\n".join(
        f"{p.week_start}: rate={int(p.rate*100)}%, "
        f"feel={p.avg_feeling:.1f}, tasks={p.tasks}"
        for p in trajectory
    ) or "暂无"

    heatmap_sorted = sorted(
        heatmap.items(), key=lambda kv: kv[1].total_min, reverse=True
    )
    heatmap_text = "\n".join(
        f"{m}: {h.total_min} 分钟, done {int(h.done_rate*100)}%, feel {h.avg_feeling:.1f}"
        for m, h in heatmap_sorted
        if h.total_min > 0 or h.done_rate > 0
    ) or "暂无"

    seven_ago = today - timedelta(days=7)
    recent = [t for t in tasks if seven_ago <= t.date < today]
    recent.sort(key=lambda t: (t.date, t.seq), reverse=True)
    recent_text = "\n".join(
        f"{t.date} | {t.module} | {t.title} | {t.status} | "
        f"feeling={t.feeling if t.feeling is not None else '-'} | "
        f"{t.actual_minutes or '-'}/{t.estimated_minutes}min"
        for t in recent[:30]
    ) or "暂无"

    context: dict = {
        "since_date": since.isoformat(),
        "days_covered": days_covered,
        "overall_rate_pct": int(round(overall_rate * 100)),
        "avg_feeling": round(overall_avg_feeling, 1),
        "total_tasks": total,
        "weekly_trajectory_text": trajectory_text,
        "module_heatmap_text": heatmap_text,
        "recent_tasks_text": recent_text,
        "phase_name": current_phase.name if current_phase else "(未在任何阶段)",
        "day_in_phase": (
            (today - current_phase.start_date).days + 1 if current_phase else 0
        ),
        "phase_total_days": (
            (current_phase.end_date - current_phase.start_date).days + 1
            if current_phase
            else 0
        ),
        "phase_focus": (
            ", ".join(current_phase.focus_modules) if current_phase else "(无)"
        ),
    }
    return response, context


@router.get("/full", response_model=ProgressFullResponse)
def get_progress_full(db: Session = Depends(get_db)):
    """总体进度评估:跨越整个学习周期的聚合视图(只读,零 LLM)。

    status_assessment 从 learning_plan.latest_assessment 读缓存,
    要刷新需 POST /progress/assessment/refresh。
    """
    user = db.query(User).first()
    if not user:
        raise HTTPException(404, "未初始化用户")
    response, _ctx = _aggregate_full(db, user)
    return response


@router.post("/assessment/refresh")
def refresh_assessment(db: Session = Depends(get_db)):
    """强制重新调 V3 生成总体状态评语,写入 learning_plan 并返回。

    24h 缓存由前端决定是否触发(端点本身不做时间判断,每次都重算)。
    """
    user = db.query(User).first()
    if not user:
        raise HTTPException(404, "未初始化用户")

    active_plan = (
        db.query(LearningPlan)
        .filter(
            LearningPlan.user_id == user.id,
            LearningPlan.status == "active",
        )
        .order_by(LearningPlan.activated_at.desc().nullslast())
        .first()
    )
    if not active_plan:
        raise HTTPException(400, "无 active plan,先激活规划再生成评语")

    _response, context = _aggregate_full(db, user)
    if context is None:
        raise HTTPException(400, "尚无任何任务记录,无法生成评语")

    result = generate_status_assessment(context)
    active_plan.latest_assessment = result.assessment
    active_plan.assessment_at = _dt.now()
    db.commit()
    db.refresh(active_plan)

    return {
        "assessment": active_plan.latest_assessment,
        "assessment_at": (
            active_plan.assessment_at.isoformat()
            if active_plan.assessment_at
            else None
        ),
    }
