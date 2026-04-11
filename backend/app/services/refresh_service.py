"""
Pricing refresh service.

Fetches from configured external APIs, detects changes, logs NOTIFY,
updates DB, and handles hierarchical refresh frequency settings.

Returns a SyncReport with detailed information about the sync operation.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.provider import LLMModel, LLMProvider
from app.models.pricing_source import PricingSource, ModelPricingSource
from app.schemas.model import SyncReport
from app.services.encryption import get_decrypted_api_key, get_encryption_key
from app.services.pricing_providers import (
    PricingProvider,
    MockPricingProvider,
    OpenRouterPricingProvider,
    LiteLLMPricingProvider,
    OpenAIPricingProvider,
    AnthropicPricingProvider,
    GooglePricingProvider,
)

logger = logging.getLogger(__name__)


# Provider class mapping by type
PROVIDER_CLASSES = {
    "openrouter": OpenRouterPricingProvider,
    "litellm": LiteLLMPricingProvider,
    "openai": OpenAIPricingProvider,
    "anthropic": AnthropicPricingProvider,
    "google": GooglePricingProvider,
}


def get_provider_instance(source: PricingSource) -> Optional[PricingProvider]:
    """
    Create a PricingProvider instance from a PricingSource configuration.

    Args:
        source: The PricingSource object with provider_type and credentials

    Returns:
        A configured PricingProvider instance, or None if provider type is unknown
    """
    provider_cls = PROVIDER_CLASSES.get(source.provider_type)
    if not provider_cls:
        logger.error(f"Unknown provider type: {source.provider_type}")
        return None

    # Get decrypted API key if configured
    api_key = None
    if source.api_key_encrypted and source.api_key_iv:
        try:
            api_key = get_decrypted_api_key(source)
            if not api_key:
                logger.warning(
                    f"Failed to decrypt API key for pricing source: {source.name}"
                )
        except Exception as e:
            logger.error(
                f"Error decrypting API key for {source.name}: {e}"
            )

    # Special handling for OpenRouter which uses Bearer token
    if source.provider_type == "openrouter":
        return OpenRouterPricingProvider(api_key=api_key)

    # For other providers, pass API key in constructor
    if api_key:
        return provider_cls(api_key=api_key)
    return provider_cls()


async def should_refresh_model(
    model: LLMModel,
    source: PricingSource,
    db: AsyncSession
) -> bool:
    """
    Determine if a model's pricing should be refreshed based on frequency settings.

    Args:
        model: The LLMModel to check
        source: The PricingSource configuration
        db: Database session (for model-specific overrides)

    Returns:
        True if the model should be refreshed, False otherwise
    """
    # Check for model-specific override
    model_source_stmt = select(ModelPricingSource).where(
        ModelPricingSource.model_id == model.id,
        ModelPricingSource.is_active.is_(True)
    )
    model_source_result = await db.execute(model_source_stmt)
    model_source = model_source_result.scalar_one_or_none()

    if model_source and model_source.refresh_interval:
        interval = model_source.refresh_interval
    else:
        interval = source.default_refresh_interval

    # Manual interval = never auto-refresh
    if interval == "manual":
        return False

    # Immediate = always refresh
    if interval == "immediate":
        return True

    # Calculate time since last sync
    if model.updated_at is None:
        return True

    # Determine refresh threshold
    thresholds = {
        "hourly": timedelta(hours=1),
        "daily": timedelta(days=1),
        "weekly": timedelta(days=7),
        "monthly": timedelta(days=30),
    }

    threshold = thresholds.get(interval)
    if not threshold:
        return False  # Unknown interval = don't refresh

    return datetime.utcnow() - model.updated_at > threshold


async def refresh_pricing(
    db: AsyncSession,
    provider: Optional[PricingProvider] = None,
    source_id: Optional[int] = None
) -> SyncReport:
    """
    Refresh pricing and benchmarks from an external provider.

    Detects changes, logs notifications, and updates the DB.
    Respects hierarchical refresh frequency settings.

    Args:
        db: Database session
        provider: Optional PricingProvider instance. If None, uses MockPricingProvider.
        source_id: Optional PricingSource ID to filter which models to refresh

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
        if source_id:
            # Filter to models associated with this pricing source
            model_source_stmt = select(ModelPricingSource.model_id).where(
                ModelPricingSource.pricing_source_id == source_id
            )
            model_source_result = await db.execute(model_source_stmt)
            model_ids = [r[0] for r in model_source_result.all()]
            stmt = stmt.where(LLMModel.id.in_(model_ids))

        result = await db.execute(stmt)
        db_models = {m.slug: m for m in result.scalars().all()}

        # 3. Get pricing source for this refresh
        pricing_source = None
        if source_id:
            pricing_source = await db.get(PricingSource, source_id)

        updated_count = 0
        changes_count = 0
        new_count = 0
        skipped_count = 0

        # 4. Process and Compare
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
                # Existing model: Check for changes and refresh frequency
                model = db_models[ext.slug]

                # Check if refresh is needed based on frequency
                if pricing_source and not await should_refresh_model(model, pricing_source, db):
                    skipped_count += 1
                    continue

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

        # Update pricing source sync metadata
        if pricing_source:
            pricing_source.last_sync_at = datetime.utcnow()
            if changes_count > 0 or new_count > 0:
                pricing_source.last_sync_status = "success"
            await db.commit()

        logger.info(
            f"Pricing refresh complete: {new_count} new, {changes_count} changed, "
            f"{updated_count} total updated, {skipped_count} skipped"
        )

        return SyncReport(
            status="success",
            models_updated=updated_count,
            changes_detected=changes_count,
            new_models_added=new_count,
            message=f"Sync complete. {new_count} new models added, {changes_count} prices updated, {skipped_count} skipped."
        )

    except Exception as e:
        logger.exception("Failed to refresh pricing: %s", str(e))

        # Update pricing source sync metadata on error
        if source_id:
            pricing_source = await db.get(PricingSource, source_id)
            if pricing_source:
                pricing_source.last_sync_status = "error"
                pricing_source.last_sync_error = str(e)
                await db.commit()

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
