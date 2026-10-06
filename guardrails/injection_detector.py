"""
guardrails/injection_detector.py — prompt-injection risk scoring.

Not a keyword blocklist. Each assessment combines:

  * Rule families (instruction override, prompt extraction, role hijack,
    chat-template spoofing, tool manipulation, exfiltration, reasoning
    extraction, safety bypass, instructions addressed to the AI).
  * De-obfuscation: Unicode NFKC, zero-width/bidi stripping, homoglyph and
    leetspeak folding, spaced-letter collapsing, URL/base64 decoding. Hits that
    only appear after de-obfuscation score higher, because hiding them is
    itself a signal.
  * Context: for direct user input, a hit that is quoted or framed as a test
    ("verify the bot rejects 'ignore previous instructions'") is discounted.
    BugMind users legitimately write QA workflows about prompt injection.
    Untrusted sources (DB records, documents, tool output, other agents)
    never get the discount.

Scores combine with a noisy-OR: 1 - Π(1 - weight). The policy engine turns
the score into allow / sanitize / block depending on the source.
"""

import base64
import binascii
import re
import unicodedata
from dataclasses import dataclass, field
from urllib.parse import unquote

from guardrails.models import Source


@dataclass(frozen=True)
class InjectionRule:
    id: str
    weight: float
    pattern: re.Pattern
    discountable: bool = True


@dataclass
class InjectionReport:
    score: float = 0.0
    signals: list[str] = field(default_factory=list)
    spans: list[tuple[int, int]] = field(default_factory=list)  # positions in the original text
    obfuscated: bool = False


_F = re.IGNORECASE
_S = r"[^.!?\n]"  # stay within one sentence/line

_VERBS_OVERRIDE = r"(?:ignore|disregard|forget|override|overrule|bypass|abandon|neglect|discard)"
_QUALIFIERS = r"(?:previous|prior|above|earlier|preceding|foregoing|system|developer|original|initial|all|your)"
_INSTRUCTION_NOUNS = (
    r"(?:instructions?|prompts?|rules?|directives?|guidelines?|guardrails?|constraints?|"
    r"polic(?:y|ies)|context|programming|restrictions?|commands?|orders?)"
)
_REVEAL_VERBS = (
    r"(?:reveal|show|print|display|repeat|output|leak|dump|expose|tell|give|share|disclose|"
    r"recite|spell out|write out|return|what(?:'s| is| are| were| was))"
)

RULES: list[InjectionRule] = [
    InjectionRule(
        "override_instructions", 0.9,
        re.compile(rf"\b{_VERBS_OVERRIDE}\b{_S}{{0,40}}?\b{_QUALIFIERS}\b{_S}{{0,30}}?\b{_INSTRUCTION_NOUNS}\b", _F),
    ),
    InjectionRule(
        "forget_context", 0.85,
        re.compile(r"\bforget (?:everything|all)(?: you (?:were|have been|'ve been) told| above| before| so far)\b", _F),
    ),
    InjectionRule(
        "new_instructions", 0.5,
        re.compile(
            r"\b(?:new|updated|real|actual|true|revised)\s+(?:instructions?|rules|system prompt|directives?)\s*(?::|are\b|is\b)"
            rf"|\bfrom now on\b{_S}{{0,30}}\b(?:you|your|assistant)\b",
            _F,
        ),
    ),
    InjectionRule(
        "prompt_extraction", 0.85,
        re.compile(
            rf"\b{_REVEAL_VERBS}\b{_S}{{0,30}}?\byour\b{_S}{{0,20}}?\b(?:system prompt|prompt|instructions?|rules|"
            r"guidelines|directives|preamble|system message|configuration)\b"
            rf"|\b{_REVEAL_VERBS}\b{_S}{{0,30}}?\b(?:system|developer|hidden|secret|internal|initial|original|"
            r"confidential)\s+(?:prompt|instructions?|preamble|directives)\b"
            r"|\b(?:repeat|print|output|echo)\b\s+(?:back\s+)?(?:everything|all|the text|the words|the content)\s+"
            r"(?:above|before|preceding|so far)\b",
            _F,
        ),
    ),
    InjectionRule(
        "prompt_mention", 0.3,
        re.compile(
            r"\b(?:system prompt|system message|developer message|developer instructions|hidden instructions|initial prompt)\b",
            _F,
        ),
    ),
    InjectionRule(
        "role_hijack", 0.7,
        re.compile(
            r"\byou are now (?:an?|the|my|in)\s+(?:\w+\s+){0,2}(?:ai|assistant|model|bot|mode|character|persona|dan|"
            r"jailbroken|unrestricted|unfiltered|developer|admin|root|evil|hacker)\b"
            r"|\byou are no longer (?:bound|restricted|limited|an? (?:ai|assistant))\b"
            rf"|\b(?:act|behave|respond|roleplay|role-play) as\b{_S}{{0,25}}\b(?:unrestricted|unfiltered|jailbroken|evil|"
            r"dan|admin(?:istrator)?|root|hacker|without (?:restrictions|limits|filters))\b"
            r"|\b(?:dan|jailbreak|god|sudo|unrestricted)\s+mode\b"
            r"|\bdo anything now\b"
            rf"|\bpretend\b{_S}{{0,30}}\b(?:no|without|free (?:of|from))\s+(?:rules|restrictions|limits|filters|guidelines|guardrails)\b",
            _F,
        ),
    ),
    InjectionRule("developer_mode", 0.4, re.compile(r"\bdeveloper mode\b", _F)),
    InjectionRule(
        "chat_template_tokens", 0.85,
        re.compile(
            r"<\|(?:im_start|im_end|system|user|assistant|endoftext|eot_id|start_header_id)\|>|\[/?INST\]|<</?SYS>>"
            r"|</?(?:system|developer|instructions?)>",
            _F,
        ),
    ),
    InjectionRule(
        "delimiter_spoof", 0.9,
        re.compile(r"</?\s*untrusted_data\b[^>\n]{0,120}>?", _F),
        discountable=False,
    ),
    InjectionRule(
        "role_line_marker", 0.35,
        # [ \t]* (not \s*): \s would cross newlines and rescan every following
        # line from each line start, which is quadratic on blank-line floods.
        re.compile(
            r"^[ \t]*(?:system|assistant|developer)[ \t]*:|^[ \t]*#{2,}[ \t]*(?:system|instructions?|new instructions)\b",
            _F | re.M,
        ),
    ),
    InjectionRule(
        "tool_manipulation", 0.75,
        re.compile(
            rf"\b(?:call|invoke|execute|run|trigger|use)\b{_S}{{0,25}}?\b(?:admin|delete|drop|shell|exec|sudo|root|"
            r"transfer|payment|grant|permission|privileged?|internal|system|database|db)\b[\s_-]*(?:\w+[\s_-]+)?"
            r"(?:tool|function|command|api|endpoint|plugin)s?\b",
            _F,
        ),
    ),
    InjectionRule(
        "tool_call_json", 0.6,
        re.compile(r"\"(?:tool_calls|function_call)\"\s*:|\"name\"\s*:\s*\"[\w.-]+\"\s*,\s*\"(?:arguments|parameters)\"\s*:", _F),
        discountable=False,
    ),
    InjectionRule(
        "reasoning_extraction_targeted", 0.85,
        re.compile(
            r"\b(?:show|reveal|print|output|share|tell|give|dump|expose|display|write out)\b"
            rf"{_S}{{0,15}}?\byour\s+(?:chain[\s-]of[\s-]thought|internal (?:reasoning|thoughts|monologue)|"
            r"hidden (?:reasoning|thoughts)|thought process|scratchpad|reasoning|inner monologue)\b",
            _F,
        ),
    ),
    InjectionRule(
        "reasoning_extraction", 0.6,
        re.compile(
            r"\b(?:show|reveal|print|output|share|tell|give|dump|expose|display|write out)\b"
            rf"{_S}{{0,25}}?\b(?:chain[\s-]of[\s-]thought|internal (?:reasoning|thoughts|monologue)|hidden (?:reasoning|thoughts)|"
            r"thought process|scratchpad|reasoning (?:steps|trace)|inner monologue)\b",
            _F,
        ),
    ),
    InjectionRule(
        "exfiltration", 0.85,
        re.compile(
            r"\b(?:send|email|e-mail|mail|post|upload|forward|exfiltrate|transmit|leak|copy|dump|export)\b"
            rf"{_S}{{0,40}}?\b(?:database|db|credentials|secrets|api[ _-]?keys|passwords|access tokens|tokens|"
            r"(?:the |all )?contents|user data|all (?:the )?data|all records|env(?:ironment)? variables?|\.env|"
            r"config(?:uration)? files?|chat history|conversation history|system prompt)\b"
            rf"{_S}{{0,60}}?\b(?:to|into|at)\b{_S}{{0,10}}?(?:[\w.+-]+@[\w-]+\.[\w.]+|https?://|webhook)",
            _F,
        ),
    ),
    InjectionRule(
        "safety_bypass", 0.55,
        re.compile(
            r"\b(?:disable|turn off|deactivate|bypass|circumvent|evade|get around)\b"
            rf"{_S}{{0,20}}?\b(?:safety|guardrails?|filters?|moderation|content polic(?:y|ies)|censorship|safeguards)\b",
            _F,
        ),
    ),
    InjectionRule(
        "safety_bypass_targeted", 0.75,
        re.compile(
            r"\b(?:disable|turn off|deactivate|bypass|ignore|circumvent|evade)\b"
            rf"{_S}{{0,10}}?\byour\s+(?:safety|security|guardrails?|filters?|moderation|restrictions|rules|safeguards)\b",
            _F,
        ),
    ),
    InjectionRule(
        "addressed_to_ai", 0.6,
        re.compile(
            r"\b(?:assistant|ai|chatbot|model|llm|gpt|claude|gemini|bot)\b[,:]?\s+(?:please\s+)?"
            r"(?:ignore|disregard|forget|reveal|send|execute|call|run|delete|output|print|you must|you should)\b"
            r"|\bif you are an? (?:ai|llm|language model|assistant)\b"
            r"|\b(?:ai|llm|language model|assistant)s? reading this\b",
            _F,
        ),
    ),
]

# Phrases that indicate the text is *about* an attack rather than issuing one.
_DISCUSSION = re.compile(
    r"\b(?:verify|verifies|ensure|ensures|check|checks|test|tests|testing|validate|validates|confirm|assert|"
    r"detect|detects|reject|rejects|block|blocks|flag|flags|should not|must not|shouldn't|prevent|prevents|"
    r"e\.g\.|for example|example|such as|payload|attack|attacker|prompt injection|malicious|adversarial|"
    r"sanitize|sanitizes|refuse|refuses)\b",
    _F,
)
_QUOTES = "\"'`“”‘’«»"
DISCUSSION_DISCOUNT = 0.45

_ZERO_WIDTH = re.compile("[­​-‏‪-‮⁠-⁤⁦-⁩﻿]")
_HOMOGLYPHS = str.maketrans({
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j",
    "ѕ": "s", "ԁ": "d", "һ": "h", "ӏ": "l", "ο": "o", "α": "a", "ε": "e", "ι": "i", "κ": "k",
    "ν": "v", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
    "А": "A", "Е": "E", "О": "O", "Р": "P", "С": "C", "Х": "X", "І": "I", "Ј": "J",
})
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"})
_SPACED_LETTERS = re.compile(r"\b(?:[A-Za-z][ ._\-*]){3,}[A-Za-z]\b")
_MIXED_SCRIPT_WORD = re.compile(r"\b(?=\w*[A-Za-z])(?=\w*[Ͱ-ϿЀ-ӿ])\w+\b")
_BASE64_BLOB = re.compile(r"(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{24,}={0,2}(?![A-Za-z0-9+/=])")
_URL_ENCODED = re.compile(r"(?:%[0-9A-Fa-f]{2}){4,}")


def strip_invisible(text: str) -> str:
    return _ZERO_WIDTH.sub("", text)


def deobfuscate(text: str) -> str:
    """Canonical form used only for matching (positions are not preserved)."""
    t = unicodedata.normalize("NFKC", text)
    t = strip_invisible(t).translate(_HOMOGLYPHS)
    if _URL_ENCODED.search(t):
        t = unquote(t)
    t = _SPACED_LETTERS.sub(lambda m: re.sub(r"[ ._\-*]", "", m.group(0)), t)
    t = t.translate(_LEET)
    return re.sub(r"\s+", " ", t)


def _decode_base64_blobs(text: str) -> list[str]:
    decoded = []
    for m in _BASE64_BLOB.finditer(text):
        blob = m.group(0)
        try:
            raw = base64.b64decode(blob + "=" * (-len(blob) % 4), validate=True)
            s = raw.decode("utf-8")
        except (binascii.Error, UnicodeDecodeError, ValueError):
            continue
        letters = sum(c.isalpha() or c.isspace() for c in s)
        if s and letters / len(s) > 0.7:
            decoded.append(s)
    return decoded


def _discussed(text: str, start: int, end: int) -> bool:
    line_start = max(text.rfind("\n", 0, start), max(text.rfind(c, 0, start) for c in ".!?")) + 1
    line_end_candidates = [i for i in (text.find("\n", end),) if i != -1]
    line_end = min(line_end_candidates) if line_end_candidates else len(text)
    before = text[line_start:start]
    after = text[end:line_end]
    quoted = any(q in before[-3:] for q in _QUOTES) and any(q in after for q in _QUOTES)
    return quoted or bool(_DISCUSSION.search(before))


class InjectionDetector:
    def __init__(self, rules: list[InjectionRule] | None = None):
        self.rules = list(rules or RULES)

    def register(self, rule: InjectionRule) -> None:
        self.rules.append(rule)

    def assess(self, text: str, source: Source = Source.USER, _depth: int = 0) -> InjectionReport:
        report = InjectionReport()
        if not text or not isinstance(text, str):
            return report

        weights: dict[str, float] = {}
        allow_discount = source.is_direct

        # 1. Rules on the original text (positions usable for redaction).
        for rule in self.rules:
            for m in rule.pattern.finditer(text):
                w = rule.weight
                if allow_discount and rule.discountable and _discussed(text, m.start(), m.end()):
                    w *= DISCUSSION_DISCOUNT
                weights[rule.id] = max(weights.get(rule.id, 0.0), w)
                report.spans.append((m.start(), m.end()))

        # 2. Rules on the de-obfuscated text: hits only visible here were hidden.
        canonical = deobfuscate(text)
        if canonical != re.sub(r"\s+", " ", text):
            for rule in self.rules:
                if rule.id in weights:
                    continue
                if rule.pattern.search(canonical):
                    weights[f"obfuscated:{rule.id}"] = min(1.0, rule.weight + 0.05)
                    report.obfuscated = True

        # 3. Obfuscation markers on their own.
        if _ZERO_WIDTH.search(text):
            weights["zero_width_chars"] = 0.25
        if _MIXED_SCRIPT_WORD.search(text):
            weights["mixed_script_homoglyphs"] = 0.25

        # 4. Encoded payloads (one level deep).
        if _depth == 0:
            for decoded in _decode_base64_blobs(text):
                inner = self.assess(decoded, source=Source.EXTERNAL, _depth=1)
                if inner.score > 0:
                    weights["encoded_payload"] = max(weights.get("encoded_payload", 0.0), min(1.0, inner.score * 0.9 + 0.1))
                    report.obfuscated = True

        survival = 1.0
        for w in weights.values():
            survival *= (1.0 - w)
        report.score = round(1.0 - survival, 4)
        report.signals = sorted(weights)
        return report


# ── Neutralization ───────────────────────────────────────────────────────────
_TEMPLATE_TOKENS = re.compile(r"<\|[a-z_]+\|>|\[/?INST\]|<</?SYS>>", _F)
_DELIMITER = re.compile(r"<(/?)\s*untrusted_data", _F)
REMOVED_MARKER = "[REMOVED: suspected prompt injection]"


def neutralize(text: str) -> str:
    """Defang structural attack vectors while keeping the text readable as data."""
    if not text:
        return text
    t = strip_invisible(text)
    t = _TEMPLATE_TOKENS.sub("[chat-token removed]", t)
    t = _DELIMITER.sub(lambda m: f"&lt;{m.group(1)}untrusted_data", t)
    return t


def redact_spans(text: str, spans: list[tuple[int, int]]) -> str:
    if not spans:
        return text
    merged: list[list[int]] = []
    for start, end in sorted(spans):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    out, cursor = [], 0
    for start, end in merged:
        out.append(text[cursor:start])
        out.append(REMOVED_MARKER)
        cursor = end
    out.append(text[cursor:])
    return "".join(out)


injection_detector = InjectionDetector()
