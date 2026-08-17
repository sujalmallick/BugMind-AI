from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)

    # The recipient of the notification
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # The actor who triggered the notification (optional, useful for collaboration)
    actor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Type of notification: 'system', 'invite', 'mention', 'alert'
    type: Mapped[str] = mapped_column(String(50), default="system")
    
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(String(1000))
    
    # Optional URL to navigate to when the notification is clicked
    action_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Added for Phase 6.6
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    project_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    org_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)

    is_read: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    actor = relationship("User", foreign_keys=[actor_id])
