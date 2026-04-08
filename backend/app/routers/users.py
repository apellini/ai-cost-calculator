import secrets
import urllib.parse
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.auth.password import hash_password, verify_password
from app.config import get_settings
from app.database import get_db
from app.models.invite_token import InviteToken
from app.models.user import User
from app.schemas.auth import (
    InviteCreate, InviteResponse,
    PasswordChangeAdmin, PasswordChangeSelf,
    UserCreate, UserOut, UserUpdate,
)
from app.services.email_service import send_invite_email

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ── Static paths must come before /{user_id} ─────────────────────────────────

@router.post("/invite", response_model=InviteResponse, status_code=201)
async def invite_user(
    body: InviteCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Create a user and return a one-time invite URL (+ optional email)."""
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    generated_password: str | None = None
    if body.password:
        raw_password = body.password
    else:
        raw_password = secrets.token_urlsafe(9)  # ~12 printable chars
        generated_password = raw_password

    user = User(
        email=body.email,
        name=body.name,
        hashed_password=hash_password(raw_password),
        role=body.role,
    )
    db.add(user)
    await db.flush()

    token = secrets.token_urlsafe(32)
    invite = InviteToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(invite)
    await db.commit()
    await db.refresh(user)

    settings = get_settings()
    invite_url = (
        f"{settings.app_base_url}/login"
        f"?email={urllib.parse.quote(body.email)}"
        f"&token={token}"
    )

    send_invite_email(
        to_email=body.email,
        to_name=body.name,
        invite_url=invite_url,
        password=raw_password,
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_password=settings.smtp_password,
        smtp_from=settings.smtp_from,
        smtp_tls=settings.smtp_tls,
    )

    return InviteResponse(
        user=UserOut.model_validate(user),
        invite_url=invite_url,
        generated_password=generated_password,
    )


@router.put("/me/password", status_code=204)
async def change_own_password(
    body: PasswordChangeSelf,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Authenticated user changes their own password."""
    if not verify_password(body.current_password, current.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current.hashed_password = hash_password(body.new_password)
    await db.commit()


# ── Dynamic path /{user_id} ───────────────────────────────────────────────────

@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin),
):
    if user_id == current.id and body.role and body.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}/password", status_code=204)
async def change_user_password(
    user_id: int,
    body: PasswordChangeAdmin,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin resets any user's password without requiring the old one."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin users cannot be deleted")
    await db.delete(user)
    await db.commit()
