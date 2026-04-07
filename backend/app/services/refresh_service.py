"""
Pricing refresh service.

Mock mode : touches `updated_at` on all active LLMModel rows (simulates a refresh).
Real mode : TODO — call OpenRouter / LiteLLM pricing API and update rows in DB.

Returns the number of models updated.
"""
import logging
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.provider import LLMModel

logger = logging.getLogger(__name__)


async def refresh_pricing(db: AsyncSession) -> int:
    settings = get_settings()

    if settings.llm_backend != "mock":
        # Real mode: fetch prices from external API (not yet implemented)
        logger.warning("Real pricing refresh not implemented; skipping.")
        return 0

    # Mock mode: bump updated_at to now so staleness counter resets
    result = await db.execute(
        update(LLMModel)
        .where(LLMModel.is_active.is_(True))
        .values(updated_at=datetime.utcnow())
        .returning(LLMModel.id)
    )
    count = len(result.fetchall())
    await db.commit()
    logger.info("Mock pricing refresh: updated %d models", count)
    return count


async def get_staleness(db: AsyncSession) -> dict:
    """
    Return staleness metadata: when pricing was last refreshed and whether it's stale.
    Stale threshold: 7 days.
    """
    row = await db.execute(
        select(
            func.max(LLMModel.updated_at).label("last_updated"),
            func.count(LLMModel.id).label("model_count"),
        ).where(LLMModel.is_active.is_(True))
    )
    r = row.one()
    last_updated: datetime | None = r.last_updated
    model_count: int = r.model_count

    if last_updated is None:
        return {
            "last_updated": None,
            "days_since_update": None,
            "is_stale": True,
            "model_count": model_count,
        }

    delta = datetime.utcnow() - last_updated
    days = delta.days
    return {
        "last_updated": last_updated.isoformat(),
        "days_since_update": days,
        "is_stale": days >= 7,
        "model_count": model_count,
    }
