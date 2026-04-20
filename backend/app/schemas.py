"""Pydantic 模型:API I/O + LLM 响应严格校验

两组独立模型:
  1. LLM 输出模型(Generated*):DeepSeek 返回 JSON 后的 pydantic 验证,防幻觉崩溃
  2. API I/O 模型(TaskOut, TodayResponse, FeedbackRequest...):给前端用的接口契约
"""
from __future__ import annotations

from datetime import date
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
