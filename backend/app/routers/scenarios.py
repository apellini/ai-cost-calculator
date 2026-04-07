"""
Scenario management and comparison endpoints.

A scenario is a named analysis run for a project.
Projects can have multiple scenarios (e.g. "v1 scope", "reduced scope", "phase 2").
Comparison computes cost deltas between two scenarios at the same tier,
or between two tiers within the same scenario.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.bundle import Bundle, BundleFeatureCost, Scenario
from app.models.project import Feature, Project
from app.models.provider import LLMModel

router = APIRouter(prefix="/api/projects", tags=["scenarios"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ScenarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    notes: str | None
    status: str


class FeatureDeltaOut(BaseModel):
    feature_id: int
    feature_name: str
    left_cost: float
    left_model: str
    right_cost: float
    right_model: str
    delta: float
    left_input_tokens: int
    left_output_tokens: int


class ComparisonOut(BaseModel):
    left_label: str
    right_label: str
    left_total: float
    right_total: float
    delta: float
    delta_pct: float
    feature_deltas: list[FeatureDeltaOut]


class ScenarioCreate(BaseModel):
    name: str
    notes: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{project_id}/scenarios", response_model=list[ScenarioOut])
async def list_scenarios(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Scenario)
        .where(Scenario.project_id == project_id)
        .order_by(Scenario.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{project_id}/scenarios", response_model=ScenarioOut, status_code=201)
async def create_scenario(
    project_id: int,
    body: ScenarioCreate,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    scenario = Scenario(project_id=project_id, name=body.name, notes=body.notes)
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario


@router.get("/{project_id}/compare", response_model=ComparisonOut)
async def compare_bundles(
    project_id: int,
    left_tier: str = "economy",
    right_tier: str = "balanced",
    db: AsyncSession = Depends(get_db),
):
    """
    Compare two bundle tiers from the project's default scenario.
    Returns per-feature cost deltas and aggregate totals.
    """
    # Find the default (most recent ready) scenario
    scenario = await db.scalar(
        select(Scenario)
        .where(Scenario.project_id == project_id, Scenario.status == "ready")
        .order_by(Scenario.updated_at.desc())
    )
    if not scenario:
        raise HTTPException(status_code=404, detail="No completed analysis found. Run analysis first.")

    # Load both bundles
    bundles = (await db.execute(
        select(Bundle)
        .options(selectinload(Bundle.feature_costs))
        .where(
            Bundle.scenario_id == scenario.id,
            Bundle.tier.in_([left_tier, right_tier]),
        )
    )).scalars().all()

    left_bundle = next((b for b in bundles if b.tier == left_tier), None)
    right_bundle = next((b for b in bundles if b.tier == right_tier), None)

    if not left_bundle or not right_bundle:
        raise HTTPException(
            status_code=404,
            detail=f"Bundle tiers '{left_tier}' or '{right_tier}' not found. Run analysis first.",
        )

    # Load features
    features_rows = (await db.execute(
        select(Feature).where(Feature.project_id == project_id)
    )).scalars().all()
    feature_map = {f.id: f.name for f in features_rows}

    # Load model slugs
    model_ids = {fc.model_id for b in [left_bundle, right_bundle] for fc in b.feature_costs}
    model_rows = (await db.execute(
        select(LLMModel).where(LLMModel.id.in_(model_ids))
    )).scalars().all()
    model_map = {m.id: m.slug for m in model_rows}

    left_fc_map = {fc.feature_id: fc for fc in left_bundle.feature_costs}
    right_fc_map = {fc.feature_id: fc for fc in right_bundle.feature_costs}

    feature_deltas: list[FeatureDeltaOut] = []
    all_ids = set(left_fc_map) | set(right_fc_map)

    for fid in sorted(all_ids):
        lfc = left_fc_map.get(fid)
        rfc = right_fc_map.get(fid)
        l_cost = float(lfc.cost) if lfc else 0.0
        r_cost = float(rfc.cost) if rfc else 0.0
        feature_deltas.append(FeatureDeltaOut(
            feature_id=fid,
            feature_name=feature_map.get(fid, f"Feature {fid}"),
            left_cost=l_cost,
            left_model=model_map.get(lfc.model_id, "") if lfc else "",
            right_cost=r_cost,
            right_model=model_map.get(rfc.model_id, "") if rfc else "",
            delta=r_cost - l_cost,
            left_input_tokens=lfc.input_tokens if lfc else 0,
            left_output_tokens=lfc.output_tokens if lfc else 0,
        ))

    left_total = float(left_bundle.total_cost)
    right_total = float(right_bundle.total_cost)
    delta = right_total - left_total
    delta_pct = round((delta / left_total * 100) if left_total > 0 else 0, 1)

    return ComparisonOut(
        left_label=left_tier.capitalize(),
        right_label=right_tier.capitalize(),
        left_total=left_total,
        right_total=right_total,
        delta=delta,
        delta_pct=delta_pct,
        feature_deltas=feature_deltas,
    )
