from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id: Mapped[int] = mapped_column(primary_key=True)

    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # owner | admin | member
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")

    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ── Relationships ────────────────────────────────────────────────────────
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="org_memberships")
