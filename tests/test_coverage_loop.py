"""
Coverage loop: a deterministic check finds what the generated test cases
missed, and one targeted LLM call fills only those gaps. Best-effort: a failed
fill never fails the analysis.
"""

import json

import pytest

from agents.coverage import REQUIRED_CATEGORIES, coverage_report, is_near_duplicate

MODULES = {"confirmed_modules": ["Authentication", "Payments"]}


def tc(module, category, description, steps=("Open app", "Do it"), expected="Works"):
    return {"module": module, "category": category, "description": description, "objective": "o",
            "preconditions": "p", "steps": list(steps), "inputData": "d", "expectedResult": expected,
            "priority": "High"}


FULL_SUITE = [
    tc("Authentication", "Functional", "Login with valid credentials"),
    tc("Authentication", "Security", "Account is locked after 5 failed login attempts"),
    tc("Payments", "Negative", "Expired card is declined at checkout"),
    tc("Payments", "Edge Case", "Pay exactly the maximum card limit"),
]


# ── Deterministic check ──────────────────────────────────────────────────────


def test_complete_suite_has_no_gaps():
    report = coverage_report(MODULES, ["Login then pay by card"], ["Failed login lockout", "Payments"], FULL_SUITE)
    assert report["gaps"] == []
    assert report["score"] == 1.0


def test_gaps_are_reported_by_kind():
    report = coverage_report(
        MODULES,
        critical_workflows=["Refund a cancelled order"],
        high_risk_areas=["Failed login lockout", "Currency conversion rounding"],
        test_cases=[tc("Authentication", "Functional", "Account locks after failed login attempts")],
    )
    gaps = {(g["kind"], g["target"]) for g in report["gaps"]}
    assert ("module", "Payments") in gaps
    assert ("critical_workflow", "Refund a cancelled order") in gaps
    assert ("high_risk_area", "Currency conversion rounding") in gaps
    assert ("high_risk_area", "Failed login lockout") not in gaps  # matched via "login"/"lock" stems
    assert {t for k, t in gaps if k == "category"} == set(REQUIRED_CATEGORIES) - {"Functional"}
    assert 0 < report["score"] < 1


def test_near_duplicate_detection():
    assert is_near_duplicate("Verify account lock after 5 failed attempts",
                             ["Verify account lock after 5 failed attempts!"])
    assert not is_near_duplicate("Expired card is declined", ["Verify account lock after 5 failed attempts"])


# ── Graph loop ───────────────────────────────────────────────────────────────

MODULE_JSON = json.dumps({
    "confirmed_modules": ["Authentication", "Payments"],
    "critical_workflows": ["Login then pay by card"],
    "high_risk_areas": ["Failed login lockout"],
})
CHECKLIST_JSON = json.dumps({"checklist": [
    {"module": "Authentication", "items": [{"id": "AUTH-001", "text": "Lockout after five failed logins"}]},
]})
# First pass only covers Authentication; Payments + several categories are missing.
FIRST_PASS = json.dumps({"test_cases": [
    {"module": "Authentication", "category": "Functional", "description": "Login with valid credentials",
     "steps": ["Open login", "Submit"], "expectedResult": "Dashboard shown"},
    {"module": "Authentication", "category": "Security", "description": "Account locks after 5 failed logins",
     "steps": ["Open login", "Fail 5 times"], "expectedResult": "Locked"},
]})
FILL = json.dumps({"test_cases": [
    {"module": "Payments", "category": "Negative", "description": "Expired card is declined when paying",
     "steps": ["Login", "Pay with expired card"], "expectedResult": "Declined"},
    {"module": "Payments", "category": "Edge Case", "description": "Pay exactly the card limit",
     "steps": ["Login", "Pay limit amount"], "expectedResult": "Approved"},
    # Duplicate of an existing case: must be dropped.
    {"module": "Authentication", "category": "Security", "description": "Account locks after 5 failed logins",
     "steps": ["Open login", "Fail 5 times"], "expectedResult": "Locked"},
]})


@pytest.fixture
def loop_on(monkeypatch):
    monkeypatch.setenv("COVERAGE_MAX_ROUNDS", "1")


def router(fill=FILL):
    def respond(messages):
        prompt = messages[-1]["content"]
        if "Principal AI Engineer" in prompt:
            return MODULE_JSON
        if "exploratory testing checklist" in prompt:
            return CHECKLIST_JSON
        if "fill coverage gaps" in prompt:
            if isinstance(fill, Exception):
                raise fill
            return fill
        if "production-ready manual test cases" in prompt:
            return FIRST_PASS
        return "{}"
    return respond


def run_graph():
    from graph import workflow_graph

    return workflow_graph.invoke({"user_id": None, "workflow": "User logs in and pays by card."})


def test_fill_round_adds_only_new_cases_with_continuing_ids(fake_llm, loop_on):
    fake_llm.responder = router()
    state = run_graph()

    ids = [t["id"] for t in state["test_cases"]]
    descriptions = [t["description"] for t in state["test_cases"]]
    assert ids == ["TC-001", "TC-002", "TC-003", "TC-004"]
    assert descriptions[:2] == ["Login with valid credentials", "Account locks after 5 failed logins"]  # untouched
    assert descriptions.count("Account locks after 5 failed logins") == 1                               # dup dropped
    assert all(t["status"] == "not-executed" for t in state["test_cases"])

    assert state["coverage_rounds"] == 1
    assert state["coverage"]["score"] > state["coverage_initial"]["score"]
    assert len(fake_llm.calls) == 4


def test_fill_prompt_contains_only_gaps_and_wraps_them_as_untrusted(fake_llm, loop_on):
    fake_llm.responder = router()
    run_graph()

    [fill_prompt] = [p for p in fake_llm.user_prompts() if "fill coverage gaps" in p]
    assert 'label="coverage_gaps"' in fill_prompt
    assert "module: Payments" in fill_prompt
    assert "module: Authentication" not in fill_prompt  # covered targets are not re-requested
    assert 'label="existing_test_cases"' in fill_prompt


def test_loop_is_off_by_default_but_coverage_is_still_logged(fake_llm, monkeypatch, caplog):
    import logging

    monkeypatch.delenv("COVERAGE_MAX_ROUNDS", raising=False)
    caplog.set_level(logging.INFO, logger="BugMind")
    fake_llm.responder = router()
    state = run_graph()

    assert len(fake_llm.calls) == 3
    assert [t["id"] for t in state["test_cases"]] == ["TC-001", "TC-002"]
    assert state["coverage"]["gaps"]
    [event] = [r.getMessage() for r in caplog.records if '"event":"coverage"' in r.getMessage()]
    assert "Payments" not in event  # gap counts only, never the model-written gap text


@pytest.mark.parametrize("failure", [
    RuntimeError("Error code: 429 - rate limit reached for tokens per minute"),
    RuntimeError("upstream exploded"),
])
def test_failed_fill_keeps_the_original_test_cases(fake_llm, loop_on, monkeypatch, failure):
    import utils

    monkeypatch.setattr(utils.time, "sleep", lambda s: None)
    fake_llm.responder = router(fill=failure)
    state = run_graph()

    assert [t["id"] for t in state["test_cases"]] == ["TC-001", "TC-002"]
    assert state["coverage_rounds"] == 1
    assert state["coverage"]["gaps"]  # still reported, just not filled


def test_garbage_fill_response_changes_nothing(fake_llm, loop_on):
    fake_llm.responder = router(fill="not json at all")
    state = run_graph()
    assert [t["id"] for t in state["test_cases"]] == ["TC-001", "TC-002"]


def test_loop_disabled_makes_no_extra_call(fake_llm, monkeypatch):
    monkeypatch.setenv("COVERAGE_MAX_ROUNDS", "0")
    fake_llm.responder = router()
    state = run_graph()

    assert len(fake_llm.calls) == 3
    assert state["coverage"]["gaps"]  # the check still runs and is logged


def test_rounds_are_capped(fake_llm, monkeypatch):
    """Even with gaps that never close, the loop stops at the cap (max 2)."""
    monkeypatch.setenv("COVERAGE_MAX_ROUNDS", "99")
    fake_llm.responder = router(fill=json.dumps({"test_cases": []}))
    state = run_graph()

    assert state["coverage_rounds"] == 2
    assert len(fake_llm.calls) == 5


def test_api_response_contract_is_unchanged_with_loop_on(client, fake_llm, loop_on):
    fake_llm.responder = router()
    body = client.post("/analyze-workflow", json={"workflow": "User logs in and pays by card."}).json()

    assert list(body) == ["success", "workflow", "confirmedModules", "assumedModules",
                          "criticalWorkflows", "highRiskAreas", "checklist", "testCases"]
    assert [t["id"] for t in body["testCases"]] == ["TC-001", "TC-002", "TC-003", "TC-004"]
