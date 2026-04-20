"""任务反馈端点:用户提交完成/跳过/换掉 + 感受打分"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Event, Task
from app.schemas import FeedbackRequest

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("")
def submit_feedback(req: FeedbackRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == req.task_id).first()
    if not task:
        raise HTTPException(404, f"task id={req.task_id} 不存在")

    if task.status not in ("pending",):
        # 已有状态,允许覆盖但提示
        # 用户可能想改之前的打分
        pass

    task.status = req.status
    if req.actual_minutes is not None:
        task.actual_minutes = req.actual_minutes
    if req.feeling is not None:
        task.feeling = req.feeling
    if req.note is not None:
        task.note = req.note
    task.completed_at = datetime.now()

    db.add(
        Event(
            user_id=task.user_id,
            event_type=f"task_{req.status}",
            task_id=task.id,
            detail_json={
                "actual_minutes": req.actual_minutes,
                "feeling": req.feeling,
                "module": task.module,
            },
        )
    )

    db.commit()
    db.refresh(task)
    return {
        "ok": True,
        "task_id": task.id,
        "status": task.status,
        "feeling": task.feeling,
    }
