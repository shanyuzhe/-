"""DeepSeek 客户端封装 + LLM 两个调用点

设计原则(对应 CLAUDE.md 的 LLM 调用规则):
  - JSON 模式强制结构化输出
  - pydantic 严格校验,失败 retry ≤ 2 次
  - retry 全失败则 fallback 到 mock 模板(降级优于崩溃)
  - MOCK_LLM=true 直接返 mock,不调 API(开发期省 token)
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from openai import OpenAI
from pydantic import ValidationError

from app.config import settings
from app.schemas import GeneratedTask, GeneratedTasksList, WeeklySummaryLLM

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
) -> Any:
    """调 LLM + JSON 模式 + pydantic 校验 + retry"""
    client = get_client()
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
                temperature=0.3,  # 降低随机性,保持日常输出一致
            )
            content = resp.choices[0].message.content
            if not content:
                raise ValueError("empty LLM response")
            data = json.loads(content)
            return schema_cls.model_validate(data)
        except (json.JSONDecodeError, ValidationError, ValueError) as e:
            last_error = e
            logger.warning(
                "LLM attempt %d/%d failed: %s", attempt + 1, retries + 1, e
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
    # prompt 文件是人读结构,取 USER 模板部分作为 user prompt
    # 文件里从 "## USER 模板" 后开始是模板
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
        # 降级:返回 mock,不让调用崩溃
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
