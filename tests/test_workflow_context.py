"""
Workflow analysis with project context: the project's manual test cases are
loaded server-side, shown to the test case agent as already covered, never
duplicated in the output, and counted by the coverage check.
"""

import json
from types import SimpleNamespace

import pytest

from database.models.project import Project
from database.models.test_case import TestCase
from database.models.user import User
from database.models.workspace import Workspace
from test_workload_tool_guardrail import make

MODULES = json.dumps({"confirmed_modules": ["Authentication", "Payments"], "critical_workflows": [],
                      "high_risk_areas": []})
CHECKLIST = json.dumps({"checklist": [{"module": "Authentication", "items": [{"text": "Lockout"}]}]})
GENERATED = json.dumps({"test_cases": [
    {"module": "Authentication", "category": "Security", "description": "Account locks after five failed logins",
     "steps": ["Open login", "Fail 5 times"], "expectedResult": "Locked"},
    # Near-copy of the manual case below: must be dropped.
    {"module": "Payments", "category": "Negative", "description": "Expired card is declined at checkout",
     "steps": ["Pay with expired card", "Submit"], "expectedResult": "Declined"},
    {"module": "Authentication", "category": "Functional", "description": "Login with valid credentials",
     "steps": ["Open login", "Submit"], "expectedResult": "Dashboard"},
]})
WORKFLOW = {"workflow": "Users log in and pay by card at checkout."}


@pytest.fixture
def project(db_session):
    db = db_session
    make(db, User, id=1, name="Alice", email="alice@corp.io", username="alice")
    make(db, User, id=3, name="Eve", email="eve@corp.io", username="eve")
    p1 = make(db, Project, id=1, owner_id=1, name="Shop")
    p2 = make(db, Project, id=2, owner_id=3, name="Other")
    ws1 = make(db, Workspace, project_id=p1.id)
    ws2 = make(db, Workspace, project_id=p2.id)
    make(db, TestCase, id=11, workspace_id=ws1.id, test_case_id="MANUAL-PAY", is_manual=True, module="Payments",
         category="Negative", description="Expired card is declined at checkout!", steps="Pay\nSubmit",
         expected_result="Declined")
    make(db, TestCase, id=12, workspace_id=ws1.id, test_case_id="IMPORT-DEFAULT", is_manual=True, module="General",
         description="Auto-created for CSV-imported issues")
    make(db, TestCase, id=13, workspace_id=ws1.id, test_case_id="TC-001", is_manual=False, module="Authentication",
         description="Previously generated AI case")
    make(db, TestCase, id=21, workspace_id=ws2.id, test_case_id="MANUAL-X", is_manual=True, module="X",
         description="Other project's secret manual case")
    db.commit()
    return db


@pytest.fixture
def as_user(client):
    import main
    from auth.dependencies import get_current_user

    def use(user_id):
        main.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id, email="qa@corp.io")
    return use


@pytest.fixture
def llm(fake_llm, agent_router):
    fake_llm.responder = agent_router(module=MODULES, checklist=CHECKLIST, test_cases=GENERATED)
    return fake_llm


def _test_case_prompt(fake_llm):
    [prompt] = [p for p in fake_llm.user_prompts() if "production-ready manual test cases" in p]
    return prompt


def test_without_project_nothing_changes(client, llm):
    body = client.post("/analyze-workflow", json=WORKFLOW).json()
    assert 'label="manual_test_cases"' not in _test_case_prompt(llm)
    assert len(body["testCases"]) == 3  # no filtering without manual cases


def test_manual_cases_are_shown_and_duplicates_dropped(client, project, llm, as_user):
    as_user(1)
    body = client.post("/analyze-workflow", json={**WORKFLOW, "project_id": 1}).json()

    assert list(body) == ["success", "workflow", "confirmedModules", "assumedModules",
                          "criticalWorkflows", "highRiskAreas", "checklist", "testCases"]
    descriptions = [tc["description"] for tc in body["testCases"]]
    assert "Expired card is declined at checkout" not in descriptions        # near-copy of a manual case
    assert [tc["id"] for tc in body["testCases"]] == ["TC-001", "TC-002"]     # renumbered without gaps

    prompt = _test_case_prompt(llm)
    assert 'label="manual_test_cases"' in prompt
    assert "[Payments] Expired card is declined at checkout!" in prompt
    assert "Auto-created for CSV-imported issues" not in prompt  # placeholder row excluded
    assert "Previously generated AI case" not in prompt         # only manual cases
    assert "Other project's secret manual case" not in prompt    # project-scoped


def test_project_the_user_cannot_see_is_rejected_before_any_llm_call(client, project, llm, as_user):
    as_user(3)
    res = client.post("/analyze-workflow", json={**WORKFLOW, "project_id": 1})
    assert res.status_code == 403
    assert llm.calls == []


def test_coverage_counts_manual_cases(fake_llm, agent_router):
    """Payments is only covered by a manual case: not a gap, so no fill-in is needed for it."""
    from graph import workflow_graph

    only_auth = json.dumps({"test_cases": [
        {"module": "Authentication", "category": "Functional", "description": "Login works",
         "steps": ["a", "b"], "expectedResult": "ok"}]})
    fake_llm.responder = agent_router(module=MODULES, checklist=CHECKLIST, test_cases=only_auth)
    manual = [{"id": "MANUAL-PAY", "module": "Payments", "category": "Negative",
               "description": "Expired card is declined", "steps": ["Pay"], "expectedResult": "Declined"}]

    without = workflow_graph.invoke({"user_id": None, "workflow": "w"})
    with_manual = workflow_graph.invoke({"user_id": None, "workflow": "w", "project_test_cases": manual})

    gap_targets = lambda state: {(g["kind"], g["target"]) for g in state["coverage"]["gaps"]}  # noqa: E731
    assert ("module", "Payments") in gap_targets(without)
    assert ("module", "Payments") not in gap_targets(with_manual)
    assert ("category", "Negative") not in gap_targets(with_manual)
    assert [tc["id"] for tc in with_manual["test_cases"]] == ["TC-001"]  # manual cases are context, not output


def test_manual_case_lookup_is_capped(project):
    from services.project_context import get_manual_test_cases

    cases = get_manual_test_cases(project, user_id=1, project_id=1)
    assert [c["id"] for c in cases] == ["MANUAL-PAY"]
    assert cases[0]["steps"] == ["Pay", "Submit"]
    assert get_manual_test_cases(project, user_id=1, project_id=1, limit=0) == []
