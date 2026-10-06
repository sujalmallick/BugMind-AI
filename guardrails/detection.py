"""
guardrails/detection.py — pluggable entity-recognizer registry.

A recognizer finds spans of one entity type. Structured identifiers are
confirmed with checksums (Luhn, Verhoeff, IBAN mod-97) or surrounding context
words, so a bare 12-digit order number is not treated as an Aadhaar number.

Add a new entity by registering a recognizer:

    detector.register(PatternRecognizer(
        entity="EMPLOYEE_ID", kind="pii",
        pattern=re.compile(r"\\bEMP-\\d{6}\\b"),
    ))
"""

import ipaddress
import math
import re
from dataclasses import dataclass, field
from typing import Callable, Iterable, Iterator


PII = "pii"
SECRET = "secret"


@dataclass(frozen=True)
class Span:
    entity: str
    start: int
    end: int
    score: float
    kind: str  # PII or SECRET

    @property
    def length(self) -> int:
        return self.end - self.start


class Recognizer:
    entity: str
    kind: str

    def find(self, text: str) -> Iterator[Span]:  # pragma: no cover - interface
        raise NotImplementedError


@dataclass
class PatternRecognizer(Recognizer):
    """
    Regex recognizer.

    group           — which capture group is the sensitive value (0 = whole match)
    validator       — optional checksum/format check on the value
    invalid_score   — score when the validator fails (None → drop the match)
    context         — words that raise confidence when found shortly before the value
    context_score   — score used when a context word is present
    require_context — drop matches without a context word
    """

    entity: str
    kind: str
    pattern: re.Pattern
    score: float = 0.9
    group: int | str = 0
    validator: Callable[[str], bool] | None = None
    invalid_score: float | None = None
    context: tuple[str, ...] = ()
    context_score: float | None = None
    require_context: bool = False
    context_window: int = 40
    _context_re: re.Pattern | None = field(default=None, init=False, repr=False)

    def __post_init__(self):
        if self.context:
            words = "|".join(re.escape(w) for w in self.context)
            self._context_re = re.compile(rf"(?i)(?<![a-z])(?:{words})(?![a-z])")

    def _has_context(self, text: str, start: int) -> bool:
        if not self._context_re:
            return False
        window = text[max(0, start - self.context_window):start]
        return bool(self._context_re.search(window))

    def find(self, text: str) -> Iterator[Span]:
        for m in self.pattern.finditer(text):
            try:
                value = m.group(self.group)
                start, end = m.span(self.group)
            except IndexError:
                continue
            if not value:
                continue

            score = self.score
            has_ctx = self._has_context(text, start)
            if self.require_context and not has_ctx:
                continue
            if self.validator is not None and not self.validator(value):
                if self.invalid_score is None and not has_ctx:
                    continue
                score = self.invalid_score if self.invalid_score is not None else 0.0
            if has_ctx and self.context_score is not None:
                score = max(score, self.context_score)
            if score <= 0:
                continue
            yield Span(self.entity, start, end, score, self.kind)


@dataclass
class FunctionRecognizer(Recognizer):
    """Recognizer backed by an arbitrary function (for non-regex logic)."""

    entity: str
    kind: str
    func: Callable[[str], Iterable[tuple[int, int, float]]]

    def find(self, text: str) -> Iterator[Span]:
        for start, end, score in self.func(text):
            yield Span(self.entity, start, end, score, self.kind)


class EntityDetector:
    """Runs every registered recognizer and resolves overlapping matches."""

    def __init__(self, recognizers: Iterable[Recognizer] = ()):
        self._recognizers: list[Recognizer] = list(recognizers)

    def register(self, recognizer: Recognizer) -> None:
        self._recognizers.append(recognizer)

    @property
    def entities(self) -> set[str]:
        return {r.entity for r in self._recognizers}

    def detect(
        self,
        text: str,
        *,
        kinds: Iterable[str] = (PII, SECRET),
        exclude_entities: Iterable[str] = (),
        min_score: float = 0.5,
    ) -> list[Span]:
        if not text:
            return []
        kinds = set(kinds)
        excluded = set(exclude_entities)
        spans: list[Span] = []
        for rec in self._recognizers:
            if rec.kind not in kinds or rec.entity in excluded:
                continue
            for span in rec.find(text):
                if span.score >= min_score:
                    spans.append(span)
        return resolve_overlaps(spans)


def resolve_overlaps(spans: list[Span]) -> list[Span]:
    """Keep non-overlapping spans: secrets beat PII, then longer, then higher score."""
    ranked = sorted(
        spans,
        key=lambda s: (s.kind == SECRET, s.length, s.score),
        reverse=True,
    )
    chosen: list[Span] = []
    for span in ranked:
        if all(span.end <= c.start or span.start >= c.end for c in chosen):
            chosen.append(span)
    return sorted(chosen, key=lambda s: s.start)


# ── Validators ───────────────────────────────────────────────────────────────

def digits_only(value: str) -> str:
    return re.sub(r"\D", "", value)


def luhn_valid(value: str) -> bool:
    digits = digits_only(value)
    if not 13 <= len(digits) <= 19 or len(set(digits)) == 1:
        return False
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def verhoeff_valid(value: str) -> bool:
    digits = digits_only(value)
    c = 0
    for i, ch in enumerate(reversed(digits)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][int(ch)]]
    return c == 0


def aadhaar_valid(value: str) -> bool:
    digits = digits_only(value)
    return len(digits) == 12 and digits[0] not in "01" and verhoeff_valid(digits)


def iban_valid(value: str) -> bool:
    s = re.sub(r"\s", "", value).upper()
    if not 15 <= len(s) <= 34:
        return False
    rearranged = s[4:] + s[:4]
    numeric = "".join(str(int(ch, 36)) for ch in rearranged)
    return int(numeric) % 97 == 1


def ipv4_valid(value: str) -> bool:
    try:
        ipaddress.IPv4Address(value)
        return True
    except ValueError:
        return False


def ipv6_valid(value: str) -> bool:
    try:
        ipaddress.IPv6Address(value)
        return value.count(":") >= 2
    except ValueError:
        return False


def shannon_entropy(value: str) -> float:
    if not value:
        return 0.0
    counts: dict[str, int] = {}
    for ch in value:
        counts[ch] = counts.get(ch, 0) + 1
    n = len(value)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())
