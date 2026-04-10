"""Sharing schemas for project sharing functionality."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ── Share With Users ──────────────────────────────────────────────────────────

class ShareWithUsersRequest(BaseModel):
    user_ids: list[int]


class ShareLinkInfo(BaseModel):
    """Information about a generated share link."""
    user_id: int
    email: str
    link: str
    expires_at: Optional[datetime] = None


class ShareWithUsersResponse(BaseModel):
    """Response from sharing project with users."""
    project_id: int
    links: list[ShareLinkInfo]


# ── Share Link Out ────────────────────────────────────────────────────────────

class ShareLinkOut(BaseModel):
    """Output schema for share link."""
    id: int
    project_id: int
    shared_with_user_id: Optional[int] = None
    shared_with_user_email: Optional[str] = None
    token: str
    label: Optional[str] = None
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True
