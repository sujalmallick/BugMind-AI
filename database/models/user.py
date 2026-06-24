from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from database.models.user_ai_settings import UserAISettings

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(String(100))

    

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

    password_hash: Mapped[str] = mapped_column(String(255))

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )