import secrets
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Secure random token used in share links
    token: Mapped[str] = mapped_column(
        String(128), unique=True, nullable=False, index=True,
        default=lambda: secrets.token_urlsafe(64)
    )

    # 'project' or 'organization'
    type: Mapped[str] = mapped_column(String(20), nullable=False)

    # ID of the project or organization being invited to
    target_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # Role to grant upon acceptance
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")

    # Optional email for directed invites (NULL for generic share links)
    invited_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    invited_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    accepted_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # pending | accepted | declined | revoked | expired
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    inviter = relationship("User", foreign_keys=[invited_by])
    accepter = relationship("User", foreign_keys=[accepted_by])
