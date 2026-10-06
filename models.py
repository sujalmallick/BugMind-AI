from pydantic import BaseModel, Field
from typing import TypedDict


class TargetEnvironment(BaseModel):
    """What the user is testing on (the workspace's environment fields)."""

    platform: str | None = Field(None, max_length=50)
    os_version: str | None = Field(None, max_length=50)
    build: str | None = Field(None, max_length=100)
    device: str | None = Field(None, max_length=100)


class WorkflowInput(BaseModel):
    workflow: str = Field(
        min_length=5,
        description="Application workflow"
    )

    observed_steps: list[str] | None = Field(None, max_length=100)
    existing_checklist: list[dict] | None = None
    existing_test_cases: list[dict] | None = None

    # Optional: lets the agents see the project's manual test cases and documents (viewer role required).
    project_id: int | None = None
    environment: TargetEnvironment | None = None


class WorkflowState(TypedDict, total=False):
    # User Input
    user_id: int | None
    workflow: str
    observed_steps: list[str] | None
    existing_checklist: list[dict] | None
    existing_test_cases: list[dict] | None

    # Project context (server-loaded, read-only)
    project_test_cases: list[dict]
    project_knowledge: list[dict]   # retrieved document excerpts (RAG)
    test_environment: dict          # platform / OS / build / device

    # Shared Agent Knowledge
    modules: dict
    critical_workflows: list[str]
    high_risk_areas: list[str]

    # Agent Outputs
    checklist: list[dict] | dict | None
    test_cases: list[dict] | dict | None

    # Coverage loop
    coverage: dict
    coverage_initial: dict
    coverage_rounds: int

class IssueInput(BaseModel):
    workflow: str

    observation: str

    expected_result: str | None = None

    actual_result: str | None = None

    failed_test_case: bool

    # Optional project context: enables duplicate detection and the failing test case's details.
    project_id: int | None = None
    test_case_ref: str | None = Field(None, max_length=30)