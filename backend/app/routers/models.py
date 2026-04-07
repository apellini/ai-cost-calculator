from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.provider import LLMModel, LLMProvider
from app.schemas.provider import ModelOut

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=list[ModelOut])
async def list_models(
    provider: Optional[str] = Query(None, description="Filter by provider name"),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(LLMModel)
        .options(selectinload(LLMModel.provider), selectinload(LLMModel.benchmark))
        .join(LLMModel.provider)
        .order_by(LLMProvider.name, LLMModel.display_name)
    )
    if active_only:
        stmt = stmt.where(LLMModel.is_active.is_(True))
    if provider:
        stmt = stmt.where(LLMProvider.name == provider)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/providers", response_model=list[str])
async def list_providers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LLMProvider.name).order_by(LLMProvider.name))
    return result.scalars().all()


@router.get("/{model_id}", response_model=ModelOut)
async def get_model(model_id: int, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    stmt = (
        select(LLMModel)
        .options(selectinload(LLMModel.provider), selectinload(LLMModel.benchmark))
        .where(LLMModel.id == model_id)
    )
    model = await db.scalar(stmt)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model
