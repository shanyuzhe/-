"""认证端点:注册(需邀请码)/ 登录 / 当前用户"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db import get_db
from app.models import InvitationCode, LearningPlan, User
from app.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserInfoResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # 1. 邀请码校验
    inv = (
        db.query(InvitationCode)
        .filter(InvitationCode.code == req.invitation_code)
        .first()
    )
    if not inv:
        raise HTTPException(400, "邀请码不存在")
    if inv.status != "unused":
        raise HTTPException(400, "邀请码已被使用")

    # 2. 用户名唯一
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(400, "用户名已被占用")

    # 3. 建用户
    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        exam_date=None,
        daily_hours=7.0,
        prefer_slots=[],
        weakness_rank=[],
    )
    db.add(user)
    db.flush()  # 拿到 user.id

    # 4. 消耗邀请码
    inv.status = "used"
    inv.used_by_user_id = user.id
    inv.used_at = datetime.now()

    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        user_id=user.id,
        username=user.username,
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    # 恒定时间验证(防时序攻击):即使用户不存在也调一次 verify,走一个假 hash
    # 简化:先返回泛型错误,避免泄露用户名是否存在
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    return TokenResponse(
        access_token=create_access_token(user.id),
        user_id=user.id,
        username=user.username or "",
    )


@router.get("/me", response_model=UserInfoResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    has_plan = (
        db.query(LearningPlan)
        .filter(
            LearningPlan.user_id == user.id,
            LearningPlan.status == "active",
        )
        .first()
        is not None
    )
    return UserInfoResponse(
        id=user.id,
        username=user.username or "",
        exam_date=user.exam_date,
        daily_hours=user.daily_hours,
        has_plan=has_plan,
    )
