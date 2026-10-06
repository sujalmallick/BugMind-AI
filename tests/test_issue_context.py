"""
Issue analysis with project context: the failing test case goes into the
prompt, possible duplicates come back from a local keyword search, and both
are scoped to a project the caller can view.
"""

import json
from types import SimpleNamespace

import pytest

from database.models.issue import Issue
from database.models.project import Project
from database.models.project_member import ProjectMember
from database.models.test_case import TestCase
from database.models.user import User
from database.models.workspace import Workspace
from test_workload_tool_guardrail import make

BUG = json.dumps({"reportType": "Bug", "title": "Checkout fails with expired card",
                  "bugType": "Functional", "severity": "High", "priority": "High"})
REQUEST = {
    "workflow": "Shoppers pay by card at checkout.",
    "observation": "Checkout crashes when paying with an expired credit card",
    "expected_result": "A clear card declined message",
    "actual_result": "Blank error page",
    "failed_test_case": True,
}


@pytest.fixture
def project(db_session):
    db = db_session
    owner = make(db, User, id=1, name="Alice", email="alice@corp.io", username="alice")
    viewer = make(db, User, id=2, name="Vic", email="vic@corp.io", username="vic")
    make(db, User, id=3, name="Eve", email="eve@corp.io", username="eve")
    p1 = make(db, Project, id=1, owner_id=owner.id, name="Shop")
    p2 = make(db, Project, id=2, owner_id=3, name="Other")
    make(db, ProjectMember, project_id=p1.id, user_id=viewer.id, role="viewer")
    ws1 = make(db, Workspace, project_id=p1.id)
    ws2 = make(db, Workspace, project_id=p2.id)
    tc = make(db, TestCase, id=11, workspace_id=ws1.id, test_case_id="TC-003", module="Payments",
              description="Pay with an expired card", preconditions="Cart has items",
              steps="Open checkout\nEnter expired card\nClick Pay", expected_result="Card declined message")
    other_tc = make(db, TestCase, id=21, workspace_id=ws2.id, test_case_id="TC-003", module="X", description="x")
    make(db, Issue, id=101, test_case_id=tc.id, bug_id="BUG-1", title="Checkout crash with expired credit card",
         description="Paying with an expired card crashes checkout", status="Open")
    make(db, Issue, id=102, test_case_id=tc.id, bug_id="BUG-2", title="Avatar upload is slow",
         description="Profile picture takes 10s", status="Open")
    make(db, Issue, id=201, test_case_id=other_tc.id, bug_id="BUG-9", title="Checkout crash with expired credit card",
         description="Other project's identical bug", status="Open")
    db.commit()
    return {"db": db, "tc": tc}


@pytest.fixture
def as_user(client):
    import main
    from auth.dependencies import get_current_user

    def use(user_id):
        main.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id, email="qa@corp.io")
    return use


@pytest.fixture
def issue_llm(fake_llm, agent_router):
    fake_llm.responder = agent_router(issue=BUG)
    return fake_llm


def test_without_project_the_response_contract_is_unchanged(client, issue_llm):
    body = client.post("/analyze-issue", json=REQUEST).json()
    assert list(body) == ["reportType", "title", "bugType", "severity", "priority"]
    assert 'label="failing_test_case"' not in issue_llm.user_prompts()[0]


def test_failing_test_case_and_duplicates_with_project(client, project, issue_llm, as_user):
    as_user(2)  # viewer is enough
    body = client.post("/analyze-issue", json={**REQUEST, "project_id": 1, "test_case_ref": "tc-003"}).json()

    assert body["title"] == "Checkout fails with expired card"
    assert body["linkedTestCase"] == {"dbId": 11, "id": "TC-003"}
    dupes = body["possibleDuplicates"]
    assert [d["id"] for d in dupes] == [101]            # same project only; unrelated issue filtered out
    assert dupes[0]["bugId"] == "BUG-1" and dupes[0]["similarity"] >= 0.3

    prompt = issue_llm.user_prompts()[0]
    assert 'label="failing_test_case"' in prompt
    assert "2. Enter expired card" in prompt
    assert "Expected Result: Card declined message" in prompt
    assert "Avatar upload" not in prompt                 # duplicates are never sent to the LLM


def test_unknown_test_case_ref_still_classifies(client, project, issue_llm, as_user):
    as_user(1)
    body = client.post("/analyze-issue", json={**REQUEST, "project_id": 1, "test_case_ref": "TC-999"}).json()
    assert body["linkedTestCase"] is None
    assert body["title"] == "Checkout fails with expired card"


@pytest.mark.parametrize("extra", [{"test_case_ref": "TC-003"}, {}])
def test_project_the_user_cannot_see_is_rejected_before_any_llm_call(client, project, issue_llm, as_user, extra):
    as_user(3)  # Eve is not in project 1
    res = client.post("/analyze-issue", json={**REQUEST, "project_id": 1, **extra})
    assert res.status_code == 403
    assert issue_llm.calls == []


def test_ai_errors_are_returned_without_context_fields(client, project, fake_llm, as_user, monkeypatch):
    import utils

    monkeypatch.setattr(utils.time, "sleep", lambda s: None)

    def fail(messages):
        raise RuntimeError("401 Unauthorized: invalid api key")

    fake_llm.responder = fail
    as_user(1)
    body = client.post("/analyze-issue", json={**REQUEST, "project_id": 1}).json()
    assert body == {"success": False, "error": "Invalid or missing API Key.", "code": "auth"}


# ── Service level ────────────────────────────────────────────────────────────


def test_similarity_search_is_ranked_bounded_and_ignores_empty_text(project):
    from services.project_context import find_similar_issues

    db = project["db"]
    assert find_similar_issues(db, 1, 1, "") == []
    assert find_similar_issues(db, 1, 1, "the and with") == []  # stopwords only
    results = find_similar_issues(db, 1, 1, "expired credit card crash at checkout", threshold=0.0)
    assert [r["id"] for r in results] == [101, 102]
    assert results[0]["similarity"] > results[1]["similarity"]


@pytest.mark.parametrize("linked, expected_tc", [
    (11, 11),               # this project's test case → linked
    (21, "default"),        # another project's test case → ignored
    ("11", "default"),      # strings are not ids (the frontend used to send the observation here)
    (True, "default"),
    (None, "default"),
])
def test_save_issue_links_only_this_projects_test_case(project, linked, expected_tc):
    from services.issue_service import save_issue

    issue = save_issue(project["db"], project_id=1, owner_id=1,
                       issue={"title": "Bug", "linked_test_case_id": linked})
    if expected_tc == "default":
        default = project["db"].query(TestCase).filter(TestCase.test_case_id == "IMPORT-DEFAULT").one()
        assert issue.test_case_id == default.id
    else:
        assert issue.test_case_id == expected_tc
