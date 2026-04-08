from fastapi import APIRouter, Depends

from app.auth.dependencies import require_admin
from app.config import get_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/smtp-status")
async def smtp_status(_=Depends(require_admin)):
    s = get_settings()
    return {"enabled": bool(s.smtp_host)}
