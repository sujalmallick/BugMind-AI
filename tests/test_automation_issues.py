"""
Failure → bug report: a failed automated result becomes an issue linked to the
test case, built only from known facts, once per failure.
"""

import json

import pytest

from database.models.issue import Issue
from test_automation import BASE, GOOD_STEPS, auto, create_env  # noqa: F401 — auto is a fixture
from test_automation_heal import failed  # noqa: F401 — failed is a fixture
from test_automation_runs import upload
from test_knowledge_rag import env  # noqa: F401 — env is a fixture


def create(env, run_id=None, script_id=None):
    run_id = run_id or env.heal["run"]
    script_id = script_id or env.heal["script"]
    return env.client.post(f"{BASE}/runs/{run_id}/results/{script_id}/issue")


def test_failed_result_becomes_a_linked_bug_report(failed):
    body = create(failed).json()
    assert body["created"] is True and body["bugId"].startswith("BUG-")
    issue = failed.db.get(Issue, body["issueId"])
    assert issue.test_case_id == 50                                   # linked to TC-001
    assert issue.title == "TC-001: Login fails at step 4"
    assert issue.severity == "High" and issue.priority == "High"      # from the test case priority
    assert issue.reproduction_steps.splitlines() == [
        "1. Open login",
        '2. fill "Email" "{{vars.USER_EMAIL}}"',
        '3. fill "Password" "{{vars.USER_PASSWORD}}"',
        '4. click button "Sign in"  ← failed here',
    ]
    assert issue.expected_result == "User lands on the dashboard"
    assert issue.actual_result.startswith("locator.click: Timeout")
    assert "Automated run #" in issue.description and "Page: https://shop.example.com/login" in issue.description
    assert issue.reporter_id == 1
    assert issue.custom_fields["source"] == "automation"
    assert "s3cret" not in json.dumps([issue.description, issue.reproduction_steps])

    run = failed.client.get(f"{BASE}/runs/{failed.heal['run']}").json()
    assert run["results"][0]["issueId"] == body["issueId"]


def test_one_report_per_failure(failed):
    first = create(failed).json()
    again = create(failed).json()
    assert again == {**first, "created": False}
    assert failed.db.query(Issue).filter(Issue.test_case_id == 50).count() == 1


def test_a_deleted_report_can_be_created_again(failed):
    first = create(failed).json()
    failed.db.delete(failed.db.get(Issue, first["issueId"]))
    failed.db.commit()
    assert create(failed).json()["created"] is True


@pytest.mark.parametrize("case, status", [("passed", 409), ("viewer", 403), ("missing-run", 404),
                                          ("other-script", 404)])
def test_preconditions(failed, case, status):
    sid = failed.heal["script"]
    run_id = None
    script_id = None
    if case == "passed":
        report = {"suites": [{"specs": [{"title": f"Login [BM-{sid} v1]", "tests": [{"status": "expected"}]}]}]}
        run_id = upload(failed, json.dumps(report).encode()).json()["id"]
    elif case == "viewer":
        failed.as_user(2)
    elif case == "missing-run":
        run_id = 999_999
    else:
        script_id = 999_999
    assert create(failed, run_id, script_id).status_code == status
    assert failed.db.query(Issue).filter(Issue.test_case_id == 50).count() == 0


def test_describe_step_reads_naturally():
    from services.automation_issues import describe_step

    assert describe_step({"action": "click", "target": {"by": "role", "value": "button", "name": "Pay"}}) == 'click button "Pay"'
    assert describe_step({"action": "expect_url", "value": "/done"}) == 'expect url "/done"'
    assert describe_step({"action": "goto", "value": "/", "description": "Open home"}) == "Open home"
