from datetime import datetime, timezone, UTC

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel as PydanticModel

from app.auth.dependencies import get_current_user
from app.auth.jwt import create_access_token
from app.auth.password import verify_password
from app.database import get_db
from app.models.invite_token import InviteToken
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    user.last_active_at = datetime.now(UTC).replace(tzinfo=None)
    await db.commit()

    token = create_access_token(user.id, user.email, user.role)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


class RedeemRequest(PydanticModel):
    token: str


class RedeemResponse(PydanticModel):
    email: str


@router.post("/redeem-invite", response_model=RedeemResponse)
async def redeem_invite(body: RedeemRequest, db: AsyncSession = Depends(get_db)):
    """
    Validate and burn a one-time invite token.
    Returns the invited user's email for pre-filling the login form.
    Raises 404 if not found/already used, 410 if expired.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    invite = await db.scalar(
        select(InviteToken).where(InviteToken.token == body.token)
    )
    if not invite or invite.used_at is not None:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    if invite.expires_at < now:
        raise HTTPException(status_code=410, detail="Invite link has expired")

    user = await db.get(User, invite.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    invite.used_at = now
    await db.commit()

    return RedeemResponse(email=user.email)
