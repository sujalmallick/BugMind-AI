from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from database.models.user_ai_settings import UserAISettings

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(String(100))

    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location: Mapped[str | None] = mapped_column(String(100), nullable=True)

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
    )

    ai_settings = relationship(
    "UserAISettings",
    back_populates="user",
    uselist=False,
    cascade="all, delete-orphan",)
    projects = relationship(
    "Project",
    back_populates="owner",
    cascade="all, delete-orphan",
)

    org_memberships = relationship(
        "OrganizationMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    team_memberships = relationship(
        "TeamMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    password_hash: Mapped[str] = mapped_column(String(255))

    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Bump this on any security event (password change, future: email change,
    # MFA). Auth middleware rejects any JWT whose iat < credentials_updated_at.
    credentials_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    # Soft-delete fields. Rows are never hard-deleted.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )