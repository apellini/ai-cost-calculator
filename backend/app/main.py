from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine
from app.routers import analysis, auth, chat, exports, models, notifications, projects, scenarios, snapshots, task_categories, timeline, users
from app.routers import settings as settings_router
from app.scheduler import init_scheduler, shutdown_scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_scheduler()
    yield
    # Shutdown
    shutdown_scheduler()
    await engine.dispose()


app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(users.router)
# snapshots must come before models: /api/models/staleness and /api/models/refresh
# are static paths that would otherwise be swallowed by models' /{model_id} dynamic route.
app.include_router(snapshots.router)
app.include_router(models.router)
app.include_router(projects.router)
app.include_router(task_categories.router)
app.include_router(analysis.router)
app.include_router(scenarios.router)
app.include_router(timeline.router)
app.include_router(exports.router)
app.include_router(notifications.router)
app.include_router(chat.router)
app.include_router(settings_router.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.app_version}
