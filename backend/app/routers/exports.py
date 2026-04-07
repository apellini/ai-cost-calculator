"""
Export and share endpoints.

GET  /api/projects/{id}/export/json          — download JSON analysis
GET  /api/projects/{id}/export/csv           — download CSV analysis
GET  /api/projects/{id}/export/pdf           — download PDF report
POST /api/projects/{id}/share                — create shareable read-only link
GET  /api/share/{token}                      — public read-only analysis (no auth)
"""
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.bundle import ShareLink, Scenario
from app.models.project import Feature, Project
from app.models.user import User
from app.routers.analysis import AnalysisOut, _load_bundles
from app.services.export.csv_exporter import build_csv
from app.services.export.json_exporter import build_json
from app.services.export.pdf_exporter import build_pdf

router = APIRouter(tags=["exports"])


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_analysis(project_id: int, db: AsyncSession) -> tuple[str, AnalysisOut, dict[int, str]]:
    """Load latest ready analysis. Returns (project_name, AnalysisOut, feature_names)."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scenario = await db.scalar(
        select(Scenario)
        .where(Scenario.project_id == project_id, Scenario.status == "ready")
        .order_by(Scenario.updated_at.desc())
    )
    if not scenario:
        raise HTTPException(status_code=404, detail="No completed analysis found. Run analysis first.")

    bundles_out = await _load_bundles(scenario.id, db)
    analysis = AnalysisOut(scenario_id=scenario.id, status=scenario.status, bundles=bundles_out)

    features = (await db.execute(
        select(Feature).where(Feature.project_id == project_id)
    )).scalars().all()
    feature_names = {f.id: f.name for f in features}

    return project.name, analysis, feature_names


# ── Export endpoints ──────────────────────────────────────────────────────────

@router.get("/api/projects/{project_id}/export/json")
async def export_json(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    project_name, analysis, _ = await _get_analysis(project_id, db)
    content = build_json(project_name, analysis)
    safe_name = project_name.replace(" ", "_").lower()
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_analysis.json"'},
    )


@router.get("/api/projects/{project_id}/export/csv")
async def export_csv(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    project_name, analysis, _ = await _get_analysis(project_id, db)
    content = build_csv(project_name, analysis)
    safe_name = project_name.replace(" ", "_").lower()
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_analysis.csv"'},
    )


@router.get("/api/projects/{project_id}/export/pdf")
async def export_pdf(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    project_name, analysis, feature_names = await _get_analysis(project_id, db)
    pdf_bytes = build_pdf(project_name, analysis, feature_names)
    safe_name = project_name.replace(" ", "_").lower()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_analysis.pdf"'},
    )


# ── Share endpoints ───────────────────────────────────────────────────────────

class ShareLinkOut(BaseModel):
    token: str
    url: str
    label: str | None
    created_at: str


@router.post("/api/projects/{project_id}/share", response_model=ShareLinkOut)
async def create_share_link(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    token = secrets.token_urlsafe(32)
    link = ShareLink(
        project_id=project_id,
        token=token,
        label=f"{project.name} — shared by {user.email}",
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    return ShareLinkOut(
        token=token,
        url=f"/share/{token}",
        label=link.label,
        created_at=link.created_at.isoformat(),
    )


@router.get("/api/share/{token}", response_model=AnalysisOut)
async def view_shared(token: str, db: AsyncSession = Depends(get_db)):
    """Public read-only access — no auth required."""
    link = await db.scalar(
        select(ShareLink).where(ShareLink.token == token, ShareLink.is_active.is_(True))
    )
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Share link has expired")

    _, analysis, _ = await _get_analysis(link.project_id, db)
    return analysis
