from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel as PydanticModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import require_admin, get_current_user
from app.database import get_db
from app.models.project import Feature, Project, SubTask
from app.models.user import User
from app.models.bundle import Bundle, Scenario
from app.models.project import ShareLink
from app.schemas.project import (
    FeatureCreate, FeatureOut, FeatureUpdate,
    ProjectCreate, ProjectDetail, ProjectOut, ProjectUpdate,
    ProjectWithDetails, BundleInfo,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])

# ── helpers ───────────────────────────────────────────────────────────────────

DEMO_OWNER_ID = 1  # replaced by JWT auth in Phase 9


def _compute_token_totals(sub_tasks: list) -> tuple[int, int]:
    total_in = total_out = 0
    for st in sub_tasks:
        rounds = st.interaction_rounds
        mult = float(st.worst_case_multiplier)
        total_in += int((st.system_prompt_tokens + st.input_context_tokens) * rounds * mult)
        total_out += int(st.output_tokens * rounds * mult)
    return total_in, total_out


async def _get_project_or_404(project_id: int, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _enrich_project(project: Project, db: AsyncSession) -> ProjectOut:
    count = await db.scalar(
        select(func.count()).where(Feature.project_id == project.id)
    )
    out = ProjectOut.model_validate(project)
    out.feature_count = count or 0
    return out


async def _check_project_access(project: Project, current_user: User, db: AsyncSession) -> tuple[bool, str]:
    """
    Check if user has access to project.
    Returns (has_access, access_type) where access_type is "owner" or "shared".
    """
    # Admins have access to all projects
    if current_user.role == 'admin':
        return True, 'owner'  # treat as owner for simplicity

    # Check if user owns the project
    if project.owner_id == current_user.id:
        return True, 'owner'

    # Check if project is shared with user via share link
    share_link = await db.scalar(
        select(ShareLink)
        .where(
            ShareLink.project_id == project.id,
            ShareLink.shared_with_user_id == current_user.id,
            ShareLink.is_active.is_(True)
        )
    )

    if share_link:
        return True, 'shared'

    return False, ''


async def _enrich_project_with_bundles(project: Project, db: AsyncSession) -> ProjectWithDetails:
    """Enrich project with feature count and bundle data."""
    # Get feature count
    count = await db.scalar(
        select(func.count()).where(Feature.project_id == project.id)
    )

    # Get bundles from scenarios
    result = await db.execute(
        select(Bundle)
        .join(Scenario)
        .where(Scenario.project_id == project.id)
        .order_by(Bundle.tier)
    )
    bundles = result.scalars().all()

    bundle_infos = [
        BundleInfo(tier=b.tier, total_cost=float(b.total_cost))
        for b in bundles
    ]

    return ProjectWithDetails(
        id=project.id,
        name=project.name,
        description=project.description,
        budget_monthly=float(project.budget_monthly) if project.budget_monthly else None,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        feature_count=count or 0,
        access_type='',  # Will be set by caller
        bundles=bundle_infos
    )


# ── projects ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProjectOut | ProjectWithDetails])
async def list_projects(
    include_details: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List projects with optional detailed view."""
    # Get all projects
    result = await db.execute(
        select(Project).order_by(Project.updated_at.desc())
    )
    all_projects = result.scalars().all()

    # Filter based on user access
    if current_user.role != 'admin':
        filtered = []
        for project in all_projects:
            has_access, _ = await _check_project_access(project, current_user, db)
            if has_access:
                filtered.append(project)
        all_projects = filtered

    if include_details:
        return [await _enrich_project_with_bundles(p, db) for p in all_projects]

    return [await _enrich_project(p, db) for p in all_projects]


@router.get("/my-projects", response_model=list[ProjectWithDetails])
async def list_my_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all projects accessible to current user.

    - Admins: see all projects
    - Regular users: see owned projects + projects shared with them
    """
    # Get all projects
    result = await db.execute(
        select(Project).order_by(Project.updated_at.desc())
    )
    all_projects = result.scalars().all()

    accessible_projects = []
    for project in all_projects:
        has_access, access_type = await _check_project_access(project, current_user, db)
        if has_access:
            enriched = await _enrich_project_with_bundles(project, db)
            enriched.access_type = access_type
            accessible_projects.append(enriched)

    return accessible_projects


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(owner_id=DEMO_OWNER_ID, **body.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return await _enrich_project(project, db)


class OrphanedDeleteOut(PydanticModel):
    deleted: int


@router.delete("/orphaned", response_model=OrphanedDeleteOut)
async def delete_orphaned_projects(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Delete all projects that have no features (abandoned mid-interview)."""
    subq = select(Feature.project_id).distinct()
    result = await db.execute(
        select(Project).where(Project.id.not_in(subq))
    )
    orphaned = result.scalars().all()
    count = len(orphaned)
    for p in orphaned:
        await db.delete(p)
    await db.commit()
    return OrphanedDeleteOut(deleted=count)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Project)
        .options(
            selectinload(Project.features).selectinload(Feature.sub_tasks)
        )
        .where(Project.id == project_id)
    )
    project = await db.scalar(stmt)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    out = ProjectDetail.model_validate(project)
    out.feature_count = len(project.features)
    return out


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: int, body: ProjectUpdate, db: AsyncSession = Depends(get_db)
):
    project = await _get_project_or_404(project_id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return await _enrich_project(project, db)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    project = await _get_project_or_404(project_id, db)
    await db.delete(project)
    await db.commit()


# ── features ──────────────────────────────────────────────────────────────────

@router.get("/{project_id}/features", response_model=list[FeatureOut])
async def list_features(project_id: int, db: AsyncSession = Depends(get_db)):
    await _get_project_or_404(project_id, db)
    result = await db.execute(
        select(Feature)
        .options(selectinload(Feature.sub_tasks))
        .where(Feature.project_id == project_id)
        .order_by(Feature.order, Feature.priority)
    )
    return result.scalars().all()


@router.post("/{project_id}/features", response_model=FeatureOut, status_code=201)
async def add_feature(
    project_id: int, body: FeatureCreate, db: AsyncSession = Depends(get_db)
):
    await _get_project_or_404(project_id, db)

    # Count existing features for ordering
    count = await db.scalar(
        select(func.count()).where(Feature.project_id == project_id)
    )

    feature = Feature(
        project_id=project_id,
        name=body.name,
        description=body.description,
        category=body.category,
        priority=body.priority,
        order=count or 0,
    )
    db.add(feature)
    await db.flush()

    for i, st_data in enumerate(body.sub_tasks):
        sub = SubTask(feature_id=feature.id, order=i, **st_data.model_dump())
        db.add(sub)

    await db.flush()

    # Recompute token totals
    subs = (await db.execute(
        select(SubTask).where(SubTask.feature_id == feature.id)
    )).scalars().all()
    feature.total_input_tokens, feature.total_output_tokens = _compute_token_totals(subs)

    await db.commit()

    stmt = (
        select(Feature)
        .options(selectinload(Feature.sub_tasks))
        .where(Feature.id == feature.id)
    )
    return await db.scalar(stmt)


@router.patch("/{project_id}/features/{feature_id}", response_model=FeatureOut)
async def update_feature(
    project_id: int,
    feature_id: int,
    body: FeatureUpdate,
    db: AsyncSession = Depends(get_db),
):
    feature = await db.scalar(
        select(Feature)
        .options(selectinload(Feature.sub_tasks))
        .where(Feature.id == feature_id, Feature.project_id == project_id)
    )
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(feature, field, value)
    await db.commit()
    await db.refresh(feature)
    return feature


@router.delete("/{project_id}/features/{feature_id}", status_code=204)
async def delete_feature(
    project_id: int, feature_id: int, db: AsyncSession = Depends(get_db)
):
    feature = await db.scalar(
        select(Feature).where(Feature.id == feature_id, Feature.project_id == project_id)
    )
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    await db.delete(feature)
    await db.commit()
