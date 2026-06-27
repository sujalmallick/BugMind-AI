from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)

    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    # Nullable: personal projects (no org) remain fully functional
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="Draft",
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

    owner = relationship("User", back_populates="projects")
    organization = relationship("Organization", back_populates="projects")

    # Access control
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    team_access = relationship("ProjectTeamAccess", back_populates="project", cascade="all, delete-orphan")

    workspace = relationship(
    "Workspace",
    back_populates="project",
    uselist=False,
    cascade="all, delete-orphan",
)