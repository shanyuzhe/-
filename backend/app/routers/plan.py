"""学习规划导入端点(v0.1 Plus)

用户流程:
  GET  /plan/template     → 给用户复制到外部 AI(Claude/ChatGPT/Kimi)的 prompt 模板
  POST /plan/import       → 粘贴 AI 回复 → DeepSeek-R1 extraction → 返回 draft
  POST /plan/{id}/activate → 用户采纳 → 激活 plan + 同步到 phase 表
  GET  /plan/active       → 前端查当前 active plan
  GET  /plan/{id}         → 查某个 plan
"""
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.llm import extract_learning_plan
from app.models import Goal, LearningPlan, Phase, User
from app.schemas import (
    PlanImportRequest,
    PlanImportResponse,
    PlanOut,
    PlanTemplateResponse,
)

router = APIRouter(prefix="/plan", tags=["plan"])

PROMPTS_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent / "prompts"
)


@router.get("/template", response_model=PlanTemplateResponse)
def get_user_template():
    """返回给用户复制到外部 AI 的 prompt 模板"""
    path = PROMPTS_DIR / "user_planning_template.md"
    if not path.exists():
        raise HTTPException(500, "模板文件缺失")
    return PlanTemplateResponse(template=path.read_text(encoding="utf-8"))


@router.post("/import", response_model=PlanImportResponse)
def import_plan(req: PlanImportRequest, db: Session = Depends(get_db)):
    """粘贴外部 AI 规划 → DeepSeek-R1 extraction → 存为 draft"""
    user = db.query(User).first()
    if not user:
        raise HTTPException(404, "未初始化用户")

    extracted = extract_learning_plan(req.raw_text)

    plan = LearningPlan(
        user_id=user.id,
        subject=extracted.subject,
        raw_text=req.raw_text,
        source_ai=req.source_ai,
        status="draft",
        phases_data=[p.model_dump() for p in extracted.phases],
        resources=[r.model_dump() for r in extracted.resources],
        daily_habits=[h.model_dump() for h in extracted.daily_habits],
        task_principles=extracted.task_principles,
        checkpoints=[c.model_dump() for c in extracted.checkpoints],
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    warnings: list[str] = []
    if not extracted.phases:
        warnings.append("未解析到阶段划分(Section A),原文可能不符合模板")
    if not extracted.resources:
        warnings.append("未解析到资源推荐(Section B)")
    if not extracted.daily_habits:
        warnings.append("未解析到每日 habit(Section C)")
    if not extracted.task_principles:
        warnings.append("未解析到任务生成原则(Section D)")
    if not extracted.checkpoints:
        warnings.append("未解析到自检机制(Section E)")

    return PlanImportResponse(
        plan_id=plan.id,
        extracted=extracted,
        warnings=warnings,
    )


@router.post("/{plan_id}/activate", response_model=PlanOut)
def activate_plan(plan_id: int, db: Session = Depends(get_db)):
    """激活 plan → 替换硬编码 phases"""
    plan = db.query(LearningPlan).filter(LearningPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "plan 不存在")

    user = db.query(User).first()
    if not user:
        raise HTTPException(404, "user 不存在")

    # 归档其他 active plans
    db.query(LearningPlan).filter(
        LearningPlan.user_id == user.id,
        LearningPlan.status == "active",
        LearningPlan.id != plan.id,
    ).update({"status": "archived"})

    plan.status = "active"
    plan.activated_at = datetime.now()

    # 替换 phases
    goal = db.query(Goal).filter(Goal.user_id == user.id).first()
    if goal and plan.phases_data:
        # 删硬编码 phases(plan_id IS NULL 的)
        db.query(Phase).filter(
            Phase.goal_id == goal.id,
            Phase.plan_id.is_(None),
        ).delete()
        # 幂等:删本 plan 旧 phases
        db.query(Phase).filter(Phase.plan_id == plan.id).delete()

        # 插入新 phases
        for pd in plan.phases_data:
            try:
                start = date.fromisoformat(pd["start_date"])
                end = date.fromisoformat(pd["end_date"])
            except (ValueError, KeyError, TypeError):
                continue  # 跳过坏日期
            db.add(
                Phase(
                    goal_id=goal.id,
                    plan_id=plan.id,
                    name=pd.get("name", "未命名阶段"),
                    start_date=start,
                    end_date=end,
                    focus_modules=pd.get("focus_modules", []),
                    target_tasks=0,
                )
            )

    db.commit()
    db.refresh(plan)
    return PlanOut.model_validate(plan)


@router.get("/active", response_model=PlanOut | None)
def get_active_plan(db: Session = Depends(get_db)):
    """当前激活的 plan(没 active 就返 null)"""
    user = db.query(User).first()
    if not user:
        return None
    plan = (
        db.query(LearningPlan)
        .filter(
            LearningPlan.user_id == user.id,
            LearningPlan.status == "active",
        )
        .order_by(LearningPlan.activated_at.desc().nullslast())
        .first()
    )
    return PlanOut.model_validate(plan) if plan else None


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(LearningPlan).filter(LearningPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "plan 不存在")
    return PlanOut.model_validate(plan)
