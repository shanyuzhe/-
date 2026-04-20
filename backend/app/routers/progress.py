"""进度页端点:本周完成率 + 四模块占比 + 阶段推进 + 最新周度总结"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Goal, Phase, Task, User, WeeklySummary
from app.schemas import ModuleDistribution, ProgressResponse

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

    phase = (
        db.query(Phase)
        .filter(
            Phase.goal_id == goal.id,
            Phase.start_date <= today,
            Phase.end_date >= today,
        )
        .first()
    )

    days_to_exam = (user.exam_date - today).days

    # 阶段推进(时间进度,不是任务完成进度)
    phase_progress = 0.0
    current_phase_name = "未定义"
    if phase:
        current_phase_name = phase.name
        total_days = (phase.end_date - phase.start_date).days + 1
        elapsed = (today - phase.start_date).days + 1
        phase_progress = min(max(elapsed / total_days, 0.0), 1.0)

    # 本周(周一为起点)
    week_start = today - timedelta(days=today.weekday())
    week_tasks = (
        db.query(Task)
        .filter(Task.user_id == user.id, Task.date >= week_start)
        .all()
    )
    done = sum(1 for t in week_tasks if t.status == "done")
    weekly_rate = (done / len(week_tasks)) if week_tasks else 0.0

    # 四模块时长占比(基于已完成任务)
    done_tasks = [t for t in week_tasks if t.status == "done"]
    dist = {"listening": 0, "speaking": 0, "reading": 0, "writing": 0}
    for t in done_tasks:
        dist[t.module] += t.actual_minutes or t.estimated_minutes
    total_mins = sum(dist.values()) or 1
    module_dist = ModuleDistribution(
        listening=dist["listening"] / total_mins,
        speaking=dist["speaking"] / total_mins,
        reading=dist["reading"] / total_mins,
        writing=dist["writing"] / total_mins,
    )

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
