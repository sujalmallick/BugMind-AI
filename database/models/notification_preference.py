from sqlalchemy import Boolean, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "type", name="uq_user_id_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    
    # 'mention', 'assignment', 'invite', 'comment'
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    via_email: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
