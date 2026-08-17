"""
database/models/activity_log.py

Immutable audit log for every meaningful action taken in BugMind AI.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database.base import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Who did it
    actor_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # What happened — past-tense verb slug e.g. 'created_test_case', 'assigned_issue'
    verb: Mapped[str] = mapped_column(String(100), nullable=False)

    # What was affected
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'test_case'|'issue'|'member'|...
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    entity_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # denormalized name

    # Scope — either or both can be NULL depending on context
    project_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    org_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Extra JSON context (old_status → new_status, old_assignee → new_assignee, etc.)
    meta: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True,
    )

    # Relationships
    actor = relationship("User", foreign_keys=[actor_id], lazy="joined")
