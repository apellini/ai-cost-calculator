"""
ARQ background worker.

Task: run_background_analysis
  - Runs the full estimation pipeline for a project/scenario
  - Creates an in-app notification for the project owner on completion or failure

To start the worker on the VM:
    source .venv/bin/activate
    arq app.workers.worker.WorkerSettings

WorkerSettings are picked up automatically by the `arq` CLI.
"""
import logging
from datetime import datetime

from arq.connections import RedisSettings
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.llm.factory import get_llm_adapter
from app.models.bundle import Scenario
from app.models.notification import Notification
from app.models.project import Project
from app.engine.pipeline import run_analysis

logger = logging.getLogger(__name__)


# ── Task ──────────────────────────────────────────────────────────────────────

async def run_background_analysis(
    ctx: dict,
    project_id: int,
    scenario_id: int,
) -> dict:
    """
    ARQ task: run pipeline then notify the project owner.
    Returns a summary dict that ARQ stores as the task result.
    """
    async with AsyncSessionLocal() as db:
        # Load project to get owner_id + name
        project = await db.get(Project, project_id)
        if not project:
            logger.error("Background analysis: project %d not found", project_id)
            return {"status": "error", "reason": "project not found"}

        scenario = await db.get(Scenario, scenario_id)
        if not scenario:
            logger.error("Background analysis: scenario %d not found", scenario_id)
            return {"status": "error", "reason": "scenario not found"}

        try:
            llm = get_llm_adapter()
            result = await run_analysis(project_id, scenario_id, db, llm)

            # Notify owner
            notif = Notification(
                user_id=project.owner_id,
                project_id=project_id,
                type="analysis_complete",
                title="Analysis complete",
                message=(
                    f'"{project.name}" analysis finished in '
                    f"{result.elapsed_seconds:.1f}s. "
                    f"{len(result.bundles)} bundles generated."
                ),
            )
            db.add(notif)
            await db.commit()

            logger.info(
                "Background analysis complete: project=%d scenario=%d elapsed=%.1fs",
                project_id, scenario_id, result.elapsed_seconds,
            )
            return {"status": "ready", "scenario_id": scenario_id}

        except Exception as exc:
            logger.exception("Background analysis failed: project=%d", project_id)

            # Update scenario status
            scenario.status = "failed"
            notif = Notification(
                user_id=project.owner_id,
                project_id=project_id,
                type="analysis_failed",
                title="Analysis failed",
                message=f'"{project.name}" analysis encountered an error: {exc}',
            )
            db.add(notif)
            await db.commit()

            return {"status": "failed", "error": str(exc)}


# ── Worker settings (read by `arq` CLI) ───────────────────────────────────────

def _redis_settings() -> RedisSettings:
    url = get_settings().redis_url
    # Parse redis://[password@]host:port/db
    # RedisSettings accepts host/port separately; fall back to defaults
    try:
        from urllib.parse import urlparse
        p = urlparse(url)
        return RedisSettings(
            host=p.hostname or "localhost",
            port=p.port or 6379,
            password=p.password or None,
            database=int(p.path.lstrip("/") or 0),
        )
    except Exception:
        return RedisSettings()


class WorkerSettings:
    functions = [run_background_analysis]
    redis_settings = _redis_settings()
    job_timeout = 600       # 10 minutes max per job
    max_jobs = 4
    queue_name = "aicost"
    on_startup = None
    on_shutdown = None
