from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from database.base import Base

class AIAssignmentSuggestion(Base):
    __tablename__ = "ai_assignment_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    suggestions = Column(JSONB, nullable=False)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    applied_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project")
    requester = relationship("User")
