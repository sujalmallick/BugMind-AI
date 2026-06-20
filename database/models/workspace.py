from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(primary_key=True)

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"),
        unique=True,
        nullable=False,
    )

    workflow: Mapped[str] = mapped_column(
    Text,
    default="",
    nullable=False,
)

    observed_steps: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False,
    )

    platform: Mapped[str] = mapped_column(
        String(50),
        default="",
        nullable=False,
    )

    os_version: Mapped[str] = mapped_column(
        String(50),
        default="",
        nullable=False,
    )

    build: Mapped[str] = mapped_column(
        String(100),
        default="",
        nullable=False,
    )

    device: Mapped[str] = mapped_column(
        String(100),
        default="",
        nullable=False,
    )

    analysis_status: Mapped[str] = mapped_column(
        String(20),
        default="Draft",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    project = relationship(
        "Project",
        back_populates="workspace",
    )

    analysis = relationship(
    "Analysis",
    back_populates="workspace",
    uselist=False,
    cascade="all, delete-orphan",
)
    test_cases = relationship(
    "TestCase",
    back_populates="workspace",
    cascade="all, delete-orphan",
)