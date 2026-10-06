"""
Structured agent outputs: Pydantic normalization must match the legacy
hand-written normalization exactly (golden cases), accept the new
{"<key>": [...]} wrapper, and request provider JSON mode with a safe fallback.
"""

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

GOLDEN = json.loads((Path(__file__).parent / "fixtures" / "agent_output_golden.json").read_text())["cases"]
MODULES_INPUT = {"confirmed_modules": ["Authentication", "Payments"]}
OBSERVATION = "Login button does nothing when clicked twice quickly"


def run_agent(case):
    from agents.checklist_agent import generate_checklist_agent
    from agents.issue_agent import analyze_issue_agent
    from agents.module_agent import identify_modules_agent
    from agents.test_case_agent import generate_test_cases_agent

    agent = case["agent"]
    if agent == "module":
        return identify_modules_agent("User logs in and pays.")
    if agent == "checklist":
        return generate_checklist_agent("wf", MODULES_INPUT, [], [])
    if agent == "test_case":
        return generate_test_cases_agent("wf", MODULES_INPUT, [], [], None)
    return analyze_issue_agent("wf", OBSERVATION, "e", "a", case["failed_test_case"])


@pytest.mark.parametrize("case", GOLDEN, ids=lambda c: f"{c['agent']}-{c['name']}")
def test_normalization_matches_legacy_golden(fake_llm, case):
    fake_llm.responder = lambda messages: case["raw"]
    assert run_agent(case) == case["expected"]


@pytest.mark.parametrize("wrapper_key", ["checklist", "modules"])
def test_checklist_accepts_object_wrapper(fake_llm, wrapper_key):
    from agents.checklist_agent import generate_checklist_agent

    modules = [{"module": "Auth", "items": [{"id": "a-1", "text": "Lockout", "confidence": "assumed"}]}]
    fake_llm.responder = lambda messages: json.dumps({wrapper_key: modules})
    assert generate_checklist_agent("wf", MODULES_INPUT, [], []) == [
        {"module": "Auth", "items": [{"id": "A-1", "text": "Lockout", "confidence": "assumed"}]}
    ]


def test_test_cases_accept_object_wrapper(fake_llm):
    from agents.test_case_agent import generate_test_cases_agent

    fake_llm.responder = lambda messages: json.dumps({"test_cases": [{"module": "Auth", "priority": "P0"}]})
    [tc] = generate_test_cases_agent("wf", MODULES_INPUT, [], [], None)
    assert (tc["id"], tc["module"], tc["priority"], tc["status"]) == ("TC-001", "Auth", "High", "not-executed")


def test_ambiguous_wrapper_is_not_guessed(fake_llm):
    from agents.checklist_agent import generate_checklist_agent

    fake_llm.responder = lambda messages: json.dumps({"a": [{"module": "X", "items": [{"text": "t"}]}], "b": []})
    assert generate_checklist_agent("wf", MODULES_INPUT, [], []) == []


def test_null_fields_fall_back_to_defaults(fake_llm):
    """Legacy code turned explicit nulls into the string "None"; schemas treat them as missing."""
    from agents.test_case_agent import generate_test_cases_agent

    fake_llm.responder = lambda messages: json.dumps([{"module": "Auth", "description": None, "inputData": None}])
    [tc] = generate_test_cases_agent("wf", MODULES_INPUT, [], [], None)
    assert tc["description"] == "Perform test case execution"
    assert tc["inputData"] == "N/A"


# ── Provider JSON mode ───────────────────────────────────────────────────────

class KwargsRecorder:
    """completion() stand-in that records kwargs and can fail on demand."""

    def __init__(self, content="{}", fail_with=None):
        self.calls: list[dict] = []
        self.content = content
        self.fail_with = fail_with  # exception raised while response_format is present

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail_with and "response_format" in kwargs:
            raise self.fail_with
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=self.content))])


@pytest.fixture
def recorder(monkeypatch):
    import providers.litellm_provider as provider_module

    rec = KwargsRecorder()
    monkeypatch.setattr(provider_module, "completion", rec)
    return rec


@pytest.mark.parametrize("agent", ["module", "checklist", "test_case", "issue"])
def test_agents_request_json_mode(recorder, agent):
    run_agent({"agent": agent, "failed_test_case": True})
    assert recorder.calls[0]["response_format"] == {"type": "json_object"}


def test_plain_generate_does_not_request_json_mode(recorder):
    from services.llm_manager import LLMManager

    from config import DEFAULT_MODEL

    LLMManager(provider="groq", model=DEFAULT_MODEL).generate("Say hi")
    assert "response_format" not in recorder.calls[0]


def test_unsupported_model_skips_json_mode(recorder, monkeypatch):
    import providers.litellm_provider as provider_module

    monkeypatch.setattr(provider_module.litellm, "get_supported_openai_params", lambda **kw: ["temperature"])
    run_agent({"agent": "module"})
    assert "response_format" not in recorder.calls[0]


@pytest.mark.parametrize("error", [
    "GroqException - json_validate_failed: Failed to generate JSON",
    "BadRequestError: response_format is not supported by this model",
])
def test_json_mode_rejection_retries_without_it(recorder, error):
    recorder.fail_with = Exception(error)
    recorder.content = json.dumps({"confirmed_modules": ["Auth"]})

    result = run_agent({"agent": "module"})

    assert result["confirmed_modules"] == ["Auth"]
    assert "response_format" in recorder.calls[0]
    assert "response_format" not in recorder.calls[1]
    assert len(recorder.calls) == 2


def test_other_provider_errors_are_not_masked_by_json_fallback(recorder):
    recorder.fail_with = Exception("401 Unauthorized: invalid api key")

    result = run_agent({"agent": "module"})

    assert result == {"success": False, "error": "Invalid or missing API Key.", "code": "auth"}
    assert len(recorder.calls) == 1
