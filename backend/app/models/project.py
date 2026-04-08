from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskCategory(Base):
    """Defines per-category sanity-check bounds for token estimation."""
    __tablename__ = "task_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)

    # Token bounds per interaction round (sanity check only — actual values are LLM-driven)
    min_input_tokens: Mapped[int] = mapped_column(Integer, default=100)
    max_input_tokens: Mapped[int] = mapped_column(Integer, default=200_000)
    min_output_tokens: Mapped[int] = mapped_column(Integer, default=50)
    max_output_tokens: Mapped[int] = mapped_column(Integer, default=32_000)

    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    budget_monthly: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | analyzing | ready
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    owner: Mapped["User"] = relationship()  # type: ignore[name-defined]
    features: Mapped[list["Feature"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    scenarios: Mapped[list["Scenario"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    notifications: Mapped[list["Notification"]] = relationship(  # type: ignore[name-defined]
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    share_links: Mapped[list["ShareLink"]] = relationship(  # type: ignore[name-defined]
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Feature(Base):
    __tablename__ = "features"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(50))  # TaskCategory slug
    priority: Mapped[int] = mapped_column(Integer, default=5)  # 1 = highest
    order: Mapped[int] = mapped_column(Integer, default=0)

    # Aggregated token counts (computed from sub-tasks)
    total_input_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    total_output_tokens: Mapped[Optional[int]] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    project: Mapped["Project"] = relationship(back_populates="features")
    sub_tasks: Mapped[list["SubTask"]] = relationship(back_populates="feature", cascade="all, delete-orphan")


class SubTask(Base):
    """
    Token decomposition of a feature. All values are LLM-estimated.

    Cost formula per sub-task:
        tokens = (system_prompt_tokens + input_context_tokens + output_tokens)
                 × interaction_rounds
                 × worst_case_multiplier
    """
    __tablename__ = "sub_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    feature_id: Mapped[int] = mapped_column(ForeignKey("features.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    reasoning: Mapped[Optional[str]] = mapped_column(Text)  # LLM explanation

    system_prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    input_context_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    interaction_rounds: Mapped[int] = mapped_column(Integer, default=1)
    worst_case_multiplier: Mapped[float] = mapped_column(Numeric(4, 2), default=1.5)

    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    feature: Mapped["Feature"] = relationship(back_populates="sub_tasks")
