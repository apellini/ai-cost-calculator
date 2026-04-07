"""
Analysis endpoints — trigger pipeline, retrieve results.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.engine.pipeline import run_analysis
from app.llm.factory import get_llm_adapter
from app.models.bundle import Bundle, BundleFeatureCost, Scenario
from app.models.project import Feature, Project
from app.models.provider import LLMModel

router = APIRouter(prefix="/api/projects", tags=["analysis"])


# ── Response schemas ──────────────────────────────────────────────────────────

class FeatureCostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    feature_id: int
    model_id: int
    model_slug: str = ""
    cost: float
    input_tokens: int
    output_tokens: int

    @classmethod
    def from_orm_with_slug(cls, bfc: BundleFeatureCost, slug: str) -> "FeatureCostOut":
        return cls(
            feature_id=bfc.feature_id,
            model_id=bfc.model_id,
            model_slug=slug,
            cost=float(bfc.cost),
            input_tokens=bfc.input_tokens,
            output_tokens=bfc.output_tokens,
        )


class BundleOut(BaseModel):
    tier: str
    total_cost: float
    feature_costs: list[FeatureCostOut]


class AnalysisOut(BaseModel):
    scenario_id: int
    status: str
    bundles: list[BundleOut]
    elapsed_seconds: float | None = None
    warnings: list[str] = []


class SanityWarningOut(BaseModel):
    message: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/{project_id}/analyze", response_model=AnalysisOut, status_code=201)
async def analyze_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Run the full estimation pipeline for a project.
    Creates a default scenario if none exists, then runs:
      decompose → sanity check → bundle → optimize → persist
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create or reuse default scenario
    scenario = await db.scalar(
        select(Scenario).where(
            Scenario.project_id == project_id,
            Scenario.name == "Default",
        )
    )
    if not scenario:
        scenario = Scenario(project_id=project_id, name="Default", status="running")
        db.add(scenario)
        await db.flush()
    else:
        scenario.status = "running"
        await db.flush()

    llm = get_llm_adapter()
    result = await run_analysis(project_id, scenario.id, db, llm)

    warnings = [str(w) for w in result.sanity_warnings]

    bundles_out = await _load_bundles(scenario.id, db)

    return AnalysisOut(
        scenario_id=scenario.id,
        status="ready",
        bundles=bundles_out,
        elapsed_seconds=round(result.elapsed_seconds, 2),
        warnings=warnings,
    )


@router.get("/{project_id}/analyze", response_model=AnalysisOut)
async def get_analysis(project_id: int, db: AsyncSession = Depends(get_db)):
    """Return the latest analysis result for a project."""
    scenario = await db.scalar(
        select(Scenario)
        .where(Scenario.project_id == project_id, Scenario.name == "Default")
        .order_by(Scenario.updated_at.desc())
    )
    if not scenario:
        raise HTTPException(status_code=404, detail="No analysis found. Run POST first.")

    bundles_out = await _load_bundles(scenario.id, db)
    return AnalysisOut(
        scenario_id=scenario.id,
        status=scenario.status,
        bundles=bundles_out,
    )


async def _load_bundles(scenario_id: int, db: AsyncSession) -> list[BundleOut]:
    bundles = (await db.execute(
        select(Bundle)
        .options(selectinload(Bundle.feature_costs))
        .where(Bundle.scenario_id == scenario_id)
        .order_by(Bundle.tier)
    )).scalars().all()

    # Pre-fetch model slugs
    model_ids = {bfc.model_id for b in bundles for bfc in b.feature_costs}
    models = {}
    if model_ids:
        rows = (await db.execute(
            select(LLMModel).where(LLMModel.id.in_(model_ids))
        )).scalars().all()
        models = {m.id: m.slug for m in rows}

    return [
        BundleOut(
            tier=b.tier,
            total_cost=float(b.total_cost),
            feature_costs=[
                FeatureCostOut.from_orm_with_slug(bfc, models.get(bfc.model_id, ""))
                for bfc in b.feature_costs
            ],
        )
        for b in bundles
    ]
