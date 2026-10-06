"""
Untrusted file parsing runs in an isolated, time-limited process, so a hostile
PDF/DOCX can't hang or crash the app's job worker.

The helpers below run inside the spawned child, so they live at module level
and this module imports nothing heavy.
"""

import os
import time

import pytest

from services.document_extraction import ExtractionError, extract_isolated, run_isolated


def _sleep_forever():
    time.sleep(60)


def _crash():
    raise RuntimeError("parser exploded on a crafted object stream")


def _unreadable():
    raise ExtractionError("Password-protected PDFs aren't supported.")


def _die_silently():
    os._exit(1)  # e.g. killed by the memory limit before it could report


def _ok(value):
    return value * 2


def test_result_comes_back_from_the_child():
    assert run_isolated(_ok, (21,), timeout=30) == 42


def test_a_hanging_parser_is_killed_at_the_timeout():
    started = time.monotonic()
    with pytest.raises(ExtractionError, match="took too long"):
        run_isolated(_sleep_forever, (), timeout=2)
    assert time.monotonic() - started < 20


def test_parser_crashes_become_a_clean_error():
    with pytest.raises(ExtractionError, match="may be damaged"):
        run_isolated(_crash, (), timeout=30)


def test_user_facing_extraction_errors_pass_through():
    with pytest.raises(ExtractionError, match="Password-protected"):
        run_isolated(_unreadable, (), timeout=30)


def test_a_child_that_dies_without_reporting_is_handled():
    with pytest.raises(ExtractionError, match="couldn't be read safely"):
        run_isolated(_die_silently, (), timeout=30)


def test_real_extraction_runs_isolated():
    sections, pages = extract_isolated("md", b"# Login\nUsers sign in with email.\n", timeout=30)
    assert sections == [("Login", "Users sign in with email.")] and pages is None


def test_isolation_can_be_switched_off(monkeypatch):
    monkeypatch.setenv("DOCUMENT_EXTRACTION_ISOLATED", "false")
    assert extract_isolated("txt", b"plain text body")[0] == [(None, "plain text body")]
