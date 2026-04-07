from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LLMProvider(Base):
    __tablename__ = "llm_providers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(255))
    api_docs_url: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    models: Mapped[list["LLMModel"]] = relationship(back_populates="provider", cascade="all, delete-orphan")


class LLMModel(Base):
    __tablename__ = "llm_models"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("llm_providers.id"), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)  # e.g. "nova-pro-7"
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    context_window: Mapped[Optional[int]] = mapped_column()

    # Pricing per 1M tokens
    input_per_1m: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    output_per_1m: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    batch_per_1m: Mapped[Optional[float]] = mapped_column(Numeric(10, 4))
    cached_input_per_1m: Mapped[Optional[float]] = mapped_column(Numeric(10, 4))

    # Volume discount tiers: [{"min_tokens": 1e9, "discount_pct": 10}, ...]
    volume_tiers: Mapped[Optional[dict]] = mapped_column(JSON)

    # Task fit scores by category (0-100)
    task_fit: Mapped[Optional[dict]] = mapped_column(JSON)

    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    provider: Mapped["LLMProvider"] = relationship(back_populates="models")
    benchmark: Mapped[Optional["ModelBenchmark"]] = relationship(back_populates="model", uselist=False, cascade="all, delete-orphan")


class ModelBenchmark(Base):
    __tablename__ = "model_benchmarks"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("llm_models.id"), unique=True, nullable=False)

    mmlu: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    human_eval: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    math: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    reasoning: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    speed_tps: Mapped[Optional[int]] = mapped_column()  # tokens per second

    # Raw benchmark data (for future metrics)
    extra: Mapped[Optional[dict]] = mapped_column(JSON)

    source: Mapped[Optional[str]] = mapped_column(String(200))
    measured_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    model: Mapped["LLMModel"] = relationship(back_populates="benchmark")
