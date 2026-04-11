from pydantic import BaseModel
from typing import List

class SyncReport(BaseModel):
    """Report returned after a pricing refresh operation."""
    status: str
    models_updated: int
    changes_detected: int
    new_models_added: int
    message: str
