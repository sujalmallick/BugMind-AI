from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(primary_key=True)

    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # team_lead | member
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")

    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ── Relationships ────────────────────────────────────────────────────────
    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")
