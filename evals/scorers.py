"""
evals/scorers.py — deterministic quality metrics for one /analyze-workflow result.

Every metric is in [0, 1] where higher is better, so they can be averaged
into one quality score and compared against a baseline. No LLM judges.
"""

import re

CATEGORIES = ("Functional", "Negative", "Edge Case", "Security", "Regression")

# Defaults the schemas fill in when the model omitted a field.
_DEFAULT_DESCRIPTION = "Perform test case execution"
_DEFAULT_EXPECTED = "System responds correctly"

# Metrics averaged into the overall quality score.
QUALITY_METRICS = (
    "module_recall",
    "risk_coverage",
    "category_coverage",
    "uniqueness",
    "step_completeness",
    "checklist_module_coverage",
)


def _matches(pattern: str, text: str) -> bool:
    return re.search(pattern, text, re.IGNORECASE) is not None


def _test_case_text(tc: dict) -> str:
    parts = [tc.get("description"), tc.get("objective"), tc.get("preconditions"),
             tc.get("inputData"), tc.get("expectedResult"), *(tc.get("steps") or [])]
    return " ".join(str(p) for p in parts if p)


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a | b else 1.0


def _fraction(hits: int, total: int) -> float:
    return hits / total if total else 1.0


def module_recall(result: dict, expected: list[str]) -> float:
    names = [*result.get("confirmedModules", []), *result.get("assumedModules", [])]
    return _fraction(sum(any(_matches(p, n) for n in names) for p in expected), len(expected))


def risk_coverage(result: dict, expected: list[str]) -> float:
    texts = [_test_case_text(tc) for tc in result.get("testCases", [])]
    return _fraction(sum(any(_matches(p, t) for t in texts) for p in expected), len(expected))


def category_coverage(result: dict, required: list[str]) -> float:
    present = {tc.get("category") for tc in result.get("testCases", [])}
    return _fraction(sum(c in present for c in required), len(required))


def category_diversity(result: dict) -> float:
    present = {tc.get("category") for tc in result.get("testCases", [])}
    return len(present & set(CATEGORIES)) / len(CATEGORIES)


def uniqueness(result: dict, threshold: float = 0.8) -> float:
    """1 - share of test cases whose description near-duplicates an earlier one."""
    seen: list[set] = []
    duplicates = 0
    for tc in result.get("testCases", []):
        toks = _tokens(str(tc.get("description", "")))
        if any(_jaccard(toks, s) >= threshold for s in seen):
            duplicates += 1
        seen.append(toks)
    return 1 - _fraction(duplicates, len(seen)) if seen else 0.0


def step_completeness(result: dict) -> float:
    """Share of test cases with ≥2 steps and a real (non-default) description and expected result."""
    cases = result.get("testCases", [])
    complete = sum(
        len(tc.get("steps") or []) >= 2
        and tc.get("description") not in ("", _DEFAULT_DESCRIPTION)
        and tc.get("expectedResult") not in ("", _DEFAULT_EXPECTED)
        for tc in cases
    )
    return _fraction(complete, len(cases)) if cases else 0.0


def checklist_module_coverage(result: dict) -> float:
    """Share of confirmed modules that have a checklist group (by containment, either way)."""
    confirmed = [m.lower() for m in result.get("confirmedModules", [])]
    groups = [str(g.get("module", "")).lower() for g in result.get("checklist", [])]
    covered = sum(any(m in g or g in m for g in groups if g) for m in confirmed)
    return _fraction(covered, len(confirmed))


def score_result(result: dict, expect: dict) -> dict:
    """All metrics for one case. A failed or empty run scores 0 on every quality metric."""
    test_cases = result.get("testCases") or []
    ok = bool(result.get("success")) and bool(test_cases) and bool(result.get("checklist"))
    low, high = expect.get("test_cases", [1, 1000])

    scores = {
        "ok": ok,
        "test_case_count": len(test_cases),
        "test_case_count_in_range": low <= len(test_cases) <= high,
        "category_diversity": category_diversity(result),
    }
    if not ok:
        scores.update({m: 0.0 for m in QUALITY_METRICS})
        scores["error"] = result.get("error") or "empty result"
    else:
        scores.update({
            "module_recall": module_recall(result, expect.get("modules", [])),
            "risk_coverage": risk_coverage(result, expect.get("risks", [])),
            "category_coverage": category_coverage(result, expect.get("categories", [])),
            "uniqueness": uniqueness(result),
            "step_completeness": step_completeness(result),
            "checklist_module_coverage": checklist_module_coverage(result),
        })
    scores["quality"] = sum(scores[m] for m in QUALITY_METRICS) / len(QUALITY_METRICS)
    return scores
