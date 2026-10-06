"""
ReDoS regression tests: every guardrail entry point must stay roughly linear
on adversarial input. A single request can carry 100 observed steps of up to
GUARDRAIL_MAX_INPUT_CHARS each, so a quadratic regex is a cheap DoS.
"""

import time

import pytest

from guardrails import Source, input_guardrail, masker, output_guardrail

SIZE = 20_000
# Linear checks finish in well under a second; the quadratic regexes this guards
# against took 7-15s at this size. 3s leaves headroom for a busy CI machine.
BUDGET_SECONDS = 3.0

ADVERSARIAL = {
    "newlines": "\n" * SIZE,
    "spaces": " " * SIZE,
    "hyphen_chain": "a-" * (SIZE // 2),
    "dot_chain": "a." * (SIZE // 2),
    "word_space_chain": "a " * (SIZE // 2),
    "digits": "1" * SIZE,
    "digit_space_chain": "1 " * (SIZE // 2),
    "at_signs": "a@" * (SIZE // 2),
    "think_openers": "<think>a" * (SIZE // 8),
    "untrusted_openers": "<untrusted_data " * (SIZE // 16),
    "colons": "a:" * (SIZE // 2),
    "equals": "a=" * (SIZE // 2),
    "name_cues": "name: Aaaa " * (SIZE // 11),
    "password_cues": "password: x " * (SIZE // 12),
    "base64ish": "QUJD" * (SIZE // 4),
    "address_words": "address " * (SIZE // 8),
    "ignore_words": "ignore previous " * (SIZE // 16),
    "url_chain": "http://a:" * (SIZE // 9),
}

ENTRY_POINTS = {
    "input_guardrail": lambda text: input_guardrail.validate(text, source=Source.USER),
    "contain_untrusted": lambda text: input_guardrail.contain(text, source=Source.RETRIEVED),
    "output_guardrail": lambda text: output_guardrail.validate(text),
    "log_masking": lambda text: masker.redact(text, stage="log"),
}


@pytest.mark.parametrize("entry", list(ENTRY_POINTS))
@pytest.mark.parametrize("payload", list(ADVERSARIAL))
def test_guardrails_are_not_vulnerable_to_redos(entry, payload):
    text = ADVERSARIAL[payload]
    start = time.perf_counter()
    ENTRY_POINTS[entry](text)
    elapsed = time.perf_counter() - start
    assert elapsed < BUDGET_SECONDS, f"{entry} took {elapsed:.2f}s on {payload!r} ({len(text)} chars)"
