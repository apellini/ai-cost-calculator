from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Bundle(Base):
    """
    A cost bundle for a project at a given tier (economy/balanced/premium).
    Recomputed whenever features or pricing changes.
    """
    __tablename__ = "bundles"

    id: Mapped[int] = mapped_column(primary_key=True)
    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id"), nullable=False)
    tier: Mapped[str] = mapped_column(String(20), nullable=False)  # economy | balanced | premium
    total_cost: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    pricing_snapshot_id: Mapped[Optional[int]] = mapped_column(ForeignKey("snapshots.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    scenario: Mapped["Scenario"] = relationship(back_populates="bundles")
    feature_costs: Mapped[list["BundleFeatureCost"]] = relationship(back_populates="bundle", cascade="all, delete-orphan")
    pricing_snapshot: Mapped[Optional["Snapshot"]] = relationship()


class BundleFeatureCost(Base):
    """Per-feature cost assignment within a bundle."""
    __tablename__ = "bundle_feature_costs"

    id: Mapped[int] = mapped_column(primary_key=True)
    bundle_id: Mapped[int] = mapped_column(ForeignKey("bundles.id"), nullable=False)
    feature_id: Mapped[int] = mapped_column(ForeignKey("features.id"), nullable=False)
    model_id: Mapped[int] = mapped_column(ForeignKey("llm_models.id"), nullable=False)
    cost: Mapped[float] = mapped_column(Numeric(12, 6), nullable=False)
    input_tokens: Mapped[int] = mapped_column()
    output_tokens: Mapped[int] = mapped_column()

    bundle: Mapped["Bundle"] = relationship(back_populates="feature_costs")
    feature: Mapped["Feature"] = relationship()
    model: Mapped["LLMModel"] = relationship()  # type: ignore[name-defined]


class Scenario(Base):
    """
    A named analysis scenario for a project.
    Projects can have multiple scenarios for comparison.
    """
    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="Default")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | running | ready | failed
    is_background: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    project: Mapped["Project"] = relationship(back_populates="scenarios")
    bundles: Mapped[list["Bundle"]] = relationship(back_populates="scenario", cascade="all, delete-orphan")
    snapshots: Mapped[list["Snapshot"]] = relationship(back_populates="scenario", cascade="all, delete-orphan")


class Snapshot(Base):
    """
    Immutable point-in-time copy of pricing + benchmark data captured at analysis time.
    Ensures historical analyses remain reproducible even after price updates.
    """
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id"), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(200))
    # Deep-copy of pricing + benchmark data at snapshot time
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    scenario: Mapped["Scenario"] = relationship(back_populates="snapshots")


class ShareLink(Base):
    """
    A read-only shareable link for a project's analysis.
    Anyone with the token can view analysis results without logging in.
    """
    __tablename__ = "share_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[Optional[str]] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    project: Mapped["Project"] = relationship()  # type: ignore[name-defined]
