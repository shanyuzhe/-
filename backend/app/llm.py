"""DeepSeek 客户端封装 + 3 个 LLM 调用点

设计原则(对应 CLAUDE.md 的 LLM 调用规则):
  - JSON 模式强制结构化输出
  - pydantic 严格校验,失败 retry ≤ 2 次
  - retry 全失败则 fallback 到 mock 模板(降级优于崩溃)
  - MOCK_LLM=true 直接返 mock,不调 API(开发期省 token)

调用点:
  1. generate_today_tasks       (deepseek-chat,快,每日任务)
  2. generate_weekly_summary    (deepseek-reasoner,深,周度)
  3. extract_learning_plan      (deepseek-reasoner,解析用户粘贴的外部 AI 规划)
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from openai import OpenAI
from pydantic import ValidationError

from app.config import settings
from app.schemas import (
    Checkpoint,
    DailyHabit,
    ExtractedPlan,
    GeneratedTask,
    GeneratedTasksList,
    PhaseData,
    Resource,
    WeeklySummaryLLM,
)

logger = logging.getLogger(__name__)

_client: OpenAI | None = None

PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "prompts"


def get_client() -> OpenAI:
    """懒初始化 DeepSeek 客户端(OpenAI 兼容 SDK)"""
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
        )
    return _client


def _load_prompt(filename: str) -> str:
    return (PROMPTS_DIR / filename).read_text(encoding="utf-8")


def _call_with_retry(
    model: str,
    system: str,
    user: str,
    max_tokens: int,
    schema_cls: type,
    retries: int = 2,
    timeout: float = 60.0,
    json_mode: bool = True,
) -> Any:
    """调 LLM + pydantic 校验 + retry

    - json_mode=True:用 OpenAI 的 response_format=json_object(V3 友好)
    - json_mode=False:不强制 JSON 模式,prompt 里要求输出 JSON,
      后端用 regex 提取第一个 {...} 块。R1 专用(R1 的 JSON mode 有 empty content bug)。
    """
    client = get_client()
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        try:
            create_kwargs: dict[str, Any] = dict(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=max_tokens,
                temperature=0.3,
                timeout=timeout,
            )
            if json_mode:
                create_kwargs["response_format"] = {"type": "json_object"}
            resp = client.chat.completions.create(**create_kwargs)
            content = resp.choices[0].message.content
            if not content:
                raise ValueError("empty LLM response")

            # R1 风格:content 可能含 markdown 代码块或前后闲聊
            # 提取第一个 {...} 块,DOTALL 让 . 匹配换行
            m = re.search(r"\{.*\}", content, re.DOTALL)
            json_str = m.group(0) if m else content

            data = json.loads(json_str)
            return schema_cls.model_validate(data)
        except (json.JSONDecodeError, ValidationError, ValueError) as e:
            last_error = e
            logger.warning(
                "LLM attempt %d/%d failed: %s",
                attempt + 1,
                retries + 1,
                e,
            )
            continue

    logger.error("LLM call failed after all retries: %s", last_error)
    raise RuntimeError(f"LLM call failed: {last_error}")


# =============================================================
# 调用点 1:生成今日任务(deepseek-chat,快)
# =============================================================

def generate_today_tasks(context: dict) -> GeneratedTasksList:
    """context 必需 keys 见 prompts/generate_tasks.md 的占位符"""
    if settings.MOCK_LLM:
        return _mock_tasks(context)

    template = _load_prompt("generate_tasks.md")
    if "## USER 模板" in template:
        template = template.split("## USER 模板", 1)[1]

    system_prompt = (
        "你是用户的雅思备考认知执行官(CCO)。"
        "职责:决定今天该做什么,不教学。严格 JSON 输出,不要寒暄。"
    )
    try:
        user_prompt = template.format(**context)
    except KeyError as e:
        logger.error("Prompt context 缺字段 %s", e)
        return _mock_tasks(context)

    try:
        return _call_with_retry(
            model=settings.MODEL_FAST,
            system=system_prompt,
            user=user_prompt,
            max_tokens=2000,
            schema_cls=GeneratedTasksList,
        )
    except RuntimeError:
        logger.warning("LLM 彻底失败,降级到 mock")
        return _mock_tasks(context)


# =============================================================
# 调用点 2:周度总结(deepseek-reasoner,深)
# =============================================================

def generate_weekly_summary(context: dict) -> WeeklySummaryLLM:
    if settings.MOCK_LLM:
        return _mock_summary()

    template = _load_prompt("weekly_summary.md")
    if "## USER 模板" in template:
        template = template.split("## USER 模板", 1)[1]

    system_prompt = (
        "你是用户的雅思备考 CCO。本周结束,总结状态并给下周建议。"
        "严格 JSON 输出,基于真实数据,不编造。"
    )
    try:
        user_prompt = template.format(**context)
    except KeyError as e:
        logger.error("Weekly prompt context 缺字段 %s", e)
        return _mock_summary()

    try:
        return _call_with_retry(
            model=settings.MODEL_DEEP,
            system=system_prompt,
            user=user_prompt,
            max_tokens=1500,
            schema_cls=WeeklySummaryLLM,
        )
    except RuntimeError:
        logger.warning("Weekly LLM 失败,降级到 mock")
        return _mock_summary()


# =============================================================
# 调用点 3:解析外部 AI 规划文本(deepseek-reasoner)
# =============================================================

def extract_learning_plan(raw_text: str) -> ExtractedPlan:
    """解析用户粘贴的外部 AI 规划文本 → 结构化 ExtractedPlan"""
    if settings.MOCK_LLM:
        return _mock_extracted_plan()

    template = _load_prompt("extract_plan.md")
    if "## USER 模板" in template:
        template = template.split("## USER 模板", 1)[1]

    system_prompt = (
        "你是文本解析器。严格按 JSON schema 从用户粘贴的规划文本中提取结构化信息。"
        "只从原文提取,绝不编造。日期必须 YYYY-MM-DD。"
        "只输出一个 JSON object,不要任何其他文字。"
    )
    try:
        user_prompt = template.format(raw_text=raw_text)
    except KeyError as e:
        logger.error("Extract prompt context 缺字段 %s", e)
        return _mock_extracted_plan()

    try:
        return _call_with_retry(
            # V3(deepseek-chat):实测 90-100 秒,解析质量足够
            # R1 要 210+ 秒,边际精度差距不值得 2x 等待
            model=settings.MODEL_FAST,
            system=system_prompt,
            user=user_prompt,
            max_tokens=4000,
            schema_cls=ExtractedPlan,
            timeout=120.0,
            retries=1,
            json_mode=True,  # V3 的 JSON mode 工作正常
        )
    except RuntimeError:
        logger.warning("plan extraction 失败,降级到 mock")
        return _mock_extracted_plan()


# =============================================================
# Mock(开发期/降级兜底)
# =============================================================

def _mock_tasks(context: dict) -> GeneratedTasksList:
    return GeneratedTasksList(
        tasks=[
            GeneratedTask(
                module="listening",
                title="[MOCK] Section 3 精听训练",
                description="听力 Section 3 一套题,完成后对照答案,标记听不出的关键词。",
                estimated_minutes=45,
                rationale_brief="弱项在听,从中等难度精听起步。",
            ),
            GeneratedTask(
                module="speaking",
                title="[MOCK] Part 2 题库 2 题",
                description="随机抽 2 题,录音计时 2 分钟,回听检查连贯度。",
                estimated_minutes=30,
                rationale_brief="口语最弱,Part 2 是核心题型。",
            ),
            GeneratedTask(
                module="writing",
                title="[MOCK] Task 2 主体段 1 段",
                description="随机选题,只写一段论证段,维持语感。",
                estimated_minutes=40,
                rationale_brief="写作每天少量分散练。",
            ),
        ]
    )


def _mock_summary() -> WeeklySummaryLLM:
    return WeeklySummaryLLM(
        summary_text="[MOCK] 本周完成 70%,感受平均 3.5,节奏稳定。",
        detected_patterns={"mock": True},
        suggestions_text="[MOCK] 下周增加听力精听,控制写作单次时长。",
    )


def _mock_extracted_plan() -> ExtractedPlan:
    """降级兜底,也用于 MOCK_LLM=true 开发"""
    return ExtractedPlan(
        subject="ielts",
        phases=[
            PhaseData(
                name="[MOCK] 基础期",
                start_date="2026-04-20",
                end_date="2026-05-31",
                focus_modules=["listening", "reading"],
                objectives="打基础,适应题型",
            ),
            PhaseData(
                name="[MOCK] 强化期",
                start_date="2026-06-01",
                end_date="2026-07-20",
                focus_modules=["speaking", "writing"],
                objectives="弱项突破",
            ),
        ],
        resources=[
            Resource(
                name="[MOCK] 顾家北雅思听力",
                url="https://www.bilibili.com/video/example",
                type="video_course",
                why="基础听力系统课,适合新手入门",
                phase="基础",
            ),
            Resource(
                name="[MOCK] 墨墨背单词",
                url=None,
                type="app",
                why="每日固定量,符合遗忘曲线",
                phase="all",
            ),
        ],
        daily_habits=[
            DailyHabit(
                habit="背单词",
                tool="墨墨",
                amount="50 个",
                timing="早晨/通勤",
            ),
            DailyHabit(
                habit="精听",
                tool="剑雅 13",
                amount="30 分钟",
                timing="晚上",
            ),
        ],
        task_principles=[
            "[MOCK] 每天至少 30 分钟精听",
            "[MOCK] 不做机经,只做剑雅真题",
            "[MOCK] 周二/周四固定 Part 2 口语一题",
        ],
        checkpoints=[
            Checkpoint(
                date="2026-05-15",
                type="listening",
                material="剑 10 Test 1",
                target="正确率 ≥65%",
            ),
            Checkpoint(
                date="2026-07-15",
                type="mock_exam",
                material="剑 15 Test 1",
                target="总分 ≥5.5",
            ),
        ],
    )
