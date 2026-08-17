from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base


class UserAISettings(Base):
    __tablename__ = "user_ai_settings"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
    )

    provider: Mapped[str] = mapped_column(
        String(50),
        default="gemini",
        nullable=False,
    )

    model: Mapped[str] = mapped_column(
        String(100),
        default="gemini-2.5-flash",
        nullable=False,
    )

    provider_keys: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
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

    user = relationship(
        "User",
        back_populates="ai_settings"
    )