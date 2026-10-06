"""
services/automation_results.py — reads a Playwright JSON report
(reporter "json", file bugmind-results.json from the exported project).

Only tests whose title carries "[BM-<id> v<version>]" are picked up; anything
else in the report is ignored. The file is untrusted input: size, nesting and
counts are bounded and every string is truncated.
"""

import json
import re
from datetime import datetime

# Under the app-wide 5 MB request limit (body_limit.py), so this friendlier message is what users see.
MAX_REPORT_BYTES = 4 * 1024 * 1024
MAX_SUITE_DEPTH = 20
MAX_TESTS = 2000
MAX_ERROR_CHARS = 1500

_TAG = re.compile(r"\[BM-(\d{1,9}) v(\d{1,6})\]")
_ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
# Playwright test outcome → BugMind result.
_OUTCOMES = {"expected": "passed", "unexpected": "failed", "flaky": "flaky", "skipped": "skipped"}


class ReportError(ValueError):
    pass


def _text(value, limit: int) -> str:
    return _ANSI.sub("", str(value or ""))[:limit]


def _error(results: list) -> str | None:
    for result in reversed(results if isinstance(results, list) else []):
        if not isinstance(result, dict):
            continue
        error = result.get("error")
        if isinstance(error, dict) and error.get("message"):
            return _text(error["message"], MAX_ERROR_CHARS)
        errors = result.get("errors")
        if isinstance(errors, list) and errors and isinstance(errors[0], dict) and errors[0].get("message"):
            return _text(errors[0]["message"], MAX_ERROR_CHARS)
    return None


def _duration(results: list) -> int:
    total = 0
    for result in results if isinstance(results, list) else []:
        if isinstance(result, dict) and isinstance(result.get("duration"), (int, float)):
            total += int(result["duration"])
    return max(0, min(total, 86_400_000))


def parse_report(data: bytes) -> dict:
    """{"startedAt", "durationMs", "tests": [{"scriptId", "version", "status", "error", "durationMs"}], "ignored"}"""
    if len(data) > MAX_REPORT_BYTES:
        raise ReportError("The results file is larger than 4 MB.")
    try:
        report = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError):  # RecursionError: absurdly deep nesting
        raise ReportError("That isn't a Playwright JSON report (bugmind-results.json).") from None
    if not isinstance(report, dict) or not isinstance(report.get("suites"), list):
        raise ReportError("That isn't a Playwright JSON report (bugmind-results.json).")

    tests, ignored = [], 0
    stack = [(suite, 1) for suite in report["suites"]]
    while stack:
        suite, depth = stack.pop()
        if not isinstance(suite, dict) or depth > MAX_SUITE_DEPTH:
            continue
        for child in suite.get("suites") or []:
            stack.append((child, depth + 1))
        for spec in suite.get("specs") or []:
            if not isinstance(spec, dict):
                continue
            match = _TAG.search(str(spec.get("title") or ""))
            if not match:
                ignored += 1
                continue
            for test in spec.get("tests") or []:
                if len(tests) >= MAX_TESTS:
                    raise ReportError(f"The report has more than {MAX_TESTS} tests.")
                if not isinstance(test, dict):
                    continue
                results = test.get("results")
                status = _OUTCOMES.get(test.get("status"))
                if status is None:
                    continue
                tests.append({
                    "scriptId": int(match.group(1)),
                    "version": int(match.group(2)),
                    "status": status,
                    "error": _error(results) if status == "failed" else None,
                    "durationMs": _duration(results),
                })

    stats = report.get("stats") if isinstance(report.get("stats"), dict) else {}
    started_at = None
    if isinstance(stats.get("startTime"), str):
        try:
            started_at = datetime.fromisoformat(stats["startTime"].replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            started_at = None
    duration = stats.get("duration")
    return {
        "startedAt": started_at,
        "durationMs": int(duration) if isinstance(duration, (int, float)) and 0 <= duration < 86_400_000 * 7 else None,
        "tests": tests,
        "ignored": ignored,
    }


def merge_outcomes(tests: list[dict]) -> dict[int, dict]:
    """
    One result per script. A script that ran in several projects/retries counts as
    failed if any run failed, else flaky if any was flaky, else passed; skipped only
    if every run was skipped.
    """
    order = {"failed": 3, "flaky": 2, "passed": 1, "skipped": 0}
    merged: dict[int, dict] = {}
    for test in tests:
        current = merged.get(test["scriptId"])
        if current is None:
            merged[test["scriptId"]] = dict(test)
            continue
        current["durationMs"] += test["durationMs"]
        current["version"] = min(current["version"], test["version"])
        if order[test["status"]] > order[current["status"]]:
            current["status"] = test["status"]
            current["error"] = test["error"] or current["error"]
    return merged
