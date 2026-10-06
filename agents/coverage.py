"""
agents/coverage.py — deterministic test coverage check (no LLM).

Compares generated test cases against what the module agent said matters:
every confirmed module, critical workflow and high-risk area should be
exercised by at least one test case, and the core categories should all be
present. The gaps it reports drive one targeted fill-in call.

Matching is keyword overlap, deliberately simple and predictable: a target
counts as covered when some test case mentions enough of its keywords.
"""

import re

REQUIRED_CATEGORIES = ("Functional", "Negative", "Edge Case", "Security")

_STOPWORDS = {
    "the", "and", "for", "with", "from", "into", "that", "this", "then", "than", "when", "while",
    "user", "users", "able", "via", "per", "all", "any", "are", "can", "its", "their", "after",
    "before", "flow", "flows", "process", "processing", "management", "handling", "module",
    "feature", "page", "screen", "system", "data", "end",
}


def keywords(text: str) -> set[str]:
    """Lower-cased, lightly stemmed content words (stopwords and <3-char words dropped)."""
    words = set()
    for word in re.findall(r"[a-z0-9]+", str(text).lower()):
        if len(word) < 3 or word in _STOPWORDS:
            continue
        # Light stemming so "payments"/"payment"/"pay" and "locked"/"lock" meet.
        for suffix, min_stem in (("ments", 3), ("ment", 3), ("ing", 4), ("ed", 4), ("es", 4), ("s", 4)):
            if word.endswith(suffix) and len(word) - len(suffix) >= min_stem:
                word = word[: -len(suffix)]
                break
        words.add(word)
    return words


def _test_case_keywords(tc: dict) -> set[str]:
    parts = [tc.get("module"), tc.get("description"), tc.get("objective"), tc.get("preconditions"),
             tc.get("inputData"), tc.get("expectedResult"), *(tc.get("steps") or [])]
    return keywords(" ".join(str(p) for p in parts if p))


def _is_covered(target: str, test_case_keywords: list[set[str]]) -> bool:
    wanted = keywords(target)
    if not wanted:
        return True  # nothing meaningful to look for
    needed = 1 if len(wanted) <= 2 else 2
    return any(len(wanted & kws) >= needed for kws in test_case_keywords)


def _module_covered(module: str, test_cases: list[dict], test_case_keywords: list[set[str]]) -> bool:
    name = module.lower().strip()
    for tc in test_cases:
        tc_module = str(tc.get("module", "")).lower().strip()
        if tc_module and (name in tc_module or tc_module in name):
            return True
    return _is_covered(module, test_case_keywords)


def coverage_report(
    modules: dict,
    critical_workflows: list[str],
    high_risk_areas: list[str],
    test_cases: list[dict],
    required_categories: tuple[str, ...] = REQUIRED_CATEGORIES,
) -> dict:
    """
    Returns {"targets", "covered", "score", "gaps": [{"kind", "target"}]}.
    kind is one of: module, critical_workflow, high_risk_area, category.
    """
    test_cases = [tc for tc in (test_cases or []) if isinstance(tc, dict)]
    tc_keywords = [_test_case_keywords(tc) for tc in test_cases]
    confirmed = modules.get("confirmed_modules", []) if isinstance(modules, dict) else []
    categories = {tc.get("category") for tc in test_cases}

    checks: list[tuple[str, str, bool]] = []
    checks += [("module", m, _module_covered(m, test_cases, tc_keywords)) for m in confirmed]
    checks += [("critical_workflow", w, _is_covered(w, tc_keywords)) for w in critical_workflows or []]
    checks += [("high_risk_area", r, _is_covered(r, tc_keywords)) for r in high_risk_areas or []]
    checks += [("category", c, c in categories) for c in required_categories]

    covered = sum(ok for _, _, ok in checks)
    return {
        "targets": len(checks),
        "covered": covered,
        "score": round(covered / len(checks), 3) if checks else 1.0,
        "gaps": [{"kind": kind, "target": target} for kind, target, ok in checks if not ok],
    }


def is_near_duplicate(description: str, others: list[str], threshold: float = 0.8) -> bool:
    words = set(re.findall(r"[a-z0-9]+", str(description).lower()))
    for other in others:
        other_words = set(re.findall(r"[a-z0-9]+", str(other).lower()))
        union = words | other_words
        if union and len(words & other_words) / len(union) >= threshold:
            return True
    return False
