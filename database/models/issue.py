from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(primary_key=True)

    test_case_id: Mapped[int] = mapped_column(
        ForeignKey("test_cases.id"),
        nullable=False,
    )

    bug_id: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="Open",
        nullable=False,
    )

    reproduction_steps: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False,
    )

    expected_result: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False,
    )

    actual_result: Mapped[str] = mapped_column(
        Text,
        default="",
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

    test_case = relationship(
        "TestCase",
        back_populates="issues",
    )