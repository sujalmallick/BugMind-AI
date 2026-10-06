from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class TestPlan(Base):
    """An AI-proposed test plan for a feature: ordered phases a human approves one by one."""

    __tablename__ = "test_plans"
    __test__ = False  # not a pytest test class

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    title: Mapped[str] = mapped_column(String(200))
    # What the plan is for: the feature / workflow description the user gave (the planner's source of truth).
    scope: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Open questions the planner found, and which documents informed it: {"gaps": [...], "knowledgeSources": [...]}.
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    phases = relationship("TestPlanPhase", back_populates="plan", cascade="all, delete-orphan",
                          order_by="TestPlanPhase.ordinal")


class TestPlanPhase(Base):
    """
    One phase of a plan. proposed → approved (or skipped) → generated.
    Test cases are only generated for approved phases.
    """

    __tablename__ = "test_plan_phases"
    __test__ = False

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("test_plans.id", ondelete="CASCADE"), index=True)
    ordinal: Mapped[int] = mapped_column(Integer)

    title: Mapped[str] = mapped_column(String(200))
    objective: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # The slice of the workflow this phase covers; the test case agent's input.
    scope: Mapped[str] = mapped_column(Text, default="", nullable=False)
    modules: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    risks: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    entry_criteria: Mapped[str] = mapped_column(Text, default="", nullable=False)
    exit_criteria: Mapped[str] = mapped_column(Text, default="", nullable=False)
    priority: Mapped[str] = mapped_column(String(10), default="Medium", nullable=False)

    status: Mapped[str] = mapped_column(String(20), default="proposed", nullable=False)
    # Grounding check of the phase itself ({"status", "sources", "notes"}); cleared when edited.
    grounding: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Last generation: {"generated": n, "skippedDuplicates": n, "coverage": score}.
    generation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan = relationship("TestPlan", back_populates="phases")
