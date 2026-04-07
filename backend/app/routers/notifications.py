"""
Notification endpoints.

GET  /api/notifications             — list notifications for current user (latest 50)
GET  /api/notifications/unread-count — count of unread notifications
POST /api/notifications/{id}/read   — mark one notification as read
POST /api/notifications/read-all    — mark all as read
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    project_id: int | None
    type: str
    title: str
    message: str
    is_read: bool
    created_at: str


class UnreadCount(BaseModel):
    count: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )).scalars().all()

    return [
        NotificationOut(
            id=n.id,
            project_id=n.project_id,
            type=n.type,
            title=n.title,
            message=n.message,
            is_read=n.is_read,
            created_at=n.created_at.isoformat(),
        )
        for n in rows
    ]


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    count = await db.scalar(
        select(func.count(Notification.id))
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
    )
    return UnreadCount(count=count or 0)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notif = await db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    if notif:
        notif.is_read = True
        await db.commit()

    return NotificationOut(
        id=notif.id,
        project_id=notif.project_id,
        type=notif.type,
        title=notif.title,
        message=notif.message,
        is_read=notif.is_read,
        created_at=notif.created_at.isoformat(),
    )


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}
