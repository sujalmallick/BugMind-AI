"""
Quality eval harness: scorers, dataset validity, harness/endpoint parity, and
a hermetic end-to-end CLI run. The real-model run (python -m evals.run) is
manual because it spends provider quota.
"""

import copy
import json
import re

import pytest

from evals.harness import aggregate, compare_to_baseline, evaluate, load_cases, run_pipeline
from evals.scorers import CATEGORIES, QUALITY_METRICS, score_result

EXPECT = {
    "modules": ["log ?in|auth", "payment"],
    "risks": ["lock", "card"],
    "categories": ["Negative", "Security"],
    "test_cases": [2, 10],
}


def tc(description, category="Functional", steps=("Open app", "Do thing"), expected="It works"):
    return {"module": "Auth", "category": category, "description": description, "objective": "o",
            "preconditions": "p", "steps": list(steps), "inputData": "d", "expectedResult": expected,
            "priority": "High", "id": "TC-001", "status": "not-executed"}


GOOD = {
    "success": True,
    "confirmedModules": ["Login", "Payments"],
    "assumedModules": [],
    "checklist": [{"module": "Login", "items": []}, {"module": "Payments", "items": []}],
    "testCases": [
        tc("Verify account lock after 5 failed attempts", "Security"),
        tc("Reject expired card at payment", "Negative"),
        tc("Pay with a valid card"),
    ],
}

# ── Scorers ──────────────────────────────────────────────────────────────────


def test_good_result_scores_perfectly():
    s = score_result(GOOD, EXPECT)
    assert s["ok"] and s["test_case_count_in_range"]
    assert {m: s[m] for m in QUALITY_METRICS} == {m: 1.0 for m in QUALITY_METRICS}
    assert s["quality"] == 1.0


def test_partial_results_lower_specific_metrics():
    r = copy.deepcopy(GOOD)
    r["confirmedModules"] = ["Login"]                         # payment module missing
    r["testCases"] = [
        tc("Verify account lock after 5 failed attempts", "Security"),
        tc("Verify account lock after 5 failed attempts!", "Security"),  # near-duplicate
        tc("Perform test case execution", steps=["One step"], expected="System responds correctly"),
    ]
    s = score_result(r, EXPECT)
    assert s["module_recall"] == 0.5
    assert s["risk_coverage"] == 0.5          # "card" never mentioned
    assert s["category_coverage"] == 0.5      # no Negative case
    assert s["uniqueness"] == pytest.approx(2 / 3)
    assert s["step_completeness"] == pytest.approx(2 / 3)
    assert s["checklist_module_coverage"] == 1.0
    assert 0 < s["quality"] < 1


def test_failed_run_scores_zero():
    s = score_result({"success": False, "error": "AI Quota exceeded."}, EXPECT)
    assert s["ok"] is False and s["quality"] == 0.0 and s["error"] == "AI Quota exceeded."


def test_baseline_comparison_flags_only_real_drops():
    baseline = {"ok_rate": 1.0, "quality": 0.8, "risk_coverage": 0.9}
    assert compare_to_baseline({"ok_rate": 1.0, "quality": 0.75, "risk_coverage": 0.85}, baseline) == []
    regressions = compare_to_baseline({"ok_rate": 0.5, "quality": 0.75, "risk_coverage": 0.6}, baseline)
    assert [r.split(":")[0] for r in regressions] == ["ok_rate", "risk_coverage"]


# ── Dataset ──────────────────────────────────────────────────────────────────


def test_dataset_is_valid_and_passes_input_guardrail():
    from guardrails import Source, input_guardrail

    cases = load_cases()
    assert len(cases) >= 6
    assert len({c["id"] for c in cases}) == len(cases)
    for case in cases:
        expect = case["expect"]
        assert expect["modules"] and expect["risks"], case["id"]
        for pattern in expect["modules"] + expect["risks"]:
            re.compile(pattern)
        assert set(expect["categories"]) <= set(CATEGORIES), case["id"]
        check = input_guardrail.validate(case["workflow"], source=Source.USER, field="workflow")
        assert not check.blocked, f"{case['id']} trips the input guardrail: {check.reasons}"


def test_unknown_case_ids_are_rejected():
    with pytest.raises(ValueError):
        load_cases(only=["no_such_case"])


# ── Harness ──────────────────────────────────────────────────────────────────

MODULES = json.dumps({"confirmed_modules": ["Login", "Payments"], "critical_workflows": ["Login then pay"]})
CHECKLIST = json.dumps({"checklist": [{"module": "Login", "items": [{"text": "Lockout after 5 tries"}]}]})
TEST_CASES = json.dumps({"test_cases": [
    {"module": "Login", "category": "Security", "description": "Account lock after 5 failed logins",
     "steps": ["Open login", "Enter wrong password 5 times"], "expectedResult": "Account locked"},
    {"module": "Payments", "category": "Negative", "description": "Expired card is rejected",
     "steps": ["Add expired card", "Pay"], "expectedResult": "Error shown"},
]})


@pytest.fixture
def scripted_llm(fake_llm, agent_router):
    fake_llm.responder = agent_router(module=MODULES, checklist=CHECKLIST, test_cases=TEST_CASES)
    return fake_llm


def test_harness_matches_the_real_endpoint(client, scripted_llm):
    """run_pipeline() duplicates /analyze-workflow's flow; this keeps the two from drifting."""
    workflow = "User logs in and pays by card."
    via_api = client.post("/analyze-workflow", json={"workflow": workflow}).json()
    assert run_pipeline(workflow) == via_api


def test_evaluate_scores_each_run_and_records_usage(scripted_llm):
    case = {"id": "login_pay", "workflow": "User logs in and pays by card.", "expect": EXPECT}
    report = evaluate([case], repeat=2)

    assert [r["attempt"] for r in report["runs"]] == [1, 2]
    run = report["runs"][0]
    assert run["ok"] and run["llm_calls"] == 3
    assert run["risk_coverage"] == 1.0
    assert report["aggregate"]["runs"] == 2
    assert report["aggregate"]["ok_rate"] == 1.0


def test_evaluate_survives_pipeline_crash(monkeypatch):
    import evals.harness as harness

    def boom(*a, **k):
        raise RuntimeError("graph exploded")

    monkeypatch.setattr(harness, "run_pipeline", boom)
    report = evaluate([{"id": "x", "workflow": "w", "expect": EXPECT}])
    assert report["runs"][0]["ok"] is False
    assert "graph exploded" in report["runs"][0]["error"]
    assert aggregate(report["runs"])["quality"] == 0.0


def test_cli_end_to_end(scripted_llm, monkeypatch, tmp_path, capsys):
    import utils
    from evals import run as cli

    monkeypatch.setattr(utils, "default_llm_manager", utils.default_llm_manager)  # restored after the test
    out = tmp_path / "report.json"

    assert cli.main(["--cases", "auth_signup_login", "--out", str(out)]) == 0
    report = json.loads(out.read_text())
    assert report["meta"]["cases"] == ["auth_signup_login"]
    assert report["runs"][0]["ok"] is True

    strict = tmp_path / "baseline.json"
    strict.write_text(json.dumps({"ok_rate": 1.0, "quality": 1.0, "risk_coverage": 1.0}))
    assert cli.main(["--cases", "auth_signup_login", "--out", str(out), "--baseline", str(strict)]) == 1
    assert "REGRESSIONS" in capsys.readouterr().out


def test_pause_between_runs_but_not_before_first(scripted_llm, monkeypatch):
    import evals.harness as harness

    sleeps = []
    monkeypatch.setattr(harness.time, "sleep", sleeps.append)
    cases = [{"id": f"c{i}", "workflow": "User logs in and pays by card.", "expect": EXPECT} for i in range(3)]
    evaluate(cases, pause_seconds=60)
    assert sleeps == [60, 60]
