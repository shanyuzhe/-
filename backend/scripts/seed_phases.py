"""初始化 user / goal / 3 个 phase

首次跑:先 alembic upgrade head 建表,再 python scripts/seed_phases.py
(开发期也允许直接 Base.metadata.create_all,见代码)
"""
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from datetime import date  # noqa: E402

from sqlalchemy.orm import Session  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.models import Base, Goal, Phase, User  # noqa: E402


def seed() -> None:
    # 开发期兜底:如果 alembic 没跑,直接建表
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        if db.query(User).first():
            print("[skip] 已存在 user(如需重置请删 backend/cco.db 后重跑)")
            return

        user = User(
            exam_date=date(2026, 8, 30),
            daily_hours=7.0,
            prefer_slots=["afternoon", "evening"],
            weakness_rank=["speaking", "listening", "writing", "reading"],
        )
        db.add(user)
        db.flush()

        goal = Goal(
            user_id=user.id,
            name="雅思 6.5",
            target_score=6.5,
            current_estimate=5.0,
            deadline=date(2026, 8, 30),
        )
        db.add(goal)
        db.flush()

        phases = [
            Phase(
                goal_id=goal.id,
                name="基础阶段",
                start_date=date(2026, 4, 20),
                end_date=date(2026, 5, 31),
                focus_modules=["listening", "reading"],
                target_tasks=150,
            ),
            Phase(
                goal_id=goal.id,
                name="强化阶段",
                start_date=date(2026, 6, 1),
                end_date=date(2026, 7, 20),
                focus_modules=["speaking", "writing", "listening"],
                target_tasks=200,
            ),
            Phase(
                goal_id=goal.id,
                name="冲刺阶段",
                start_date=date(2026, 7, 21),
                end_date=date(2026, 8, 30),
                focus_modules=["listening", "speaking", "reading", "writing"],
                target_tasks=160,
            ),
        ]
        for p in phases:
            db.add(p)

        db.commit()

        print("[ok] 已初始化:")
        print(f"     user: exam_date={user.exam_date}, weakness={user.weakness_rank}")
        print(f"     goal: {goal.name} -> {goal.target_score}")
        for p in phases:
            print(f"     phase: {p.name} {p.start_date}→{p.end_date} focus={p.focus_modules}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
