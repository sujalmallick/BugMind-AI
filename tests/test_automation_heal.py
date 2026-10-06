"""
Self-healing (free): exported tests capture a redacted page snapshot on failure,
the upload keeps it (masked), and the heal endpoint proposes locator fixes that
must exist on that page. Assertions are never changed.
"""

import base64
import json

import pytest

from test_automation import BASE, GOOD_STEPS, auto, create_env  # noqa: F401 — auto is a fixture
from test_automation_runs import upload  # noqa: F401
from test_knowledge_rag import env  # noqa: F401 — env is a fixture

SNAPSHOT = """- heading "Welcome back" [level=1]
- textbox "Email address"
- textbox "Password"
- button "Log in"
- link "Forgot password?"
- text: Signed in as jane.doe@gmail.com"""


@pytest.fixture
def failed(auto):
    """An approved login script (v1) and an uploaded run where step 4 failed, with a snapshot."""
    env_id = create_env(auto).json()["id"]
    script = auto.client.post(f"{BASE}/scripts", json={"name": "Login", "steps": GOOD_STEPS,
                                                       "environment_id": env_id, "test_case_id": 50}).json()
    auto.client.patch(f"{BASE}/scripts/{script['id']}", json={"status": "approved"})
    page = base64.b64encode(json.dumps({"url": "https://shop.example.com/login", "snapshot": SNAPSHOT}).encode()).decode()
    report = {"stats": {}, "suites": [{"specs": [{"title": f"TC-001 Login [BM-{script['id']} v1]", "tests": [{
        "status": "unexpected",
        "results": [{"status": "failed", "duration": 900,
                     "error": {"message": "locator.click: Timeout waiting for getByRole('button', { name: 'Sign in' })"},
                     "steps": [{"title": "[S1] Open login"}, {"title": "[S2] fill"}, {"title": "[S3] fill"},
                               {"title": "[S4] click", "error": {"message": "Timeout"}}],
                     "attachments": [{"name": "trace", "contentType": "application/zip", "path": "/tmp/trace.zip"},
                                     {"name": "bugmind-page", "contentType": "application/json", "body": page}]}],
    }]}]}]}
    run = upload(auto, json.dumps(report).encode()).json()
    auto.heal = {"script": script["id"], "run": run["id"], "env": env_id}
    return auto


def answer(fake_llm, changes, verdict="locator", summary="The button is called Log in."):
    fake_llm.responder = lambda messages: json.dumps({"verdict": verdict, "summary": summary,
                                                      "changes": changes, "notes": []})


def heal(env, **overrides):
    body = {"run_id": env.heal["run"], **overrides}
    return env.client.post(f"{BASE}/scripts/{env.heal['script']}/heal", json=body)


# ── Capture ──────────────────────────────────────────────────────────────────

def test_export_captures_a_redacted_snapshot_on_failure(failed):
    code = failed.client.get(f"{BASE}/scripts/{failed.heal['script']}/export").text
    assert "test.afterEach" in code and "'bugmind-page'" in code and "ariaSnapshot" in code
    assert 'const VARS: string[] = ["USER_EMAIL", "USER_PASSWORD"];' in code
    assert '"[S4] click"' in code                       # numbered steps say where a run failed
    assert "s3cret" not in code and "qa@example.com" not in code


def test_upload_keeps_the_failed_step_and_a_masked_snapshot(failed):
    run = failed.client.get(f"{BASE}/runs/{failed.heal['run']}").json()
    result = run["results"][0]
    assert result["failedStep"] == 4
    assert result["page"]["url"] == "https://shop.example.com/login"
    assert 'button "Log in"' in result["page"]["snapshot"]
    assert "jane.doe@gmail.com" not in result["page"]["snapshot"]     # personal data masked before storing


def test_broken_or_oversized_attachments_are_ignored():
    from services.automation_results import parse_report

    def report(body):
        return json.dumps({"suites": [{"specs": [{"title": "x [BM-1 v1]", "tests": [{"status": "unexpected", "results": [
            {"attachments": [{"name": "bugmind-page", "body": body}]}]}]}]}]}).encode()
    for body in ("not base64!!", base64.b64encode(b"not json").decode(), "A" * 200_000, 42):
        assert parse_report(report(body))["tests"][0]["page"] is None


# ── Healing ──────────────────────────────────────────────────────────────────

def test_verified_fixes_are_proposed_and_hallucinated_ones_dropped(failed, fake_llm):
    answer(fake_llm, [
        {"step": 4, "target": {"by": "role", "value": "button", "name": "Log in"}, "reason": "Renamed button"},
        {"step": 2, "target": {"by": "label", "value": "Email address"}, "reason": "Label changed"},
        {"step": 3, "target": {"by": "role", "value": "button", "name": "Continue"}, "reason": "made up"},
        {"step": 1, "target": {"by": "role", "value": "link", "name": "Forgot password?"}},     # goto has no target
        {"step": 9, "target": {"by": "text", "value": "Log in"}},                               # no such step
        {"step": 5, "target": {"by": "css", "value": "#dashboard"}},                            # unverifiable
    ])
    body = heal(failed).json()

    assert body["success"] is True and body["verdict"] == "locator"
    assert [(c["step"], c["after"]) for c in body["changes"]] == [
        (4, {"by": "role", "value": "button", "name": "Log in"}),
        (2, {"by": "label", "value": "Email address"}),
    ]
    assert body["changes"][0]["before"] == {"by": "role", "value": "button", "name": "Sign in"}
    assert any('"Continue" isn\'t on the page' in r for r in body["rejected"])
    assert any("Step 1 has no element" in r for r in body["rejected"])
    assert body["steps"][3]["target"]["name"] == "Log in" and body["steps"][4] == GOOD_STEPS[4] | {"match": "contains"}
    assert body["basedOnVersion"] == 1


def test_healing_never_changes_what_a_test_expects(failed, fake_llm):
    answer(fake_llm, [{"step": 5, "action": "expect_url", "value": "/login", "target": {"by": "text", "value": "Log in"}}])
    body = heal(failed).json()
    # expect_url has no element; even a "fix" can't rewrite the expected URL.
    assert body["changes"] == [] and body["steps"][4]["value"] == "/dashboard"


def test_real_bug_verdict_proposes_nothing(failed, fake_llm):
    answer(fake_llm, [], verdict="real_bug", summary="The page shows an error instead of the dashboard.")
    body = heal(failed).json()
    assert body["verdict"] == "real_bug" and body["changes"] == []


def test_prompt_treats_the_page_as_untrusted_and_has_no_secrets(failed, fake_llm):
    answer(fake_llm, [])
    heal(failed)
    prompt = fake_llm.user_prompts()[-1]
    assert "page_snapshot" in prompt and 'button \\"Log in\\"' not in prompt and 'button "Log in"' in prompt
    assert "s3cret" not in prompt


@pytest.mark.parametrize("case", ["passed", "changed", "no-snapshot", "viewer", "missing-run"])
def test_heal_preconditions(failed, fake_llm, case):
    answer(fake_llm, [])
    sid = failed.heal["script"]
    if case == "passed":
        report = {"suites": [{"specs": [{"title": f"Login [BM-{sid} v1]", "tests": [{"status": "expected"}]}]}]}
        failed.heal["run"] = upload(failed, json.dumps(report).encode()).json()["id"]
        expected = 409
    elif case == "changed":
        failed.client.patch(f"{BASE}/scripts/{sid}", json={"steps": GOOD_STEPS[:4]})
        expected = 409
    elif case == "no-snapshot":
        report = {"suites": [{"specs": [{"title": f"Login [BM-{sid} v1]", "tests": [{"status": "unexpected",
                                                                                    "results": [{"status": "failed"}]}]}]}]}
        failed.heal["run"] = upload(failed, json.dumps(report).encode()).json()["id"]
        expected = 409
    elif case == "viewer":
        failed.as_user(2)
        expected = 403
    else:
        failed.heal["run"] = 999_999
        expected = 404
    calls = len(fake_llm.calls)
    assert heal(failed).status_code == expected
    assert len(fake_llm.calls) == calls


def test_found_on_page_matches_roles_names_and_text():
    from services.automation_heal import found_on_page

    assert found_on_page({"by": "role", "value": "button", "name": "Log in"}, SNAPSHOT)
    assert found_on_page({"by": "role", "value": "heading"}, SNAPSHOT)
    assert not found_on_page({"by": "role", "value": "button", "name": "Log"}, SNAPSHOT)
    assert found_on_page({"by": "label", "value": "Password"}, SNAPSHOT)
    assert found_on_page({"by": "text", "value": "forgot password"}, SNAPSHOT)
    assert not found_on_page({"by": "testid", "value": "login"}, SNAPSHOT)
