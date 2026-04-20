"""今日任务端点:幂等生成(同日缓存)+ 可强制刷新"""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.llm import generate_today_tasks
from app.models import Event, Goal, Phase, Task, User
from app.schemas import TaskOut, TodayResponse

router = APIRouter(prefix="/today", tags=["today"])


@router.get("", response_model=TodayResponse)
def get_today(
    force_refresh: bool = Query(False, description="重新调 LLM 生成(默认当日缓存)"),
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

    # 当日已生成?
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
            # 只删 pending,已完成/跳过的历史保留
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

        # 如果是强刷,合并旧已完成的
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
    """装配喂给 LLM 的上下文"""
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
        "last_week_summary_text": "暂无",  # v0.1 先不做
        "today": today.isoformat(),
        "now_slot": now_slot,
        "today_hours": user.daily_hours,
    }
