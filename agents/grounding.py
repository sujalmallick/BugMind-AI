"""
agents/grounding.py — answer grounding and hallucination checks for generated
test cases. Deterministic: no extra model call, no tokens.

The test case agent labels each case with its sources ("workflow", "doc:N",
"assumed"). Labels are claims, not facts, so every one is verified against
what the model was actually given:

  - "workflow" / "doc:N": the case's distinctive terms (minus generic QA words
    and terms shared by most cases in the batch) must overlap the source.
  - "doc:N" must point at an excerpt that was actually provided; a made-up
    number is a hallucinated citation.
  - Concrete limits and amounts in the case's claims about behavior ("max 50
    characters", "locks after 3 attempts", "₹10,000", "20%") must appear in the
    workflow or excerpts, allowing ±1 for boundary tests. Invented thresholds
    are the most common hallucination in generated test cases.

A case is "grounded" only if at least one claimed source verifies AND nothing
was invented, mis-cited or admitted as assumed. Nothing is deleted:
unsupported cases are kept as "assumed" with reasons, for a human to check.
"""

import re
from decimal import Decimal, InvalidOperation

from agents.coverage import keywords

MIN_SUPPORT_TERMS = 2
MIN_SUPPORT_RATIO = 0.3
COMMON_TERM_SHARE = 0.5   # in at least this share of cases → domain vocabulary, not evidence
MIN_BATCH_FOR_COMMON = 4
MAX_NOTES = 3

# Generic QA vocabulary: present in almost every case, so it proves nothing.
_GENERIC = keywords(
    "verify check ensure test validate valid invalid user system page screen button click tap enter "
    "open navigate display displayed shown show message error success successful successfully correct "
    "correctly field input value data result expected behavior application app attempt submit form "
    "able allowed appear appears able should must when then "
    # Inflections the stemmer doesn't fold onto the forms above.
    "validates validated validating checks checked checking verifies verified ensures ensured "
    "submits submitted clicks clicked opens opened enters entered displays navigates selects selected "
    "requirement requirements"
)

_NUMBER = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"
# A number standing on its own: not glued to letters, hyphens, slashes, colons (IDs, dates, times).
_FREE = r"(?<![\w\-/:.])"
_UNITS = (
    r"characters?|chars?|digits?|letters?|words?|mb|kb|gb|bytes?|seconds?|secs?|minutes?|mins?|"
    r"hours?|hrs?|days?|weeks?|months?|years?|attempts?|tries|retries|times|items?|users?|requests?|"
    r"inr|usd|rupees?|dollars?|pages?|files?|otps?|px"
)
_UNIT_LIMIT = re.compile(rf"{_FREE}({_NUMBER})\s*(?:{_UNITS})\b", re.IGNORECASE)
_PERCENT = re.compile(rf"{_FREE}({_NUMBER})\s*(?:%|percent\b)", re.IGNORECASE)
_CURRENCY = re.compile(rf"(?:₹|\$|\b(?:rs\.?|inr|usd)\s?)({_NUMBER})", re.IGNORECASE)
_RANGE = re.compile(rf"{_FREE}({_NUMBER})\s*(?:-|–|to|and)\s*({_NUMBER})\s*(?:{_UNITS}|%)", re.IGNORECASE)
_FREE_NUMBER = re.compile(rf"{_FREE}({_NUMBER})(?![\w\-/:])")


_UNIT_WORDS = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
               "fifteen sixteen seventeen eighteen nineteen").split()
_TENS_WORDS = "twenty thirty forty fifty sixty seventy eighty ninety".split()
_NUMBER_WORDS = re.compile(
    rf"\b(?:({'|'.join(_TENS_WORDS)})(?:[\s-]+({'|'.join(_UNIT_WORDS[1:10])}))?|({'|'.join(_UNIT_WORDS)}))\b",
    re.IGNORECASE,
)


def _words_to_digits(text: str) -> str:
    """ "fifteen minutes" → "15 minutes", "twenty-five" → "25": spelled-out limits are checked too."""
    def convert(match: re.Match) -> str:
        tens, unit, single = match.groups()
        if single:
            return str(_UNIT_WORDS.index(single.lower()))
        value = (_TENS_WORDS.index(tens.lower()) + 2) * 10
        return str(value + (_UNIT_WORDS.index(unit.lower()) if unit else 0))
    return _NUMBER_WORDS.sub(convert, text)


def _norm(number: str) -> str:
    try:
        value = Decimal(number.replace(",", "")).normalize()
    except InvalidOperation:
        return number
    return format(value, "f")


def limit_claims(text: str) -> set[str]:
    """Numbers stated as limits or amounts ("50 characters", "3 attempts", "$20", "15%"), ignoring 0-2."""
    text = _words_to_digits(text or "")
    found = set()
    for pattern in (_UNIT_LIMIT, _PERCENT, _CURRENCY):
        found |= {_norm(n) for n in pattern.findall(text)}
    return {n for n in found if n not in ("0", "1", "2")}


def known_numbers(text: str) -> set[str]:
    """Numbers a source states: stated limits, both ends of ranges, and free-standing numbers in prose."""
    text = _words_to_digits(text or "")
    numbers = limit_claims(text) | {_norm(n) for n in _FREE_NUMBER.findall(text)}
    for low, high in _RANGE.findall(text):
        numbers |= {_norm(low), _norm(high)}
    return numbers


def _near(value: str, known: set[str]) -> bool:
    """Allow boundary tests: a stated limit of 64 makes 63, 64 and 65 legitimate."""
    if value in known:
        return True
    try:
        v = Decimal(value)
    except InvalidOperation:
        return False
    return any(_norm(str(v + d)) in known for d in (-1, 1)) if v == v.to_integral_value() else False


def _claim_text(tc: dict) -> str:
    """Statements about how the system behaves (test inputs in steps/inputData are not claims)."""
    return " ".join(str(tc.get(k) or "") for k in ("description", "objective", "preconditions", "expectedResult"))


def _case_terms(tc: dict) -> set[str]:
    parts = [tc.get("description"), tc.get("objective"), tc.get("preconditions"), tc.get("inputData"),
             tc.get("expectedResult"), *(tc.get("steps") or [])]
    return keywords(" ".join(str(p) for p in parts if p)) - _GENERIC


def _supported(distinctive: set[str], source_terms: set[str]) -> bool:
    matched = distinctive & source_terms
    return len(matched) >= MIN_SUPPORT_TERMS and len(matched) >= MIN_SUPPORT_RATIO * len(distinctive)


def ground_test_cases(
    test_cases: list[dict],
    workflow: str,
    observed_steps: list[str] | None = None,
    excerpts: list[dict] | None = None,
) -> tuple[list[dict], dict]:
    """Adds tc["grounding"] = {status, sources, notes} to every case; returns (cases, summary)."""
    excerpts = excerpts or []
    source_text = "\n".join([workflow or "", *(observed_steps or [])])
    workflow_terms = keywords(source_text)
    excerpt_terms = [keywords(f"{e.get('heading') or ''} {e.get('text', '')}") for e in excerpts]
    known = known_numbers(source_text).union(*(known_numbers(e.get("text", "")) for e in excerpts))

    case_terms = [_case_terms(tc) for tc in test_cases]
    common: set[str] = set()
    if len(test_cases) >= MIN_BATCH_FOR_COMMON:
        counts: dict[str, int] = {}
        for terms in case_terms:
            for term in terms:
                counts[term] = counts.get(term, 0) + 1
        common = {t for t, n in counts.items() if n >= COMMON_TERM_SHARE * len(test_cases)}

    summary = {"grounded": 0, "assumed": 0, "invalidCitations": 0, "unverifiedValues": 0}
    for tc, terms in zip(test_cases, case_terms):
        claims = tc.pop("sources", None)
        distinctive = (terms - common) or terms
        refs, notes, disqualified = [], [], False

        for claim in (claims if claims else ["workflow"]):  # unlabeled: check against the workflow
            if claim == "workflow":
                if _supported(distinctive, workflow_terms):
                    refs.append({"type": "workflow"})
                elif claims:
                    notes.append("Says it comes from the workflow, but the workflow doesn't describe this")
            elif claim.startswith("doc:"):
                index = int(claim.split(":", 1)[1])
                if not 1 <= index <= len(excerpts):
                    summary["invalidCitations"] += 1
                    disqualified = True
                    notes.append(f"Cited documentation excerpt [{index}], which doesn't exist")
                    continue
                excerpt = excerpts[index - 1]
                if _supported(distinctive, excerpt_terms[index - 1]):
                    refs.append({"type": "document", "documentId": excerpt.get("documentId"),
                                 "filename": excerpt.get("filename"), "heading": excerpt.get("heading")})
                else:
                    notes.append(f"Cites {excerpt.get('filename')}, but that excerpt doesn't support it")
            elif claim == "unseen-doc":
                disqualified = True
                notes.append("Cites documentation it was never shown")
            elif claim == "assumed":
                disqualified = True
                notes.append("Based on general QA practice, not on the workflow or documents")
            elif claim == "unrecognized":
                disqualified = True
                notes.append("Gave a source the check couldn't recognize")

        unverified = sorted((n for n in limit_claims(_claim_text(tc)) if not _near(n, known)), key=Decimal)
        if unverified:
            summary["unverifiedValues"] += 1
            notes.insert(0, "Mentions " + ", ".join(unverified[:3]) + ", not found in the workflow or documents")

        unique_refs = []
        for ref in refs:
            if ref not in unique_refs:
                unique_refs.append(ref)
        status = "grounded" if unique_refs and not unverified and not disqualified else "assumed"
        summary[status] += 1
        tc["grounding"] = {"status": status, "sources": unique_refs, "notes": notes[:MAX_NOTES]}
    return test_cases, summary


# ── Workflow drafts ──────────────────────────────────────────────────────────

def _excerpt_ref(excerpt: dict) -> dict:
    return {"documentId": excerpt.get("documentId"), "filename": excerpt.get("filename"),
            "heading": excerpt.get("heading")}


def ground_draft_steps(steps: list[dict], excerpts: list[dict]) -> list[dict]:
    """
    Checks each drafted workflow step against the excerpts the model was shown.
    Every one of the step's numbers (digits or words) must be in the documents
    and every cited excerpt must exist.

    Returns [{text, status, sources, note}] with status:
      "grounded"    — a provided excerpt supports it
      "generic"     — only generic words ("User clicks Submit"): nothing to verify
      "unsupported" — not found in the documents, invented numbers or a made-up citation
    """
    excerpt_terms = [keywords(f"{e.get('heading') or ''} {e.get('text', '')}") for e in excerpts]
    known = set().union(*(known_numbers(e.get("text", "")) for e in excerpts)) if excerpts else set()
    checked = []
    for step in steps:
        text = step.get("text", "")
        claims = step.get("sources") or []
        cited = []
        for claim in claims:
            if claim.startswith("doc:"):
                cited.append(int(claim.split(":", 1)[1]))

        result = {"text": text, "status": "unsupported", "sources": [], "note": None}
        if any(not 1 <= n <= len(excerpts) for n in cited):
            result["note"] = "Cites a document excerpt that doesn't exist"
            checked.append(result)
            continue
        unverified = sorted((n for n in limit_claims(text) if not _near(n, known)), key=Decimal)
        if unverified:
            result["note"] = "Mentions " + ", ".join(unverified[:3]) + ", not found in your documents"
            checked.append(result)
            continue

        distinctive = keywords(text) - _GENERIC
        if not distinctive:
            result["status"] = "generic"
            checked.append(result)
            continue

        # A step is a few words, so one shared distinctive term can be enough, as long as
        # it is a fair share of the step's own terms (new terms mean new, unbacked claims).
        def supports(index: int) -> bool:
            matched = distinctive & excerpt_terms[index]
            return bool(matched) and len(matched) >= MIN_SUPPORT_RATIO * len(distinctive)

        # Cited excerpts first; a step with a wrong or missing citation can still be found elsewhere.
        supporting = [n - 1 for n in cited if supports(n - 1)] or \
                     [i for i in range(len(excerpts)) if supports(i)][:1]
        if supporting:
            result["status"] = "grounded"
            for i in supporting:
                ref = _excerpt_ref(excerpts[i])
                if ref not in result["sources"]:
                    result["sources"].append(ref)
        else:
            result["note"] = "Not found in your documents"
        checked.append(result)
    return checked
