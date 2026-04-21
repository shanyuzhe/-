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
from app.models import Goal, LearningPlan, Phase, Task, User
from app.schemas import (
    HabitsPatchRequest,
    PhasePatchRequest,
    PlanImportRequest,
    PlanImportResponse,
    PlanOut,
    PlanTemplateResponse,
    PrinciplesPatchRequest,
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
        daily_hours=extracted.daily_hours,
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

    # 同步 plan 的 daily_hours 到 user.daily_hours
    # 这样 V3 生成每日任务时会按 plan 要求的时长排任务量,不再用 seed 默认值
    if plan.daily_hours is not None:
        user.daily_hours = plan.daily_hours

    # 替换 phases
    goal = db.query(Goal).filter(Goal.user_id == user.id).first()
    if goal and plan.phases_data:
        # 删 goal 下所有 phase(硬编码 + 其他 archived plan 残留 + 自己旧的)
        # 保证 phase 表里只剩当前 active plan 的数据,不会被历史污染
        db.query(Phase).filter(Phase.goal_id == goal.id).delete()

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

    # Bug 1 修:激活新 plan 后清理当日 pending 任务
    # 否则 /today 接口幂等缓存,用户看到的仍是旧 plan 生成的任务
    db.query(Task).filter(
        Task.user_id == user.id,
        Task.date == date.today(),
        Task.status == "pending",
    ).delete()

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


# =============================================================
# v0.3 S1:Plan 在线编辑
# =============================================================

def _sync_phase_table(db: Session, plan: LearningPlan) -> None:
    """把 plan.phases_data 同步到 phase 表(仅当 plan 是 active)。

    只有 active plan 才需要 sync;archived/draft 改 JSON 就够。
    """
    if plan.status != "active":
        return
    user = db.query(User).filter(User.id == plan.user_id).first()
    if not user:
        return
    goal = db.query(Goal).filter(Goal.user_id == user.id).first()
    if not goal:
        return

    # 删掉 active plan 的所有 phase 后重建(最简,避免索引错位)
    db.query(Phase).filter(
        Phase.goal_id == goal.id, Phase.plan_id == plan.id
    ).delete()
    for pd in plan.phases_data:
        try:
            start = date.fromisoformat(pd["start_date"])
            end = date.fromisoformat(pd["end_date"])
        except (ValueError, KeyError, TypeError):
            continue
        db.add(
            Phase(
                goal_id=goal.id,
                plan_id=plan.id,
                name=pd.get("name", "未命名阶段"),
                start_date=start,
                end_date=end,
                focus_modules=pd.get("focus_modules", []),
                target_tasks=pd.get("target_tasks", 0),
            )
        )


@router.patch("/{plan_id}/phase/{index}", response_model=PlanOut)
def patch_phase(
    plan_id: int,
    index: int,
    req: PhasePatchRequest,
    db: Session = Depends(get_db),
):
    """编辑某个阶段(只改传入的字段)"""
    plan = db.query(LearningPlan).filter(LearningPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "plan 不存在")
    if index < 0 or index >= len(plan.phases_data):
        raise HTTPException(404, f"phase index {index} 超出范围")

    updated = dict(plan.phases_data[index])
    if req.name is not None:
        updated["name"] = req.name
    if req.start_date is not None:
        try:
            date.fromisoformat(req.start_date)
        except ValueError:
            raise HTTPException(422, "start_date 必须是 YYYY-MM-DD")
        updated["start_date"] = req.start_date
    if req.end_date is not None:
        try:
            date.fromisoformat(req.end_date)
        except ValueError:
            raise HTTPException(422, "end_date 必须是 YYYY-MM-DD")
        updated["end_date"] = req.end_date
    if req.focus_modules is not None:
        updated["focus_modules"] = req.focus_modules
    if req.objectives is not None:
        updated["objectives"] = req.objectives

    # 校验:start_date <= end_date
    try:
        if date.fromisoformat(updated["start_date"]) > date.fromisoformat(
            updated["end_date"]
        ):
            raise HTTPException(422, "start_date 不能晚于 end_date")
    except (ValueError, KeyError):
        raise HTTPException(422, "阶段日期格式损坏")

    # 替换 JSON(SQLAlchemy 对 JSON 要赋值整个列表才会脏标)
    new_phases = list(plan.phases_data)
    new_phases[index] = updated
    plan.phases_data = new_phases

    _sync_phase_table(db, plan)
    db.commit()
    db.refresh(plan)
    return PlanOut.model_validate(plan)


@router.patch("/{plan_id}/habits", response_model=PlanOut)
def patch_habits(
    plan_id: int,
    req: HabitsPatchRequest,
    db: Session = Depends(get_db),
):
    """整组替换 daily_habits"""
    plan = db.query(LearningPlan).filter(LearningPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "plan 不存在")
    plan.daily_habits = [h.model_dump() for h in req.habits]
    db.commit()
    db.refresh(plan)
    return PlanOut.model_validate(plan)


@router.patch("/{plan_id}/principles", response_model=PlanOut)
def patch_principles(
    plan_id: int,
    req: PrinciplesPatchRequest,
    db: Session = Depends(get_db),
):
    """整组替换 task_principles"""
    plan = db.query(LearningPlan).filter(LearningPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "plan 不存在")
    plan.task_principles = [p.strip() for p in req.principles if p.strip()]
    db.commit()
    db.refresh(plan)
    return PlanOut.model_validate(plan)
