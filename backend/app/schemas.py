"""Pydantic 模型:API I/O + LLM 响应严格校验

两组独立模型:
  1. LLM 输出模型(Generated*):DeepSeek 返回 JSON 后的 pydantic 验证,防幻觉崩溃
  2. API I/O 模型(TaskOut, TodayResponse, FeedbackRequest...):给前端用的接口契约
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# v0.1 Plus-dialog:module 放开为任意字符串,支持雅思以外的学科
# 前端 MODULE_LABEL 作为已知翻译 fallback,未知直接显示原文
Module = str
TaskStatus = Literal["pending", "done", "skipped", "swapped"]


# =====================================================
# LLM 输出(严格校验,防幻觉)
# =====================================================

class GeneratedTask(BaseModel):
    """DeepSeek 产出的单条任务卡(无 id,未入库)"""

    module: Module
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=2000)
    estimated_minutes: int = Field(..., ge=10, le=240)
    rationale_brief: str = Field(
        ..., max_length=200,
        description="一句话为什么这一刻选这个任务,帮助用户理解 AI 决策"
    )


class GeneratedTasksList(BaseModel):
    """DeepSeek 生成的今日任务清单"""

    tasks: list[GeneratedTask] = Field(..., min_length=1, max_length=8)


# =====================================================
# v0.4:认证
# =====================================================

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_\-]+$")
    password: str = Field(..., min_length=6, max_length=128)
    invitation_code: str = Field(..., min_length=6, max_length=32)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str


class UserInfoResponse(BaseModel):
    id: int
    username: str
    exam_date: Optional[date] = None
    daily_hours: float = 7.0
    has_plan: bool = False
    is_admin: bool = False

    model_config = ConfigDict(from_attributes=True)


# =====================================================
# v0.5:邀请码管理(admin 专用)
# =====================================================

class InvitationOut(BaseModel):
    code: str
    status: str  # unused / used
    note: Optional[str] = None
    used_by_username: Optional[str] = None
    used_at: Optional[datetime] = None
    created_at: datetime


class InvitationCreateRequest(BaseModel):
    count: int = Field(..., ge=1, le=20)
    note: Optional[str] = Field(None, max_length=100)


class WeeklySummaryLLM(BaseModel):
    """周度总结 LLM 响应"""

    summary_text: str = Field(..., max_length=800)
    detected_patterns: dict = Field(default_factory=dict)
    suggestions_text: str = Field(..., max_length=500)


class StatusAssessmentLLM(BaseModel):
    """总体状态评语(纯文本,80-130 字)"""

    assessment: str = Field(..., min_length=20, max_length=500)


# =====================================================
# API I/O
# =====================================================

class TaskOut(BaseModel):
    """任务卡的响应模型(给前端)"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    seq: int
    module: Module
    title: str
    description: str
    rationale: Optional[str] = None
    estimated_minutes: int
    actual_minutes: Optional[int] = None
    status: TaskStatus
    feeling: Optional[int] = None
    note: Optional[str] = None


class TodayResponse(BaseModel):
    """今日任务清单响应"""

    date: date
    days_to_exam: int
    phase_name: str
    phase_focus: list[str]
    tasks: list[TaskOut]
    completion_rate: float = Field(..., ge=0, le=1)


class FeedbackRequest(BaseModel):
    """任务反馈请求"""

    task_id: int
    status: Literal["done", "skipped", "swapped"]
    actual_minutes: Optional[int] = Field(None, ge=1, le=300)
    feeling: Optional[int] = Field(None, ge=1, le=5)
    note: Optional[str] = Field(None, max_length=500)


class ProgressResponse(BaseModel):
    """进度页响应"""

    days_to_exam: int
    current_phase: str
    phase_progress: float = Field(..., ge=0, le=1)
    weekly_completion_rate: float = Field(..., ge=0, le=1)
    # 动态 module 分布:key 为当前 plan 的 focus_modules(中文),value 为本周时长占比
    # 没完成任务的 module 也会出现在 key 里,value=0
    module_distribution: dict[str, float] = Field(default_factory=dict)
    avg_feeling: float = Field(..., ge=0, le=5)
    latest_summary: Optional[str] = None


# =====================================================
# /progress/full 总体进度评估(v0.2 S2)
# =====================================================

class WeeklyPoint(BaseModel):
    week_start: str  # YYYY-MM-DD(周一)
    rate: float = Field(..., ge=0, le=1)
    avg_feeling: float = Field(..., ge=0, le=5)
    tasks: int


class ModuleHeat(BaseModel):
    total_min: int
    done_rate: float = Field(..., ge=0, le=1)
    avg_feeling: float = Field(..., ge=0, le=5)


class MilestonePrediction(BaseModel):
    phase_name: str
    on_track: Optional[bool] = None  # True/False/None(未开始)
    confidence: Optional[float] = None  # 0-1,None 表示不可评估
    completion_forecast: Optional[str] = None  # 人类可读的预估
    phase_end: Optional[str] = None
    done_tasks: int = 0
    target_tasks: int = 0


class ProgressFullResponse(BaseModel):
    """总体进度评估:跨越当前 plan 激活以来的所有数据"""

    since_date: Optional[str] = None  # 统计起点(plan_activated 或最早 task.date)
    plan_activated_at: Optional[str] = None
    days_covered: int = 0
    overall_completion_rate: float = Field(..., ge=0, le=1)
    overall_avg_feeling: float = Field(..., ge=0, le=5)
    total_tasks: int = 0
    weekly_trajectory: list[WeeklyPoint] = Field(default_factory=list)
    module_heatmap: dict[str, ModuleHeat] = Field(default_factory=dict)
    milestone_predictions: list[MilestonePrediction] = Field(default_factory=list)
    status_assessment: Optional[str] = None  # 从 learning_plan.latest_assessment 读
    assessment_at: Optional[str] = None  # ISO 时间戳


# =====================================================
# LearningPlan 导入(v0.1 Plus)
# =====================================================


class PhaseData(BaseModel):
    """阶段划分(Section A 单项)"""

    name: str
    start_date: str  # YYYY-MM-DD
    end_date: str
    focus_modules: list[Module] = Field(default_factory=list)
    objectives: Optional[str] = None


class Resource(BaseModel):
    """资源推荐(Section B)"""

    name: str
    url: Optional[str] = None
    type: str = "other"
    why: Optional[str] = None
    phase: Optional[str] = None


class DailyHabit(BaseModel):
    """每日 habit(Section C)"""

    habit: str
    tool: Optional[str] = None
    amount: Optional[str] = None
    timing: Optional[str] = None


class Checkpoint(BaseModel):
    """自检节点(Section E)"""

    date: str
    type: str  # 听力基础/阅读逻辑/听力单项模考/全真模考/... 自由字符串
    material: Optional[str] = None
    target: Optional[str] = None
    # v0.4 Phase D:全真模考的目标总分(如 6.5 / 7.0),小 checkpoint 可为 null
    score_target: Optional[float] = Field(None, ge=0, le=10)


class ExtractedPlan(BaseModel):
    """DeepSeek 从 raw_text 提取的完整结构化规划(泛学科)"""

    subject: str = ""  # 必须由 LLM 从原文判断,不再默认 ielts
    # 每日可投入小时数(从原文 "每日可投入 / 每日总计" 等处抽取,取区间中位数)
    # 激活 plan 时会同步到 user.daily_hours,V3 生成任务按这个时长排
    daily_hours: float | None = None
    # v0.4 Phase C:弱点排序(最弱在前),中文标签
    # 激活 plan 时同步到 user.weakness_rank,V3 规则 3 "优先修补弱点"依赖它
    weakness_rank: list[Module] = Field(default_factory=list)
    phases: list[PhaseData] = Field(default_factory=list)
    resources: list[Resource] = Field(default_factory=list)
    daily_habits: list[DailyHabit] = Field(default_factory=list)
    task_principles: list[str] = Field(default_factory=list)
    checkpoints: list[Checkpoint] = Field(default_factory=list)


class PhasePatchRequest(BaseModel):
    """编辑某个 phase(所有字段可选,只改传入的)"""

    name: Optional[str] = Field(None, max_length=50)
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None
    focus_modules: Optional[list[Module]] = None
    objectives: Optional[str] = Field(None, max_length=500)


class HabitsPatchRequest(BaseModel):
    """整组替换 daily_habits"""

    habits: list[DailyHabit]


class ResourcesPatchRequest(BaseModel):
    """整组替换 resources"""

    resources: list[Resource]


class PrinciplesPatchRequest(BaseModel):
    """整组替换 task_principles(list[str])"""

    principles: list[str] = Field(..., max_length=20)


class DailyHoursPatchRequest(BaseModel):
    """修改 plan.daily_hours;若是 active plan 同步 user.daily_hours"""

    daily_hours: float = Field(..., ge=0.5, le=24.0)


class PlanImportRequest(BaseModel):
    raw_text: str = Field(..., min_length=50, max_length=30000)
    source_ai: Optional[str] = Field(
        None, description="'claude'/'chatgpt'/'kimi'/'doubao'/..."
    )


class PlanImportResponse(BaseModel):
    plan_id: int
    extracted: ExtractedPlan
    warnings: list[str] = Field(default_factory=list)


class PlanTemplateResponse(BaseModel):
    template: str


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    status: str
    source_ai: Optional[str] = None
    daily_hours: Optional[float] = None
    weakness_rank: list[Module] = Field(default_factory=list)
    phases_data: list
    resources: list
    daily_habits: list
    task_principles: list
    checkpoints: list
    created_at: datetime
    activated_at: Optional[datetime] = None
