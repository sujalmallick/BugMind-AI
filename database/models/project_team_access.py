from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class ProjectTeamAccess(Base):
    __tablename__ = "project_team_access"
    __table_args__ = (
        UniqueConstraint("project_id", "team_id", name="uq_project_team_access"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")
    
    granted_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    
    granted_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    project = relationship("Project", back_populates="team_access")
    team = relationship("Team")
    granter = relationship("User", foreign_keys=[granted_by])
