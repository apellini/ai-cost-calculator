"""
Timeline endpoint: returns Gantt chart data for a project.

GET /api/projects/{project_id}/timeline
  Optional query param: start_date (YYYY-MM-DD, defaults to 7 days from today)

Features are scheduled in priority + order sequence across 2 parallel AI dev tracks.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.engine.timeline_estimator import compute_timeline
from app.models.project import Feature, Project

router = APIRouter(prefix="/api/projects", tags=["timeline"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class FeatureTimelineOut(BaseModel):
    feature_id: int
    feature_name: str
    with_ai_days: float
    without_ai_days: float
    start_date: date
    end_date: date
    depends_on: list[int]
    critical_path: bool


class TimelineOut(BaseModel):
    features: list[FeatureTimelineOut]
    total_with_ai_days: int
    total_without_ai_days: int
    start_date: date
    end_date: date


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/{project_id}/timeline", response_model=TimelineOut)
async def get_timeline(
    project_id: int,
    start_date: date | None = Query(None, description="Project kick-off date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    features = (await db.execute(
        select(Feature)
        .options(selectinload(Feature.sub_tasks))
        .where(Feature.project_id == project_id)
        .order_by(Feature.priority.asc(), Feature.order.asc())
    )).scalars().all()

    if not features:
        raise HTTPException(status_code=404, detail="No features found. Add features first.")

    result = compute_timeline(list(features), start_date)

    return TimelineOut(
        features=[
            FeatureTimelineOut(
                feature_id=f.feature_id,
                feature_name=f.feature_name,
                with_ai_days=f.with_ai_days,
                without_ai_days=f.without_ai_days,
                start_date=f.start_date,
                end_date=f.end_date,
                depends_on=f.depends_on,
                critical_path=f.critical_path,
            )
            for f in result.features
        ],
        total_with_ai_days=result.total_with_ai_days,
        total_without_ai_days=result.total_without_ai_days,
        start_date=result.start_date,
        end_date=result.end_date,
    )
