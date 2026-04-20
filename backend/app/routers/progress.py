"""进度页端点:本周完成率 + 各模块时长占比 + 阶段推进 + 最新周度总结

v0.1-plus-dialog:module 泛化后,occupation 不再硬编码雅思四模块,
从 active plan 的 phases.focus_modules 汇总所有出现过的 module。
"""
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Goal, LearningPlan, Phase, Task, User, WeeklySummary
from app.schemas import ProgressResponse

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
