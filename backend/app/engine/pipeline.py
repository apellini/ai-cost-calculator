"""
Analysis pipeline orchestrator.

Steps:
  1. Load features + sub-tasks from DB
  2. Run LLM decomposition on features that lack sub-tasks
  3. Sanity-check token estimates against category bounds
  4. Generate Economy / Balanced / Premium bundles
  5. Run budget optimization per bundle
  6. Persist bundles + feature costs to DB
  7. Return structured result
"""
import time
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.engine.budget_optimizer import FeatureItem, OptimizationResult, optimize
from app.engine.bundle_generator import ModelCandidate, generate_bundle
from app.engine.cost_calculator import FeatureCost
from app.engine.sanity_checker import CategoryBounds, SanityWarning, check_sub_task, SubTaskTokens
from app.llm.base import LLMAdapter
from app.models.bundle import Bundle, BundleFeatureCost, Scenario
from app.services.snapshot_service import create_snapshot
from app.models.project import Feature, Project, SubTask, TaskCategory
from app.models.provider import LLMModel

TIERS = ("economy", "balanced", "premium")
MONTHLY_MULTIPLIER = 1000  # scale per-session tokens → monthly estimate


@dataclass
class BundleResult:
    tier: str
    total_cost: float
    feature_costs: list[FeatureCost]
    optimization: OptimizationResult


@dataclass
class PipelineResult:
    project_id: int
    scenario_id: int
    bundles: list[BundleResult]
    sanity_warnings: list[SanityWarning] = field(default_factory=list)
    elapsed_seconds: float = 0.0


async def run_analysis(
    project_id: int,
    scenario_id: int,
    db: AsyncSession,
    llm: LLMAdapter,
) -> PipelineResult:
    t0 = time.monotonic()

    # ── 1. Load project + features ────────────────────────────────────────────
    project = await db.scalar(
        select(Project)
        .options(selectinload(Project.features).selectinload(Feature.sub_tasks))
        .where(Project.id == project_id)
    )
    if not project:
        raise ValueError(f"Project {project_id} not found")

    # ── 2. LLM decomposition for features without sub-tasks ──────────────────
    for feature in project.features:
        if not feature.sub_tasks:
            result = await llm.decompose_feature(
                feature.name,
                feature.description or "",
                feature.category or "qa_chatbot",
            )
            total_in = total_out = 0
            for i, st in enumerate(result.sub_tasks):
                sub = SubTask(
                    feature_id=feature.id,
                    name=st.name,
                    category=st.category,
                    reasoning=st.reasoning,
                    system_prompt_tokens=st.system_prompt_tokens,
                    input_context_tokens=st.input_context_tokens,
                    output_tokens=st.output_tokens,
                    interaction_rounds=st.interaction_rounds,
                    worst_case_multiplier=st.worst_case_multiplier,
                    order=i,
                )
                db.add(sub)
                feature.sub_tasks.append(sub)
                from app.engine.cost_calculator import SubTaskTokens as ST
                t = ST(st.system_prompt_tokens, st.input_context_tokens,
                       st.output_tokens, st.interaction_rounds, st.worst_case_multiplier)
                total_in += t.effective_input
                total_out += t.effective_output
            feature.total_input_tokens = total_in
            feature.total_output_tokens = total_out
    await db.flush()

    # ── 3. Sanity checks ──────────────────────────────────────────────────────
    cat_rows = (await db.execute(select(TaskCategory))).scalars().all()
    bounds_map: dict[str, CategoryBounds] = {
        c.slug: CategoryBounds(
            slug=c.slug,
            min_input_tokens=c.min_input_tokens,
            max_input_tokens=c.max_input_tokens,
            min_output_tokens=c.min_output_tokens,
            max_output_tokens=c.max_output_tokens,
        )
        for c in cat_rows
    }
    warnings: list[SanityWarning] = []
    for feature in project.features:
        for st in feature.sub_tasks:
            bounds = bounds_map.get(st.category)
            if bounds:
                tokens = SubTaskTokens(
                    system_prompt_tokens=st.system_prompt_tokens,
                    input_context_tokens=st.input_context_tokens,
                    output_tokens=st.output_tokens,
                    interaction_rounds=st.interaction_rounds,
                    worst_case_multiplier=float(st.worst_case_multiplier),
                )
                warnings.extend(check_sub_task(st.name, tokens, bounds))

    # ── 4. Load model candidates ──────────────────────────────────────────────
    model_rows = (await db.execute(
        select(LLMModel).where(LLMModel.is_active.is_(True))
    )).scalars().all()

    candidates: list[ModelCandidate] = [
        ModelCandidate(
            model_id=m.id,
            slug=m.slug,
            display_name=m.display_name,
            input_per_1m=float(m.input_per_1m),
            output_per_1m=float(m.output_per_1m),
            batch_per_1m=float(m.batch_per_1m) if m.batch_per_1m else None,
            cached_input_per_1m=float(m.cached_input_per_1m) if m.cached_input_per_1m else None,
            volume_tiers=m.volume_tiers or [],
            task_fit=m.task_fit or {},
        )
        for m in model_rows
    ]

    # ── 5. Build feature dicts for bundle generator ───────────────────────────
    feature_dicts = [
        {
            "id": f.id,
            "name": f.name,
            "category": f.category or "qa_chatbot",
            "sub_tasks": [
                {
                    "name": st.name,
                    "system_prompt_tokens": st.system_prompt_tokens,
                    "input_context_tokens": st.input_context_tokens,
                    "output_tokens": st.output_tokens,
                    "interaction_rounds": st.interaction_rounds,
                    "worst_case_multiplier": float(st.worst_case_multiplier),
                }
                for st in f.sub_tasks
            ],
        }
        for f in project.features
    ]

    # ── 6. Generate bundles + optimize ────────────────────────────────────────
    budget = float(project.budget_monthly or 1_000_000)
    bundle_results: list[BundleResult] = []

    for tier in TIERS:
        feature_costs = generate_bundle(feature_dicts, candidates, tier, MONTHLY_MULTIPLIER)
        total_cost = sum(fc.cost for fc in feature_costs)

        items = [
            FeatureItem(
                feature_id=fc.feature_id,
                feature_name=fc.feature_name,
                cost=fc.cost,
                priority=next(
                    (f.priority for f in project.features if f.id == fc.feature_id), 5
                ),
            )
            for fc in feature_costs
        ]
        opt = optimize(items, budget)
        bundle_results.append(BundleResult(
            tier=tier,
            total_cost=total_cost,
            feature_costs=feature_costs,
            optimization=opt,
        ))

    # ── 7. Persist bundles to DB ──────────────────────────────────────────────
    # Remove existing bundles for this scenario
    existing = (await db.execute(
        select(Bundle).where(Bundle.scenario_id == scenario_id)
    )).scalars().all()
    for b in existing:
        await db.delete(b)
    await db.flush()

    for br in bundle_results:
        bundle = Bundle(scenario_id=scenario_id, tier=br.tier, total_cost=br.total_cost)
        db.add(bundle)
        await db.flush()
        for fc in br.feature_costs:
            db.add(BundleFeatureCost(
                bundle_id=bundle.id,
                feature_id=fc.feature_id,
                model_id=fc.model_id,
                cost=fc.cost,
                input_tokens=fc.input_tokens,
                output_tokens=fc.output_tokens,
            ))

    # Update scenario status
    scenario = await db.get(Scenario, scenario_id)
    if scenario:
        scenario.status = "ready"

    # Capture immutable pricing snapshot
    await create_snapshot(scenario_id, db)

    await db.commit()

    return PipelineResult(
        project_id=project_id,
        scenario_id=scenario_id,
        bundles=bundle_results,
        sanity_warnings=warnings,
        elapsed_seconds=time.monotonic() - t0,
    )
