from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── SubTask ──────────────────────────────────────────────────────────────────

class SubTaskCreate(BaseModel):
    name: str
    category: str
    reasoning: Optional[str] = None
    system_prompt_tokens: int = 0
    input_context_tokens: int = 0
    output_tokens: int = 0
    interaction_rounds: int = 1
    worst_case_multiplier: float = 1.5


class SubTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    reasoning: Optional[str] = None
    system_prompt_tokens: int
    input_context_tokens: int
    output_tokens: int
    interaction_rounds: int
    worst_case_multiplier: float
    order: int


# ── Feature ───────────────────────────────────────────────────────────────────

class FeatureCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    priority: int = Field(default=5, ge=1, le=10)
    sub_tasks: list[SubTaskCreate] = []


class FeatureUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[int] = Field(default=None, ge=1, le=10)


class FeatureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    priority: int
    order: int
    total_input_tokens: Optional[int] = None
    total_output_tokens: Optional[int] = None
    sub_tasks: list[SubTaskOut] = []
    updated_at: datetime


# ── Project ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    budget_monthly: Optional[float] = Field(default=None, ge=0)


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    budget_monthly: Optional[float] = Field(default=None, ge=0)


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    budget_monthly: Optional[float] = None
    status: str
    created_at: datetime
    updated_at: datetime
    feature_count: int = 0


class ProjectDetail(ProjectOut):
    features: list[FeatureOut] = []


class BundleInfo(BaseModel):
    """Minimal bundle info for project listing."""
    model_config = ConfigDict(from_attributes=True)

    tier: str
    total_cost: float


class ProjectWithDetails(ProjectOut):
    """Project with full analysis data for switching."""
    model_config = ConfigDict(from_attributes=True)

    access_type: str
    bundles: list[BundleInfo] = []


# ── TaskCategory ──────────────────────────────────────────────────────────────

class TaskCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    label: str
    description: Optional[str] = None
    min_input_tokens: int
    max_input_tokens: int
    min_output_tokens: int
    max_output_tokens: int
