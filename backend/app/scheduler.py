"""
APScheduler setup for background pricing refresh.

refresh_interval setting:
  "daily"  → every 24 hours
  "weekly" → every 168 hours
  "manual" → no scheduled job (refresh only via API endpoint)
"""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.services.refresh_service import refresh_pricing

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None

_INTERVAL_HOURS: dict[str, int] = {
    "daily": 24,
    "weekly": 168,
}


async def _do_refresh() -> None:
    async with AsyncSessionLocal() as db:
        count = await refresh_pricing(db)
        logger.info("Scheduled pricing refresh completed: %d models updated", count)


def init_scheduler() -> AsyncIOScheduler:
    global _scheduler
    settings = get_settings()

    _scheduler = AsyncIOScheduler()

    hours = _INTERVAL_HOURS.get(settings.refresh_interval)
    if hours:
        _scheduler.add_job(
            _do_refresh,
            IntervalTrigger(hours=hours),
            id="pricing_refresh",
            replace_existing=True,
        )
        logger.info(
            "Pricing refresh scheduled every %d hours (%s)",
            hours,
            settings.refresh_interval,
        )
    else:
        logger.info("Pricing refresh set to manual — no scheduled job")

    _scheduler.start()
    return _scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
