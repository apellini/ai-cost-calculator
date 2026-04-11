"""
Pricing Source model for storing external API configurations.

Each pricing source can be configured with encrypted API keys and refresh settings.
Supports multiple providers: OpenRouter, LiteLLM, and individual LLM providers.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PricingSource(Base):
    """
    A pricing data source configuration.

    Stores API credentials (encrypted) and refresh settings for external pricing providers.
    """
    __tablename__ = "pricing_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Provider type: openrouter | litellm | openai | anthropic | google | custom
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # API Configuration
    api_url: Mapped[Optional[str]] = mapped_column(String(255))
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(String(500))  # Encrypted API key
    api_key_iv: Mapped[Optional[str]] = mapped_column(String(50))  # Encryption IV for decryption

    # Refresh Configuration
    default_refresh_interval: Mapped[str] = mapped_column(String(20), default="monthly")
    # valid intervals: immediate | hourly | daily | weekly | monthly | manual

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    last_sync_status: Mapped[Optional[str]] = mapped_column(String(20))  # success | error
    last_sync_error: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    models: Mapped[list["ModelPricingSource"]] = relationship(
        back_populates="pricing_source", cascade="all, delete-orphan"
    )


class ModelPricingSource(Base):
    """
    Link table connecting models to their pricing source with model-specific settings.

    Allows hierarchical override: Global default -> Provider default -> Model-specific setting.
    """
    __tablename__ = "model_pricing_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("llm_models.id"), nullable=False)
    pricing_source_id: Mapped[int] = mapped_column(
        ForeignKey("pricing_sources.id"), nullable=False
    )

    # Refresh frequency override (if not set, uses pricing_source.default_refresh_interval)
    refresh_interval: Mapped[Optional[str]] = mapped_column(String(20))

    # Priority for conflict resolution (higher wins)
    priority: Mapped[int] = mapped_column(Integer, default=10)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    model: Mapped["LLMModel"] = relationship()  # type: ignore[name-defined]
    pricing_source: Mapped["PricingSource"] = relationship(back_populates="models")
