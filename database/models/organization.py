from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # URL-safe unique identifier used in API paths / frontend URLs
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Bootstrap ownership — the user who created the org.
    # Actual permissions are stored in organization_members.
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Soft-delete — rows are never hard-deleted
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # ── Relationships ────────────────────────────────────────────────────────
    members = relationship(
        "OrganizationMember",
        back_populates="organization",
        cascade="all, delete-orphan",
    )

    teams = relationship(
        "Team",
        back_populates="organization",
        cascade="all, delete-orphan",
    )

    projects = relationship(
        "Project",
        back_populates="organization",
        foreign_keys="Project.organization_id",
    )
