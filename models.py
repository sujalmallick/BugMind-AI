from pydantic import BaseModel, Field
from typing import TypedDict


class WorkflowInput(BaseModel):
    workflow: str = Field(
        min_length=5,
        description="Application workflow"
    )

    observed_steps: list[str] | None = None
    existing_checklist: list[dict] | None = None
    existing_test_cases: list[dict] | None = None


class WorkflowState(TypedDict):

    # User Input
    workflow: str
    observed_steps: list[str] | None
    existing_checklist: list[dict] | None
    existing_test_cases: list[dict] | None

    # Shared Agent Knowledge
    modules: dict
    critical_workflows: list[str]
    high_risk_areas: list[str]

    # Agent Outputs
    checklist: str
    test_cases: str

class IssueInput(BaseModel):
    workflow: str

    observation: str

    expected_result: str | None = None

    actual_result: str | None = None

    failed_test_case: bool