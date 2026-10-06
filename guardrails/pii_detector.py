"""
guardrails/pii_detector.py — recognizers for personal data.

Structured identifiers use checksums or context words to keep false positives
low. Names and addresses are inherently fuzzy without an NER model, so they
are detected from strong context cues ("my name is", "Mr.", "Address:",
street suffixes). A heavier NER backend can be added through
EntityDetector.register() without touching callers.
"""

import re

from guardrails.detection import (
    PII,
    FunctionRecognizer,
    PatternRecognizer,
    aadhaar_valid,
    digits_only,
    iban_valid,
    ipv4_valid,
    ipv6_valid,
    luhn_valid,
)


# ── Email ────────────────────────────────────────────────────────────────────
EMAIL = PatternRecognizer(
    entity="EMAIL",
    kind=PII,
    pattern=re.compile(
        r"(?<![\w.+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,24}(?![\w-])"
    ),
    score=0.95,
)


# ── Phone ────────────────────────────────────────────────────────────────────
_PHONE_CANDIDATE = re.compile(
    r"(?<![\w+/.-])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?)?\d[\d\s.-]{6,16}\d(?![\w/-])"
)
_DATE_INSIDE = re.compile(r"(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)\d{2}")
_PHONE_CONTEXT = re.compile(r"(?i)(?:phone|mobile|mob|tel|telephone|contact|call|whatsapp|cell|ph)\W{0,3}(?:no|number|num)?\W{0,3}$")


def _find_phones(text: str):
    for m in _PHONE_CANDIDATE.finditer(text):
        value = m.group(0).strip()
        start = m.start() + (len(m.group(0)) - len(m.group(0).lstrip()))
        end = start + len(value)
        digits = digits_only(value)
        if not 10 <= len(digits) <= 15:
            continue
        if _DATE_INSIDE.search(value):
            continue
        if value.count(".") >= 3 and not re.search(r"[\s()+-]", value):
            continue  # IPv4-like
        has_separators = bool(re.search(r"[\s().-]", value)) or value.startswith("+")
        has_context = bool(_PHONE_CONTEXT.search(text[max(0, start - 25):start]))
        indian_mobile = bool(re.fullmatch(r"(?:91|0)?[6-9]\d{9}", digits))
        if has_context:
            yield start, end, 0.9
        elif indian_mobile or value.startswith("+"):
            yield start, end, 0.8
        elif has_separators and len(digits) in (10, 11):
            yield start, end, 0.7


PHONE = FunctionRecognizer(entity="PHONE", kind=PII, func=_find_phones)


# ── Aadhaar (UIDAI, Verhoeff checksum) ───────────────────────────────────────
_AADHAAR_CANDIDATE = re.compile(r"(?<![\d-])\d{4}([ -]?)\d{4}\1\d{4}(?![\d-])")
_AADHAAR_CONTEXT = re.compile(r"(?i)(?:aadhaar|aadhar|adhaar|uidai|\buid\b)")


def _find_aadhaar(text: str):
    for m in _AADHAAR_CANDIDATE.finditer(text):
        value = m.group(0)
        if aadhaar_valid(value):
            yield m.start(), m.end(), 0.95
        elif _AADHAAR_CONTEXT.search(text[max(0, m.start() - 40):m.start()]):
            yield m.start(), m.end(), 0.9
        elif m.group(1):  # 4-4-4 grouping is the canonical Aadhaar layout
            yield m.start(), m.end(), 0.8


AADHAAR = FunctionRecognizer(entity="AADHAAR", kind=PII, func=_find_aadhaar)


# ── PAN (Indian Permanent Account Number) ────────────────────────────────────
PAN = PatternRecognizer(
    entity="PAN",
    kind=PII,
    pattern=re.compile(r"(?<![A-Za-z0-9])[A-Z]{5}\d{4}[A-Z](?![A-Za-z0-9])"),
    score=0.95,
    # 4th character encodes holder type for real PANs (P, C, H, F, A, T, B, L, J, G).
    validator=lambda v: v[3] in "PCHFATBLJG",
    invalid_score=0.85,
)


# ── Payment cards (Luhn) ─────────────────────────────────────────────────────
CREDIT_CARD = PatternRecognizer(
    entity="CREDIT_CARD",
    kind=PII,
    pattern=re.compile(r"(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])"),
    score=0.95,
    validator=luhn_valid,
    context=("card", "credit", "debit", "visa", "mastercard", "amex", "rupay", "cc", "cvv"),
    context_score=0.8,
)


# ── Bank accounts ────────────────────────────────────────────────────────────
BANK_ACCOUNT = PatternRecognizer(
    entity="BANK_ACCOUNT",
    kind=PII,
    pattern=re.compile(r"(?<![\d-])\d{9,18}(?![\d-])"),
    score=0.85,
    context=("account", "a/c", "acct", "acc no", "acc. no", "bank", "savings", "beneficiary"),
    require_context=True,
)

IBAN = PatternRecognizer(
    entity="BANK_ACCOUNT",
    kind=PII,
    pattern=re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b"),
    score=0.95,
    validator=iban_valid,
)


# ── UPI IDs (VPA) ────────────────────────────────────────────────────────────
_UPI_HANDLES = {
    "ybl", "ibl", "axl", "upi", "apl", "yapl", "paytm", "okaxis", "okhdfcbank", "okicici",
    "oksbi", "ptyes", "ptsbi", "pthdfc", "ptaxis", "axisbank", "hdfcbank", "icici", "sbi",
    "kotak", "freecharge", "airtel", "jio", "slice", "fam", "abfspay", "waaxis",
    "wahdfcbank", "wasbi", "ikwik", "mbk", "idfcbank", "indus", "federal", "rbl",
    "yesbank", "aubank", "barodampay", "pnb", "cnrb", "boi", "unionbank", "dbs",
    "hsbc", "sc", "citi", "juspay", "axisb", "ezeepay", "pingpay",
}

UPI = PatternRecognizer(
    entity="UPI_ID",
    kind=PII,
    pattern=re.compile(r"(?<![\w.@-])[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z]{2,20}(?![\w.@-])"),
    score=0.9,
    validator=lambda v: v.rsplit("@", 1)[1].lower() in _UPI_HANDLES,
    context=("upi", "vpa", "gpay", "phonepe", "paytm", "bhim"),
    context_score=0.85,
)


# ── IP addresses ─────────────────────────────────────────────────────────────
IPV4 = PatternRecognizer(
    entity="IP_ADDRESS",
    kind=PII,
    # A trailing sentence period is allowed; a fifth octet is not.
    pattern=re.compile(r"(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?!\d|\.\d)"),
    score=0.9,
    validator=ipv4_valid,
)

IPV6 = PatternRecognizer(
    entity="IP_ADDRESS",
    kind=PII,
    pattern=re.compile(r"(?<![\w:])(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?![\w:])"),
    score=0.9,
    validator=ipv6_valid,
)


# ── Government IDs ───────────────────────────────────────────────────────────
PASSPORT_IN = PatternRecognizer(
    entity="PASSPORT",
    kind=PII,
    pattern=re.compile(r"(?<![A-Za-z0-9])[A-PR-WY][1-9]\d{6}(?![A-Za-z0-9])"),
    score=0.6,
    context=("passport",),
    context_score=0.9,
)

PASSPORT_GENERIC = PatternRecognizer(
    entity="PASSPORT",
    kind=PII,
    pattern=re.compile(r"(?<![A-Za-z0-9])(?=[A-Z0-9]*\d)[A-Z0-9]{6,9}(?![A-Za-z0-9])"),
    score=0.85,
    context=("passport",),
    require_context=True,
    context_window=30,
)

SSN = PatternRecognizer(
    entity="GOV_ID",
    kind=PII,
    pattern=re.compile(r"(?<![\d-])(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?![\d-])"),
    score=0.85,
    context=("ssn", "social security"),
    context_score=0.95,
)

VOTER_ID = PatternRecognizer(
    entity="GOV_ID",
    kind=PII,
    pattern=re.compile(r"(?<![A-Za-z0-9])[A-Z]{3}\d{7}(?![A-Za-z0-9])"),
    score=0.85,
    context=("voter", "epic", "election"),
    require_context=True,
)

DRIVING_LICENSE_IN = PatternRecognizer(
    entity="GOV_ID",
    kind=PII,
    pattern=re.compile(r"(?<![A-Za-z0-9])[A-Z]{2}[- ]?\d{2}[- ]?(?:19|20)\d{2}\d{7}(?![A-Za-z0-9])"),
    score=0.85,
    context=("driving", "licence", "license", "dl no", "dl"),
    require_context=True,
)


# ── Person names (context-driven) ────────────────────────────────────────────
_NAME = r"[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?(?:[ ](?:[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?|[A-Z]\.)){0,3}"
_NAME_CUES = re.compile(
    r"(?:(?i:\bmy name is|\bi am called|\bfull name\s*[:=-]?|\bcustomer name\s*[:=-]?|"
    r"\bcontact person\s*[:=-]?|\bname\s*[:=-]|\bdear)\s+"
    r"|\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Shri|Smt|Sri)\.?\s+)"
    rf"(?P<name>{_NAME})"
)
_NAME_BEFORE_EMAIL = re.compile(rf"(?P<name>{_NAME})\s*<[^<>@\s]+@")
# "Field name: Email" or "Project name: Apollo" are not people.
_NON_PERSON_NAME_OWNERS = re.compile(
    r"(?i)\b(?:field|file|user|display|module|project|test|column|table|class|function|"
    r"variable|method|host|domain|server|app|application|product|company|org|organization|"
    r"team|workspace|package|branch|repo|repository|bucket|database|db|event|screen|page|"
    r"button|key|tag|label|role|model|device|browser|feature|component|service)\s*$"
)


def _find_names(text: str):
    for m in _NAME_CUES.finditer(text):
        cue_start = m.start()
        if _NON_PERSON_NAME_OWNERS.search(text[max(0, cue_start - 20):cue_start]):
            continue
        yield m.start("name"), m.end("name"), 0.75
    for m in _NAME_BEFORE_EMAIL.finditer(text):
        if " " in m.group("name").strip():
            yield m.start("name"), m.end("name"), 0.75


PERSON = FunctionRecognizer(entity="PERSON", kind=PII, func=_find_names)


# ── Physical addresses ───────────────────────────────────────────────────────
_STREET_SUFFIX = (
    r"(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Boulevard|Blvd|Drive|Nagar|Marg|Colony|"
    r"Sector|Layout|Cross|Highway|Hwy|Court|Ct|Place|Square|Terrace|Circle|Chowk|"
    r"Bazaar|Apartments?|Society|Enclave|Vihar|Puram|Bagh)"
)
_STREET_ADDRESS = re.compile(
    rf"\b\d{{1,5}}[A-Za-z]?(?:[-/]\d{{1,4}})?,?\s+(?:[A-Z][A-Za-z0-9.'-]*\s+){{0,4}}{_STREET_SUFFIX}\b\.?"
    r"(?:,\s*[A-Z][A-Za-z .'-]{1,40}){0,3}(?:[,\s-]+[1-9]\d{2}\s?\d{3}\b|\s+\d{5}(?:-\d{4})?\b)?"
)
_UNIT_ADDRESS = re.compile(
    r"(?i:\b(?:flat|house|h\.?\s?no|door|plot|apt|apartment|suite)\.?\s*(?:no\.?|number|#)?\s*[:\-]?\s*)"
    r"[A-Za-z0-9/-]{1,10}(?:,\s*[A-Za-z0-9 .'-]{2,40}){1,4}"
)
# Anchored on "address:" itself; the word before it is inspected separately.
# (An optional greedy owner prefix here was tried from every word boundary,
# which is quadratic on long hyphenated text.)
_ADDRESS_LABEL = re.compile(r"(?i)\baddress[ \t]*[:=-][ \t]*(?P<value>[^\n]{5,160})")
_OWNER_WORD = re.compile(r"(?i)([a-z][a-z-]{0,30})[ \t]+$")
_NON_POSTAL_ADDRESS = {
    "email", "e-mail", "ip", "mac", "web", "wallet", "url", "server", "memory",
    "network", "hardware", "bitcoin", "contract", "ipv4", "ipv6", "return", "base",
}


def _find_addresses(text: str):
    for m in _STREET_ADDRESS.finditer(text):
        yield m.start(), m.end(), 0.7
    for m in _UNIT_ADDRESS.finditer(text):
        yield m.start(), m.end(), 0.7
    for m in _ADDRESS_LABEL.finditer(text):
        before = _OWNER_WORD.search(text[max(0, m.start() - 32):m.start()])
        owner = before.group(1).lower() if before else ""
        if owner in _NON_POSTAL_ADDRESS:
            continue
        yield m.start("value"), m.end("value"), 0.7


ADDRESS = FunctionRecognizer(entity="ADDRESS", kind=PII, func=_find_addresses)

PIN_CODE = PatternRecognizer(
    entity="ADDRESS",
    kind=PII,
    pattern=re.compile(r"(?<!\d)[1-9]\d{2}\s?\d{3}(?!\d)"),
    score=0.75,
    context=("pincode", "pin code", "postal code", "zip", "zip code", "postcode"),
    require_context=True,
    context_window=20,
)


def build_pii_recognizers():
    return [
        EMAIL, PHONE, AADHAAR, PAN, CREDIT_CARD, BANK_ACCOUNT, IBAN, UPI,
        IPV4, IPV6, PASSPORT_IN, PASSPORT_GENERIC, SSN, VOTER_ID,
        DRIVING_LICENSE_IN, PERSON, ADDRESS, PIN_CODE,
    ]
