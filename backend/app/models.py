"""SQLAlchemy 6 张表模型(v2.0 Mapped 风格)

6 张表对应 PLAN.md 多粒度设计:
  user          → 用户配置
  goal          → 宏观目标(雅思 6.5)
  phase         → 中观阶段(基础/强化/冲刺)
  task          → 中-微观任务卡
  event         → 最细粒度行为日志(派生源)
  weekly_summary → LLM 周度总结(derived)
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """所有模型基类"""


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    # v0.4:多用户认证
    username: Mapped[Optional[str]] = mapped_column(
        String(50), unique=True, index=True, nullable=True
    )
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # v0.4:新用户激活后 exam_date 先为 null,进 onboarding 时填
    exam_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    daily_hours: Mapped[float] = mapped_column(Float, default=7.0)
    prefer_slots: Mapped[list] = mapped_column(JSON, default=list)
    weakness_rank: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    goals: Mapped[list["Goal"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="user")
    events: Mapped[list["Event"]] = relationship(back_populates="user")
    summaries: Mapped[list["WeeklySummary"]] = relationship(back_populates="user")


class Goal(Base):
    __tablename__ = "goal"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    name: Mapped[str] = mapped_column(String(100))
    target_score: Mapped[float] = mapped_column(Float)
    current_estimate: Mapped[float] = mapped_column(Float, default=0.0)
    deadline: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    user: Mapped["User"] = relationship(back_populates="goals")
    phases: Mapped[list["Phase"]] = relationship(back_populates="goal", cascade="all, delete-orphan")


class Phase(Base):
    __tablename__ = "phase"

    id: Mapped[int] = mapped_column(primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("goal.id"))
    name: Mapped[str] = mapped_column(String(50))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    focus_modules: Mapped[list] = mapped_column(JSON, default=list)
    target_tasks: Mapped[int] = mapped_column(Integer, default=0)
    plan_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("learning_plan.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    goal: Mapped["Goal"] = relationship(back_populates="phases")
    tasks: Mapped[list["Task"]] = relationship(back_populates="phase")


class Task(Base):
    __tablename__ = "task"
    __table_args__ = (
        CheckConstraint(
            "feeling IS NULL OR (feeling >= 1 AND feeling <= 5)",
            name="ck_task_feeling_range",
        ),
        CheckConstraint(
            "status IN ('pending', 'done', 'skipped', 'swapped')",
            name="ck_task_status",
        ),
        # module 不再限定雅思四模块,允许任意学科自定义(Python: algorithm, 日语: kanji 等)
        # 由前端 MODULE_LABEL 做已知翻译 fallback
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True)
    phase_id: Mapped[Optional[int]] = mapped_column(ForeignKey("phase.id"), nullable=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    seq: Mapped[int] = mapped_column(Integer)
    module: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    actual_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    feeling: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(back_populates="tasks")
    phase: Mapped[Optional["Phase"]] = relationship(back_populates="tasks")
    events: Mapped[list["Event"]] = relationship(back_populates="task")


class Event(Base):
    __tablename__ = "event"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)
    event_type: Mapped[str] = mapped_column(String(50))
    task_id: Mapped[Optional[int]] = mapped_column(ForeignKey("task.id"), nullable=True)
    detail_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    user: Mapped["User"] = relationship(back_populates="events")
    task: Mapped[Optional["Task"]] = relationship(back_populates="events")


class WeeklySummary(Base):
    __tablename__ = "weekly_summary"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True)
    week_start: Mapped[date] = mapped_column(Date)
    week_end: Mapped[date] = mapped_column(Date)
    summary_text: Mapped[str] = mapped_column(Text)
    detected_patterns: Mapped[dict] = mapped_column(JSON, default=dict)
    completion_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_feeling: Mapped[float] = mapped_column(Float, default=0.0)
    module_distribution: Mapped[dict] = mapped_column(JSON, default=dict)
    suggestions_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    user: Mapped["User"] = relationship(back_populates="summaries")


class LearningPlan(Base):
    """用户粘贴外部 AI 规划后的解析结果(v0.1 Plus)"""

    __tablename__ = "learning_plan"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True)
    subject: Mapped[str] = mapped_column(String(50), default="ielts")
    raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    source_ai: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    # LLM 从原文抽到的每日可投入小时(激活时同步到 user.daily_hours)
    daily_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # 5 个 Section 存为 JSON
    phases_data: Mapped[list] = mapped_column(JSON, default=list)
    resources: Mapped[list] = mapped_column(JSON, default=list)
    daily_habits: Mapped[list] = mapped_column(JSON, default=list)
    task_principles: Mapped[list] = mapped_column(JSON, default=list)
    checkpoints: Mapped[list] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # v0.2 S4:V3 生成的总体状态评语(150 字内)+ 时间戳;24h 缓存,手动刷新覆盖
    latest_assessment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assessment_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class InvitationCode(Base):
    """v0.4:邀请码。管理员预生成,注册时消耗(单次使用)"""

    __tablename__ = "invitation_code"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(10), default="unused")  # unused/used
    used_by_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("user.id"), nullable=True
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
