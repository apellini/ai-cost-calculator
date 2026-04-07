"""
Snapshot service: captures immutable point-in-time copies of pricing + benchmark data.

Called automatically by the analysis pipeline after bundles are persisted,
ensuring historical analyses remain reproducible even after pricing updates.
"""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bundle import Snapshot
from app.models.provider import LLMModel


async def create_snapshot(
    scenario_id: int,
    db: AsyncSession,
    label: str | None = None,
) -> Snapshot:
    """
    Capture all active model pricing + benchmarks as an immutable JSON blob.
    Returns the persisted Snapshot (not yet committed — caller flushes/commits).
    """
    models = (await db.execute(
        select(LLMModel)
        .options(selectinload(LLMModel.benchmark))
        .where(LLMModel.is_active.is_(True))
    )).scalars().all()

    data: dict = {
        "captured_at": datetime.utcnow().isoformat(),
        "models": [
            {
                "id": m.id,
                "slug": m.slug,
                "display_name": m.display_name,
                "input_per_1m": float(m.input_per_1m),
                "output_per_1m": float(m.output_per_1m),
                "batch_per_1m": float(m.batch_per_1m) if m.batch_per_1m else None,
                "cached_input_per_1m": float(m.cached_input_per_1m) if m.cached_input_per_1m else None,
                "task_fit": m.task_fit,
                "benchmark": {
                    "mmlu": float(m.benchmark.mmlu) if m.benchmark.mmlu is not None else None,
                    "human_eval": float(m.benchmark.human_eval) if m.benchmark.human_eval is not None else None,
                    "math": float(m.benchmark.math) if m.benchmark.math is not None else None,
                    "reasoning": float(m.benchmark.reasoning) if m.benchmark.reasoning is not None else None,
                    "speed_tps": float(m.benchmark.speed_tps) if m.benchmark.speed_tps is not None else None,
                } if m.benchmark else None,
            }
            for m in models
        ],
    }

    snap = Snapshot(
        scenario_id=scenario_id,
        label=label or f"Analysis {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
        data=data,
    )
    db.add(snap)
    await db.flush()
    return snap
