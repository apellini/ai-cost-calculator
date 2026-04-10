"""Project sharing router - direct user selection."""
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.bundle import ShareLink
from app.models.project import Project
from app.models.user import User
from app.schemas.sharing import (
    ShareLinkInfo,
    ShareLinkOut,
    ShareWithUsersRequest,
    ShareWithUsersResponse,
)
from app.config import get_settings

router = APIRouter(prefix="/api/projects/{project_id}/share", tags=["sharing"])


def _generate_invite_url(project_id: int, token: str, settings: any) -> str:
    """Generate share link URL for the project."""
    base_url = settings.app_base_url or "http://localhost:5173"
    return f"{base_url}/share/{project_id}?token={token}"


@router.post("/users", response_model=ShareWithUsersResponse)
async def share_with_users(
    project_id: int,
    body: ShareWithUsersRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Share project with specific users.

    Creates or reuses share links for each selected user.
    Returns the generated links for distribution.
    """
    # Verify project exists and user is owner
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only project owners can share projects"
        )

    settings = get_settings()
    links: list[ShareLinkInfo] = []

    for user_id in body.user_ids:
        # Validate user exists
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} not found"
            )

        # Check if share link already exists for this user/project pair
        existing = await db.scalar(
            select(ShareLink)
            .where(
                ShareLink.project_id == project_id,
                ShareLink.shared_with_user_id == user_id,
                ShareLink.is_active.is_(True)
            )
        )

        if existing:
            # Reuse existing link
            invite_url = _generate_invite_url(project_id, existing.token, settings)
            links.append(ShareLinkInfo(
                user_id=user.id,
                email=user.email,
                link=invite_url,
                expires_at=existing.expires_at
            ))
        else:
            # Create new share link
            token = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)

            share_link = ShareLink(
                project_id=project_id,
                shared_with_user_id=user.id,
                token=token,
                label=f"Shared with {user.email}",
                expires_at=expires_at,
                is_active=True
            )
            db.add(share_link)
            await db.flush()

            invite_url = _generate_invite_url(project_id, token, settings)
            links.append(ShareLinkInfo(
                user_id=user.id,
                email=user.email,
                link=invite_url,
                expires_at=expires_at
            ))

    await db.commit()

    return ShareWithUsersResponse(
        project_id=project_id,
        links=links
    )


@router.get("/links", response_model=list[ShareLinkOut])
async def list_share_links(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all active share links for a project."""
    # Verify project exists and user is owner
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only project owners can view share links"
        )

    result = await db.execute(
        select(ShareLink)
        .where(
            ShareLink.project_id == project_id,
            ShareLink.is_active.is_(True)
        )
        .order_by(ShareLink.created_at.desc())
    )
    links = result.scalars().all()

    return [
        ShareLinkOut(
            id=link.id,
            project_id=link.project_id,
            shared_with_user_id=link.shared_with_user_id,
            shared_with_user_email=link.shared_with_user.email if link.shared_with_user else None,
            token=link.token,
            label=link.label,
            is_active=link.is_active,
            created_at=link.created_at,
            expires_at=link.expires_at
        )
        for link in links
    ]


@router.delete("/links/{link_id}", status_code=204)
async def revoke_share_link(
    project_id: int,
    link_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke a specific share link."""
    # Verify project exists and user is owner
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only project owners can revoke share links"
        )

    link = await db.get(ShareLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")

    if link.project_id != project_id:
        raise HTTPException(
            status_code=400,
            detail="Share link does not belong to this project"
        )

    link.is_active = False
    await db.commit()
