from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class AutomationEnvironment(Base):
    """A website automated tests run against: its URL, where navigation may go, and test variables."""

    __tablename__ = "automation_environments"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    name: Mapped[str] = mapped_column(String(100))
    base_url: Mapped[str] = mapped_column(String(500))
    # Hosts navigation may reach: the base URL's host first, then extras ("*.example.com" allowed).
    allowed_domains: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    # [{"name", "secret": bool, "value"} | {"name", "secret": true, "encrypted"}]; secrets are
    # Fernet-encrypted and never returned by the API or put in a prompt.
    variables: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AutomationScript(Base):
    """
    An end-to-end test as structured steps (services/automation_actions.py), not code.
    draft → approved by a person; any change to the steps sends it back to draft.
    """

    __tablename__ = "automation_scripts"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    test_case_id: Mapped[int | None] = mapped_column(
        ForeignKey("test_cases.id", ondelete="SET NULL"), nullable=True, index=True)
    environment_id: Mapped[int | None] = mapped_column(
        ForeignKey("automation_environments.id", ondelete="SET NULL"), nullable=True)

    name: Mapped[str] = mapped_column(String(200))
    steps: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    # "ai" or "manual"; for AI drafts, what the generator noted or dropped: {"notes": [...], "dropped": [...]}.
    origin: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    generation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
