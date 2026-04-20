"""今日任务端点:幂等生成(同日缓存)+ 可强制刷新

v0.1 Plus: 若有 active LearningPlan,prompt 里会注入 plan_context
(原则 / habit / 当前阶段资源 / 近 14 天 checkpoint)。
"""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.llm import generate_today_tasks
from app.models import Event, Goal, LearningPlan, Phase, Task, User
from app.schemas import TaskOut, TodayResponse

router = APIRouter(prefix="/today", tags=["today"])


@router.get("", response_model=TodayResponse)
def get_today(
    force_refresh: bool = Query(
        False, description="重新调 LLM 生成(默认当日缓存)"
    ),
    db: Session = Depends(get_db),
):
    """获取今日任务卡。

    幂等规则:
      - 同一天首次调用 → 调 LLM 生成并存 task 表
      - 同一天后续调用 → 返回已存的任务(不再调 LLM)
      - force_refresh=True → 删除当天所有 pending 任务,重新生成
    """
    user = db.query(User).first()
    if not user:
        raise HTTPException(404, "尚未初始化用户,请先跑 scripts/seed_phases.py")

    today = date.today()
    goal = db.query(Goal).filter(Goal.user_id == user.id).first()
    if not goal:
        raise HTTPException(404, "无 goal,请跑 seed")

    phase = (
        db.query(Phase)
        .filter(
            Phase.goal_id == goal.id,
            Phase.start_date <= today,
            Phase.end_date >= today,
        )
        .first()
    )
    if not phase:
        raise HTTPException(404, f"{today} 不在任何阶段内,请检查 phase seed")

    existing = (
        db.query(Task)
        .filter(Task.user_id == user.id, Task.date == today)
        .order_by(Task.seq)
        .all()
    )

    if existing and not force_refresh:
        tasks = existing
    else:
        if force_refresh:
            db.query(Task).filter(
                Task.user_id == user.id,
                Task.date == today,
                Task.status == "pending",
            ).delete()
            db.commit()

        context = _build_today_context(db, user, goal, phase, today)
        generated = generate_today_tasks(context)

        new_tasks: list[Task] = []
        for i, gt in enumerate(generated.tasks, start=1):
            t = Task(
                user_id=user.id,
                phase_id=phase.id,
                date=today,
                seq=i,
                module=gt.module,
                title=gt.title,
                description=gt.description,
                rationale=gt.rationale_brief,
                estimated_minutes=gt.estimated_minutes,
            )
            db.add(t)
            new_tasks.append(t)

        db.add(
            Event(
                user_id=user.id,
                event_type="tasks_generated",
                detail_json={
                    "count": len(new_tasks),
                    "force_refresh": force_refresh,
                    "phase": phase.name,
                },
            )
        )
        db.commit()
        for t in new_tasks:
            db.refresh(t)

        tasks = (
            db.query(Task)
            .filter(Task.user_id == user.id, Task.date == today)
            .order_by(Task.seq)
            .all()
        )

    done_count = sum(1 for t in tasks if t.status == "done")
    completion_rate = (done_count / len(tasks)) if tasks else 0.0

    return TodayResponse(
        date=today,
        days_to_exam=(user.exam_date - today).days,
        phase_name=phase.name,
        phase_focus=phase.focus_modules,
        tasks=[TaskOut.model_validate(t) for t in tasks],
        completion_rate=completion_rate,
    )


def _build_today_context(
    db: Session, user: User, goal: Goal, phase: Phase, today: date
) -> dict:
    """装配喂给 LLM 的上下文(含 v0.1 Plus plan_context)"""
    seven_days_ago = today - timedelta(days=7)
    recent = (
        db.query(Task)
        .filter(
            Task.user_id == user.id,
            Task.date >= seven_days_ago,
            Task.date < today,
        )
        .order_by(Task.date.desc(), Task.seq)
        .all()
    )
    recent_text = (
        "\n".join(
            f"{t.date} | {t.module} | {t.title} | {t.status} | "
            f"feeling={t.feeling or '-'} | "
            f"{t.actual_minutes or '-'}/{t.estimated_minutes}min"
            for t in recent
        )
        or "暂无"
    )

    phase_total_days = (phase.end_date - phase.start_date).days + 1
    day_in_phase = (today - phase.start_date).days + 1
    phase_done_tasks = (
        db.query(func.count(Task.id))
        .filter(Task.phase_id == phase.id, Task.status == "done")
        .scalar()
    ) or 0

    hour = datetime.now().hour
    if 6 <= hour < 12:
        now_slot = "morning"
    elif 12 <= hour < 18:
        now_slot = "afternoon"
    else:
        now_slot = "evening"

    # v0.1 Plus: 读 active learning plan,装成 plan_context
    plan = (
        db.query(LearningPlan)
        .filter(
            LearningPlan.user_id == user.id,
            LearningPlan.status == "active",
        )
        .order_by(LearningPlan.activated_at.desc().nullslast())
        .first()
    )
    plan_context = (
        _format_plan_context(plan, phase, today)
        if plan
        else "(用户尚未导入自定义学习规划,按默认策略生成任务)"
    )

    return {
        "exam_date": user.exam_date.isoformat(),
        "days_left": (user.exam_date - today).days,
        "daily_hours": user.daily_hours,
        "prefer_slots": ", ".join(user.prefer_slots),
        "weakness_rank": " > ".join(user.weakness_rank),
        "target_score": goal.target_score,
        "current_estimate": goal.current_estimate,
        "phase_name": phase.name,
        "day_in_phase": day_in_phase,
        "phase_total_days": phase_total_days,
        "phase_focus": ", ".join(phase.focus_modules),
        "phase_target_tasks": phase.target_tasks,
        "phase_done_tasks": phase_done_tasks,
        "recent_tasks_text": recent_text,
        "last_week_summary_text": "暂无",
        "today": today.isoformat(),
        "now_slot": now_slot,
        "today_hours": user.daily_hours,
        "plan_context": plan_context,
    }


def _format_plan_context(
    plan: LearningPlan, phase: Phase, today: date
) -> str:
    """把 active plan 格式化成 prompt 里 <learning_plan> 段的内容"""
    parts: list[str] = []

    if plan.task_principles:
        parts.append("【任务生成必须遵守的原则】")
        for p in plan.task_principles:
            parts.append(f"- {p}")

    if plan.daily_habits:
        parts.append("")
        parts.append("【每天必须包含的 habit】")
        for h in plan.daily_habits:
            tool = h.get("tool") or ""
            amount = h.get("amount") or ""
            timing = h.get("timing") or ""
            meta = " ".join(s for s in [tool, amount, timing] if s)
            habit = h.get("habit", "")
            parts.append(f"- {habit}" + (f" ({meta})" if meta else ""))

    if plan.resources:
        matching = [r for r in plan.resources if _resource_matches_phase(r, phase)]
        if matching:
            parts.append("")
            parts.append("【当前阶段推荐资源(任务描述里优先引用这些)】")
            for r in matching[:10]:
                name = r.get("name", "")
                url = r.get("url") or ""
                rtype = r.get("type") or ""
                why = r.get("why") or ""
                url_part = f" ({url})" if url else ""
                line = f"- {name}{url_part}"
                extra = " / ".join(s for s in [rtype, why] if s)
                if extra:
                    line += f" — {extra}"
                parts.append(line)

    if plan.checkpoints:
        soon: list[tuple[date, dict]] = []
        for c in plan.checkpoints:
            raw = c.get("date") or ""
            try:
                cdate = date.fromisoformat(raw)
            except (ValueError, TypeError):
                continue
            delta = (cdate - today).days
            if 0 <= delta <= 14:
                soon.append((cdate, c))
        if soon:
            soon.sort(key=lambda x: x[0])
            parts.append("")
            parts.append("【近 14 天 checkpoint(任务里可提醒用户准备)】")
            for cdate, c in soon:
                ctype = c.get("type") or ""
                material = c.get("material") or ""
                target = c.get("target") or ""
                meta = " · ".join(s for s in [material, target] if s)
                parts.append(f"- {cdate} [{ctype}]" + (f" {meta}" if meta else ""))

    return "\n".join(parts) if parts else "(plan 已激活但各 Section 为空)"


def _resource_matches_phase(resource: dict, phase: Phase) -> bool:
    """资源是否属于当前阶段(简单启发式)"""
    rphase = (resource.get("phase") or "").strip()
    if not rphase or rphase.lower() in ("all", "任何", "全部"):
        return True
    # 名字互含即认为匹配
    return rphase in phase.name or phase.name in rphase
