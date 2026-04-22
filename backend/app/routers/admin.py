"""管理员端点(owner 专用)"""
import secrets
import string
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_admin_user
from app.db import get_db
from app.models import InvitationCode, User
from app.schemas import (
    InvitationCreateRequest,
    InvitationOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])

_ALPHABET = string.ascii_uppercase + string.digits


def _gen_code(prefix: str = "CCO") -> str:
    body = "".join(secrets.choice(_ALPHABET) for _ in range(9))
    return f"{prefix}-{body[:4]}-{body[4:]}"


@router.get("/invitations", response_model=list[InvitationOut])
def list_invitations(
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """全量返回邀请码(含使用人用户名)。按创建时间倒序。"""
    invs = (
        db.query(InvitationCode)
        .order_by(InvitationCode.created_at.desc())
        .all()
    )
    # 预取所有 used_by_user_id 对应的 username,避免 N+1
    user_ids = [i.used_by_user_id for i in invs if i.used_by_user_id]
    users = (
        {u.id: u.username for u in db.query(User).filter(User.id.in_(user_ids)).all()}
        if user_ids
        else {}
    )
    return [
        InvitationOut(
            code=i.code,
            status=i.status,
            note=i.note,
            used_by_username=users.get(i.used_by_user_id) if i.used_by_user_id else None,
            used_at=i.used_at,
            created_at=i.created_at,
        )
        for i in invs
    ]


@router.post("/invitations", response_model=list[InvitationOut])
def create_invitations(
    req: InvitationCreateRequest,
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """批量生成邀请码(1-20 个)"""
    created: list[InvitationCode] = []
    for _ in range(req.count):
        # 极小概率撞码,重试 5 次
        code = _gen_code()
        for _attempt in range(5):
            if not db.query(InvitationCode).filter_by(code=code).first():
                break
            code = _gen_code()
        inv = InvitationCode(
            code=code,
            status="unused",
            note=req.note,
            created_at=datetime.now(),
        )
        db.add(inv)
        created.append(inv)
    db.commit()
    for inv in created:
        db.refresh(inv)
    return [
        InvitationOut(
            code=i.code,
            status=i.status,
            note=i.note,
            used_by_username=None,
            used_at=None,
            created_at=i.created_at,
        )
        for i in created
    ]
