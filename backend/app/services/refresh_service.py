"""
Pricing refresh service.

Mock mode : touches `updated_at` on all active LLMModel rows (simulates a refresh).
Real mode : Fetches from external API, detects changes, logs NOTIFY, updates DB.

Returns a SyncReport with detailed information about the sync operation.
"""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.provider import LLMModel, LLMProvider
from app.schemas.model import SyncReport
from app.services.pricing_providers import PricingProvider, MockPricingProvider

logger = logging.getLogger(__name__)


async def refresh_pricing(
    db: AsyncSession,
    provider: Optional[PricingProvider] = None
) -> SyncReport:
    """
    Refresh pricing and benchmarks from an external provider.

    Detects changes, logs notifications, and updates the DB.

    Args:
        db: Database session
        provider: Optional PricingProvider instance. If None, uses MockPricingProvider.

    Returns:
        SyncReport with details about the sync operation.
    """
    settings = get_settings()

    # Determine which provider to use
    if provider is None:
        provider = MockPricingProvider()

    try:
        # 1. Fetch latest data from provider
        logger.info("Starting pricing refresh...")
        external_data = await provider.fetch_models()
        logger.info(f"Fetched {len(external_data)} models from provider")

        # 2. Get current models from DB for comparison
        stmt = select(LLMModel).options(selectinload(LLMModel.provider))
        result = await db.execute(stmt)
        db_models = {m.slug: m for m in result.scalars().all()}

        updated_count = 0
        changes_count = 0
        new_count = 0

        # 3. Process and Compare
        for ext in external_data:
            # Get or create provider
            provider_stmt = select(LLMProvider).where(LLMProvider.name == ext.provider_name)
            provider_res = await db.execute(provider_stmt)
            provider_obj = provider_res.scalar_one_or_none()

            if not provider_obj:
                logger.info(f"Creating new provider: {ext.provider_name}")
                provider_obj = LLMProvider(name=ext.provider_name)
                db.add(provider_obj)
                await db.flush()

            if ext.slug in db_models:
                # Existing model: Check for changes
                model = db_models[ext.slug]

                price_changed = (
                    float(model.input_per_1m) != ext.input_per_1m or
                    float(model.output_per_1m) != ext.output_per_1m
                )

                if price_changed:
                    logger.warning(
                        "[NOTIFY] Price change for %s: Input $%.4f→$%.4f, Output $%.4f→$%.4f",
                        ext.slug,
                        float(model.input_per_1m), ext.input_per_1m,
                        float(model.output_per_1m), ext.output_per_1m
                    )
                    changes_count += 1

                    model.input_per_1m = ext.input_per_1m
                    model.output_per_1m = ext.output_per_1m
                    model.updated_at = datetime.utcnow()
                    updated_count += 1
            else:
                # New model discovered
                logger.info(
                    "[NOTIFY] New model discovered: %s (%s) from %s",
                    ext.display_name, ext.slug, ext.provider_name
                )
                new_model = LLMModel(
                    provider_id=provider_obj.id,
                    slug=ext.slug,
                    display_name=ext.display_name,
                    input_per_1m=ext.input_per_1m,
                    output_per_1m=ext.output_per_1m,
                    context_window=ext.context_window,
                    updated_at=datetime.utcnow()
                )
                db.add(new_model)
                new_count += 1
                updated_count += 1

        await db.commit()
        logger.info(f"Pricing refresh complete: {new_count} new, {changes_count} changed, {updated_count} total updated")

        return SyncReport(
            status="success",
            models_updated=updated_count,
            changes_detected=changes_count,
            new_models_added=new_count,
            message=f"Sync complete. {new_count} new models added, {changes_count} prices updated."
        )

    except Exception as e:
        logger.exception("Failed to refresh pricing: %s", str(e))
        await db.rollback()
        return SyncReport(
            status="error",
            models_updated=0,
            changes_detected=0,
            new_models_added=0,
            message=f"Error during sync: {str(e)}"
        )


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
