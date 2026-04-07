"""
Snapshot and pricing-refresh endpoints.

GET  /api/projects/{id}/snapshots  — list snapshots for the project's latest scenario
GET  /api/models/staleness         — when pricing was last updated + stale flag
POST /api/models/refresh           — trigger manual pricing refresh (admin only)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.database import get_db
from app.models.bundle import Scenario, Snapshot
from app.models.project import Project
from app.models.user import User
from app.services.refresh_service import get_staleness, refresh_pricing

router = APIRouter(tags=["snapshots"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SnapshotOut(BaseModel):
    id: int
    scenario_id: int
    label: str | None
    captured_at: str  # ISO datetime from inside data blob
    model_count: int
    created_at: str

    class Config:
        from_attributes = True


class StalenessOut(BaseModel):
    last_updated: str | None
    days_since_update: int | None
    is_stale: bool
    model_count: int


class RefreshOut(BaseModel):
    models_updated: int
    message: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/projects/{project_id}/snapshots", response_model=list[SnapshotOut])
async def list_snapshots(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scenario = await db.scalar(
        select(Scenario)
        .where(Scenario.project_id == project_id, Scenario.status == "ready")
        .order_by(Scenario.updated_at.desc())
    )
    if not scenario:
        return []

    snaps = (await db.execute(
        select(Snapshot)
        .where(Snapshot.scenario_id == scenario.id)
        .order_by(Snapshot.created_at.desc())
    )).scalars().all()

    return [
        SnapshotOut(
            id=s.id,
            scenario_id=s.scenario_id,
            label=s.label,
            captured_at=s.data.get("captured_at", s.created_at.isoformat()),
            model_count=len(s.data.get("models", [])),
            created_at=s.created_at.isoformat(),
        )
        for s in snaps
    ]


@router.get("/api/models/staleness", response_model=StalenessOut)
async def pricing_staleness(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return await get_staleness(db)


@router.post("/api/models/refresh", response_model=RefreshOut)
async def trigger_refresh(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    count = await refresh_pricing(db)
    return RefreshOut(
        models_updated=count,
        message=f"Pricing refreshed for {count} models.",
    )
