from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import TaskCategory
from app.schemas.project import TaskCategoryOut

router = APIRouter(prefix="/api/task-categories", tags=["task-categories"])


@router.get("", response_model=list[TaskCategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TaskCategory).order_by(TaskCategory.label))
    return result.scalars().all()
