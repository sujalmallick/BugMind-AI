"""Automation dashboard numbers: trend, failing / flaky scripts, coverage and gaps."""

import json

from database.models.test_case import TestCase
from database.models.workspace import Workspace
from test_automation import BASE, GOOD_STEPS, auto, create_env  # noqa: F401 — auto is a fixture
from test_automation_runs import upload
from test_knowledge_rag import env  # noqa: F401 — env is a fixture
from test_workload_tool_guardrail import make


def report(*outcomes):
    """outcomes: (script_id, playwright_status)"""
    return json.dumps({"suites": [{"specs": [
        {"title": f"s [BM-{sid} v1]", "tests": [{"status": status}]} for sid, status in outcomes]}]}).encode()


def test_summary(auto):
    from services.automation_summary import pass_rate

    ws = auto.db.query(Workspace).filter(Workspace.project_id == 1).first()
    make(auto.db, TestCase, id=51, workspace_id=ws.id, test_case_id="TC-002", module="Cart", category="Functional",
         priority="Low", description="Apply coupon", is_manual=False)
    make(auto.db, TestCase, id=52, workspace_id=ws.id, test_case_id="TC-003", module="Pay", category="Functional",
         priority="High", description="Pay by card", is_manual=False)
    auto.db.commit()
    env_id = create_env(auto).json()["id"]
    ids = []
    for name, case in (("Login", 50), ("Logout", None)):
        sid = auto.client.post(f"{BASE}/scripts", json={"name": name, "steps": GOOD_STEPS, "environment_id": env_id,
                                                        "test_case_id": case}).json()["id"]
        auto.client.patch(f"{BASE}/scripts/{sid}", json={"status": "approved"})
        ids.append(sid)
    login, logout = ids
    upload(auto, report((login, "unexpected"), (logout, "expected")))
    upload(auto, report((login, "unexpected"), (logout, "flaky")))
    upload(auto, report((login, "expected"), (logout, "expected")))

    body = auto.client.get(f"{BASE}/summary").json()
    assert body["counts"] == {"scripts": 2, "approved": 2, "environments": 1, "testCases": 3,
                              "automatedTestCases": 1, "runs30d": 3}
    assert [t["passRate"] for t in body["trend"]] == [0.5, 0.5, 1.0]            # oldest first
    assert body["lastRun"]["passRate"] == 1.0
    assert body["failing"] == [{"scriptId": login, "name": "Login", "count": 2, "runs": 3, "lastStatus": "passed"}]
    assert body["flaky"][0]["scriptId"] == logout
    assert body["notAutomatedCount"] == 2
    assert [c["code"] for c in body["notAutomated"]] == ["TC-003", "TC-002"]     # high priority first

    assert pass_rate({"skipped": 3}) is None


def test_empty_project_and_access(auto):
    body = auto.client.get(f"{BASE}/summary").json()
    assert body["lastRun"] is None and body["trend"] == [] and body["counts"]["scripts"] == 0
    auto.as_user(2)  # viewer
    assert auto.client.get(f"{BASE}/summary").status_code == 200
    auto.as_user(3)  # not a member
    assert auto.client.get(f"{BASE}/summary").status_code in (403, 404)
