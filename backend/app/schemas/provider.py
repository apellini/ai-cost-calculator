from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BenchmarkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mmlu: Optional[float] = None
    human_eval: Optional[float] = None
    math: Optional[float] = None
    reasoning: Optional[float] = None
    speed_tps: Optional[int] = None


class ProviderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    website: Optional[str] = None


class ModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    display_name: str
    context_window: Optional[int] = None
    input_per_1m: float
    output_per_1m: float
    batch_per_1m: Optional[float] = None
    cached_input_per_1m: Optional[float] = None
    volume_tiers: Optional[list] = None
    task_fit: Optional[dict] = None
    is_active: bool
    updated_at: datetime
    provider: ProviderOut
    benchmark: Optional[BenchmarkOut] = None
