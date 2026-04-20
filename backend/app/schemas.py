"""Pydantic 模型:API I/O + LLM 响应严格校验

两组独立模型:
  1. LLM 输出模型(Generated*):DeepSeek 返回 JSON 后的 pydantic 验证,防幻觉崩溃
  2. API I/O 模型(TaskOut, TodayResponse, FeedbackRequest...):给前端用的接口契约
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Module = Literal["listening", "speaking", "reading", "writing"]
TaskStatus = Literal["pending", "done", "skipped", "swapped"]


# =====================================================
# LLM 输出(严格校验,防幻觉)
# =====================================================

class GeneratedTask(BaseModel):
    """DeepSeek 产出的单条任务卡(无 id,未入库)"""

    module: Module
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=2000)
    estimated_minutes: int = Field(..., ge=10, le=120)
    rationale_brief: str = Field(
        ..., max_length=200,
        description="一句话为什么这一刻选这个任务,帮助用户理解 AI 决策"
    )


class GeneratedTasksList(BaseModel):
    """DeepSeek 生成的今日任务清单"""

    tasks: list[GeneratedTask] = Field(..., min_length=1, max_length=8)


class WeeklySummaryLLM(BaseModel):
    """周度总结 LLM 响应"""

    summary_text: str = Field(..., max_length=800)
    detected_patterns: dict = Field(default_factory=dict)
    suggestions_text: str = Field(..., max_length=500)


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


class ModuleDistribution(BaseModel):
    listening: float = 0.0
    speaking: float = 0.0
    reading: float = 0.0
    writing: float = 0.0


class ProgressResponse(BaseModel):
    """进度页响应"""

    days_to_exam: int
    current_phase: str
    phase_progress: float = Field(..., ge=0, le=1)
    weekly_completion_rate: float = Field(..., ge=0, le=1)
    module_distribution: ModuleDistribution
    avg_feeling: float = Field(..., ge=0, le=5)
    latest_summary: Optional[str] = None


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
    type: str  # listening/speaking/reading/writing/mock_exam/vocab
    material: Optional[str] = None
    target: Optional[str] = None


class ExtractedPlan(BaseModel):
    """DeepSeek-R1 从 raw_text 提取的完整结构化规划"""

    subject: str = "ielts"
    phases: list[PhaseData] = Field(default_factory=list)
    resources: list[Resource] = Field(default_factory=list)
    daily_habits: list[DailyHabit] = Field(default_factory=list)
    task_principles: list[str] = Field(default_factory=list)
    checkpoints: list[Checkpoint] = Field(default_factory=list)


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
    phases_data: list
    resources: list
    daily_habits: list
    task_principles: list
    checkpoints: list
    created_at: datetime
    activated_at: Optional[datetime] = None
