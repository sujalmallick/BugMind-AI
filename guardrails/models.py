"""
guardrails/models.py — typed results shared by every guardrail.

None of these models ever carries a raw sensitive value: findings are reported
as entity names and counts, injection hits as rule ids.
"""

from enum import Enum

from pydantic import BaseModel, Field


class Decision(str, Enum):
    ALLOW = "allow"
    SANITIZE = "sanitize"
    BLOCK = "block"
    DENY = "deny"
    REQUIRE_CONFIRMATION = "require_confirmation"


class Source(str, Enum):
    """Trust origin of a piece of text."""

    USER = "user"              # typed by the authenticated user (direct input)
    DATABASE = "database"      # records read back from our DB (user-controlled earlier)
    RETRIEVED = "retrieved"    # RAG documents, PDFs, uploaded files
    EXTERNAL = "external"      # websites, search results, emails
    TOOL = "tool"              # tool / function results
    LLM = "llm"                # output of another agent or model
    SYSTEM = "system"          # developer-authored, trusted

    @property
    def is_direct(self) -> bool:
        return self is Source.USER


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class InjectionAssessment(BaseModel):
    score: float = 0.0
    signals: list[str] = Field(default_factory=list)  # rule ids only
    flagged: bool = False
    should_block: bool = False


class GuardrailResult(BaseModel):
    guardrail: str
    decision: Decision
    sanitized_text: str = ""
    entity_counts: dict[str, int] = Field(default_factory=dict)
    injection: InjectionAssessment | None = None
    reasons: list[str] = Field(default_factory=list)
    user_message: str | None = None

    @property
    def blocked(self) -> bool:
        return self.decision in (Decision.BLOCK, Decision.DENY)

    @property
    def modified(self) -> bool:
        return self.decision == Decision.SANITIZE

    def error_response(self) -> dict:
        """The API error shape the frontend already understands."""
        return {
            "success": False,
            "error": self.user_message or "Request blocked by safety checks.",
            "guardrail": self.guardrail,
        }


class ToolAuthorizationResult(BaseModel):
    tool_name: str
    decision: Decision
    risk: RiskLevel | None = None
    reasons: list[str] = Field(default_factory=list)
    sanitized_arguments: dict | None = None
    confirmation_token: str | None = None

    @property
    def allowed(self) -> bool:
        return self.decision == Decision.ALLOW

    @property
    def requires_confirmation(self) -> bool:
        return self.decision == Decision.REQUIRE_CONFIRMATION


class GuardrailViolation(Exception):
    """Raised when a guardrail blocks an operation mid-pipeline."""

    def __init__(self, guardrail: str, user_message: str, reasons: list[str] | None = None):
        super().__init__(user_message)
        self.guardrail = guardrail
        self.user_message = user_message
        self.reasons = reasons or []
