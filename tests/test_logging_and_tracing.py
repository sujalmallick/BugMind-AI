import json
import logging
import threading

import pytest

import guardrails
from guardrails.log_redaction import WITHHELD


@pytest.fixture(autouse=True)
def _hooks_installed():
    guardrails.bootstrap()


def test_log_messages_and_args_are_redacted(caplog):
    caplog.set_level(logging.INFO)
    log = logging.getLogger("BugMind.test")
    log.info("user %s logged in with token %s", "rahul@corp.in", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl")
    log.warning(f"Invitation email sent to priya@corp.in, card 4111 1111 1111 1111")
    text = caplog.text
    assert "rahul@corp.in" not in text and "eyJhbGci" not in text
    assert "priya@corp.in" not in text and "4111 1111 1111 1111" not in text
    assert "[EMAIL_REDACTED]" in text and "[TOKEN_REDACTED]" in text


def test_exception_tracebacks_are_redacted(caplog):
    caplog.set_level(logging.ERROR)
    try:
        raise ConnectionError("cannot reach postgresql://admin:Sup3rS3cret@db:5432/prod")
    except ConnectionError:
        logging.getLogger("BugMind").error("DB failure", exc_info=True)
    assert "Sup3rS3cret" not in caplog.text
    assert "[CONNECTION_STRING_REDACTED]" in caplog.text


def test_third_party_loggers_are_redacted_too(caplog):
    caplog.set_level(logging.INFO)
    logging.getLogger("uvicorn.error").info("api_key=AbC123xyz789QQ")
    logging.getLogger("LiteLLM").info("Authorization: Bearer abcdef0123456789ABCDEFxyz")
    assert "AbC123xyz789QQ" not in caplog.text
    assert "abcdef0123456789ABCDEFxyz" not in caplog.text


def test_uvicorn_access_log_keeps_args_and_formats(caplog):
    from uvicorn.logging import AccessFormatter

    caplog.set_level(logging.INFO, logger="uvicorn.access")
    logging.getLogger("uvicorn.access").info(
        '%s - "%s %s HTTP/%s" %d',
        "49.36.12.7:51234", "GET", "/health?api_key=AbC123xyz789QQ", "1.1", 200,
    )
    record = caplog.records[-1]
    assert isinstance(record.args, tuple) and len(record.args) == 5
    line = AccessFormatter('%(client_addr)s - "%(request_line)s" %(status_code)s', use_colors=False).format(record)
    assert "49.36.12.7" not in line and "AbC123xyz789QQ" not in line
    assert "[IP_REDACTED]" in line and '"GET /health' in line and line.endswith("200 OK")


def test_redaction_failure_withholds_the_message(caplog, monkeypatch):
    from guardrails.data_masker import masker

    monkeypatch.setattr(masker, "redact", lambda *a, **k: (_ for _ in ()).throw(RuntimeError()))
    caplog.set_level(logging.INFO)
    logging.getLogger("BugMind").info("secret sk-abcdefghijklmnop1234")
    assert "sk-abcdefghijklmnop1234" not in caplog.text
    assert WITHHELD in caplog.text


def test_access_log_redaction_failure_still_formats(caplog, monkeypatch):
    from uvicorn.logging import AccessFormatter
    from guardrails.data_masker import masker

    monkeypatch.setattr(masker, "redact", lambda *a, **k: (_ for _ in ()).throw(RuntimeError()))
    caplog.set_level(logging.INFO, logger="uvicorn.access")
    logging.getLogger("uvicorn.access").info(
        '%s - "%s %s HTTP/%s" %d', "49.36.12.7:51234", "GET", "/x", "1.1", 404,
    )
    line = AccessFormatter('%(client_addr)s - "%(request_line)s" %(status_code)s', use_colors=False).format(caplog.records[-1])
    assert "49.36.12.7" not in line and WITHHELD in line and line.endswith("404 Not Found")


def test_audit_event_contains_only_safe_metadata(caplog):
    caplog.set_level(logging.INFO, logger="BugMind.security")
    guardrails.audit.event("input", "sanitize", agent="module_agent", entities={"EMAIL": 2},
                           signals=["override_instructions"], reasons=["leaked a@corp.io"])
    event = json.loads(caplog.records[-1].getMessage())
    assert event["guardrail"] == "input" and event["entities"] == {"EMAIL": 2}
    assert event["reasons"] == ["leaked [EMAIL_REDACTED]"]
    assert {"ts", "decision", "agent"} <= set(event)


def test_langsmith_client_hides_sensitive_inputs_and_outputs():
    from langsmith import run_trees
    from guardrails.tracing import install_langsmith_hooks, sanitize_trace_payload

    install_langsmith_hooks(force=True)
    client = run_trees.get_cached_client()
    assert client._hide_inputs is sanitize_trace_payload
    assert client._hide_outputs is sanitize_trace_payload
    hidden = client._hide_inputs({"workflow": "mail a@corp.io", "meta": {"key": "sk-abcdefghijklmnop1234"}})
    assert hidden == {"workflow": "mail [EMAIL_REDACTED]", "meta": {"key": "[API_KEY_REDACTED]"}}


def test_litellm_callbacks_receive_sanitized_payloads():
    """Drives real litellm.completion (mock_response → no network) through its logging pipeline."""
    import litellm
    from litellm.integrations.custom_logger import CustomLogger

    captured = {}
    done = threading.Event()

    class Capture(CustomLogger):
        def log_success_event(self, kwargs, response_obj, start_time, end_time):
            captured["messages"] = kwargs.get("messages")
            captured["slo_messages"] = (kwargs.get("standard_logging_object") or {}).get("messages")
            captured["response"] = response_obj.choices[0].message.content
            done.set()

    capture = Capture()
    litellm.callbacks = list(litellm.callbacks) + [capture]
    try:
        response = litellm.completion(
            model="gpt-4o-mini",
            api_key="sk-test-not-used",
            messages=[{"role": "user", "content": "contact a@corp.io"}],
            mock_response="leaked sk-proj-ABCDEFGHIJ1234567890 for b@corp.io",
        )
        assert done.wait(10), "LiteLLM success callback did not fire"
    finally:
        litellm.callbacks = [c for c in litellm.callbacks if c is not capture]

    # The caller's own response object is untouched (the output guardrail handles it).
    assert "sk-proj-ABCDEFGHIJ1234567890" in response.choices[0].message.content
    # What logging callbacks (e.g. LangSmith) receive is sanitized.
    assert "a@corp.io" not in json.dumps(captured["messages"])
    assert "a@corp.io" not in json.dumps(captured["slo_messages"])
    assert "sk-proj-ABCDEFGHIJ1234567890" not in captured["response"]
    assert "b@corp.io" not in captured["response"]
