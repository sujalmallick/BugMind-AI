"""
guardrails/secret_detector.py — recognizers for credentials and secrets.

Secrets are always redacted irreversibly, regardless of PII settings.

Three layers:
  1. Known formats (provider key prefixes, JWTs, PEM keys, connection strings).
  2. Contextual assignments ("password: X", "api_key=X", "Bearer X").
  3. Exact matches against secret values that live in this process
     (secret-like environment variables + keys registered at runtime, e.g. a
     user's decrypted BYOK key). Their values are never logged.
"""

import base64
import os
import re
import threading
from collections import OrderedDict

from guardrails.detection import (
    SECRET,
    FunctionRecognizer,
    PatternRecognizer,
    shannon_entropy,
)


# ── Private keys ─────────────────────────────────────────────────────────────
PRIVATE_KEY = PatternRecognizer(
    entity="PRIVATE_KEY",
    kind=SECRET,
    pattern=re.compile(
        r"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----"
        r"(?:[\s\S]*?-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----|[\s\S]*\Z)"
    ),
    score=0.99,
)


# ── JWT ──────────────────────────────────────────────────────────────────────
JWT = PatternRecognizer(
    entity="JWT",
    kind=SECRET,
    pattern=re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}"),
    score=0.99,
)


# ── Provider API keys (known prefixes) ───────────────────────────────────────
_API_KEY_PATTERNS = [
    r"sk-ant-[A-Za-z0-9_-]{20,}",                    # Anthropic
    r"sk-or-v1-[A-Za-z0-9]{32,}",                    # OpenRouter
    r"sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{16,}",  # OpenAI & compatible
    r"gsk_[A-Za-z0-9]{20,}",                         # Groq
    r"AIza[0-9A-Za-z_-]{35}",                        # Google
    r"(?:AKIA|ASIA)[0-9A-Z]{16}",                    # AWS access key id
    r"gh[pousr]_[A-Za-z0-9]{36,}",                   # GitHub
    r"github_pat_[A-Za-z0-9_]{22,}",                 # GitHub fine-grained
    r"glpat-[A-Za-z0-9_-]{20,}",                     # GitLab
    r"xox[abposr]-[A-Za-z0-9-]{10,}",                # Slack
    r"(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}",  # Stripe
    r"SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}",   # SendGrid
    r"hf_[A-Za-z0-9]{30,}",                          # Hugging Face
    r"ls(?:v2)?_(?:pt|sk)_[A-Za-z0-9_]{20,}",        # LangSmith
    r"npm_[A-Za-z0-9]{36}",                          # npm
]
API_KEY = PatternRecognizer(
    entity="API_KEY",
    kind=SECRET,
    pattern=re.compile(r"(?<![A-Za-z0-9_-])(?:" + "|".join(_API_KEY_PATTERNS) + r")(?![A-Za-z0-9_-])"),
    score=0.97,
)

AWS_SECRET_KEY = PatternRecognizer(
    entity="API_KEY",
    kind=SECRET,
    pattern=re.compile(r"(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])"),
    score=0.9,
    context=("aws_secret", "secret_access_key", "aws secret", "secretaccesskey"),
    require_context=True,
)


# ── Bearer / Basic auth ──────────────────────────────────────────────────────
BEARER_TOKEN = PatternRecognizer(
    entity="ACCESS_TOKEN",
    kind=SECRET,
    pattern=re.compile(r"(?i)\bbearer\s+(?P<v>[A-Za-z0-9\-._~+/]{16,}=*)"),
    group="v",
    score=0.95,
)


def _is_basic_credential(value: str) -> bool:
    try:
        decoded = base64.b64decode(value + "=" * (-len(value) % 4), validate=True).decode("utf-8")
    except Exception:
        return False
    return ":" in decoded and decoded.isprintable()


BASIC_AUTH = PatternRecognizer(
    entity="ACCESS_TOKEN",
    kind=SECRET,
    pattern=re.compile(r"(?i)\bbasic\s+(?P<v>[A-Za-z0-9+/]{12,}={0,2})"),
    group="v",
    score=0.9,
    validator=_is_basic_credential,
)


# ── Connection strings ───────────────────────────────────────────────────────
CONNECTION_URL = PatternRecognizer(
    entity="CONNECTION_STRING",
    kind=SECRET,
    pattern=re.compile(
        r"(?i)\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?|mssql|"
        r"sqlserver|oracle|cockroachdb|clickhouse|snowflake|jdbc:[a-z0-9]+)(?:\+[a-z0-9]+)?://[^\s'\"<>`]+"
    ),
    score=0.95,
)

_KV_SECRET_KEYS = re.compile(r"(?i)(?:password|pwd|accountkey|sharedaccesskey|accesskey|sharedaccesssignature)=")
KV_CONNECTION_STRING = PatternRecognizer(
    entity="CONNECTION_STRING",
    kind=SECRET,
    pattern=re.compile(
        r"(?i)\b(?:server|data source|host|endpoint|defaultendpointsprotocol|accountname)=[^\s;]+;"
        r"(?:\s?[A-Za-z ]{2,30}=[^\s;]*;?){1,14}"
    ),
    score=0.95,
    validator=lambda v: bool(_KV_SECRET_KEYS.search(v)),
)

URL_CREDENTIALS = PatternRecognizer(
    entity="URL_CREDENTIALS",
    kind=SECRET,
    pattern=re.compile(r"(?i)\b[a-z][a-z0-9+.-]{1,20}://[^\s:/@]+:(?P<v>[^\s@/]+)@"),
    group="v",
    score=0.95,
)


# ── Contextual credential assignments ────────────────────────────────────────
_PLACEHOLDER = re.compile(r"^(?:[<\[{(].*[>\]})]|\*+|x+|\.+|•+|#+|your[_-].*|\$\{?\w+\}?|%\w+%)$", re.I)
_NOT_A_SECRET = {
    "required", "invalid", "incorrect", "empty", "blank", "wrong", "correct", "valid",
    "mandatory", "missing", "hidden", "masked", "shown", "visible", "displayed", "reset",
    "changed", "expired", "field", "fields", "input", "null", "none", "true", "false",
    "n/a", "na", "optional", "strong", "weak", "too", "not", "the", "a", "an", "and", "or",
    "should", "must", "will", "minimum", "maximum", "min", "max", "length", "characters",
    "chars", "policy", "strength", "mismatch", "match", "matches", "confirm", "confirmation",
    "entered", "provided", "updated", "set", "unset", "redacted", "undefined", "string",
    "text", "value", "example", "sample", "dummy", "test", "same", "different", "only",
    "accepted", "rejected", "allowed", "disabled", "enabled", "encrypted", "hashed",
    "generated", "sent", "received", "stored", "saved", "used", "new", "old", "current",
    "field.", "it", "is", "of", "to", "be", "has", "have", "with", "without", "via", "in",
}


def _strip_value(value: str) -> str:
    return value.rstrip(".,;:)]}!?")


def _looks_like_secret(value: str, strict: bool) -> bool:
    value = _strip_value(value)
    if not value or value.lower() in _NOT_A_SECRET or _PLACEHOLDER.match(value):
        return False
    if strict:
        has_digit = any(c.isdigit() for c in value)
        has_alpha = any(c.isalpha() for c in value)
        has_symbol = any(not c.isalnum() for c in value)
        mixed_case = any(c.islower() for c in value) and any(c.isupper() for c in value)
        return len(value) >= 6 and (has_digit or has_symbol or mixed_case) and (has_alpha or has_digit)
    return True


_PASSWORD_ASSIGNMENT = re.compile(
    r"(?i)\b(?:password|passwd|passphrase|pwd|passcode|pass|pin)\b"
    r"(?:\s+for\s+[\w.@-]+)?\s*(?P<op>[:=]|\bis\b|\bwas\b|\bas\b)\s*[\"'`]?(?P<v>[^\s\"'`,;]{3,128})"
)


def _find_passwords(text: str):
    for m in _PASSWORD_ASSIGNMENT.finditer(text):
        strict = m.group("op") not in (":", "=")
        raw = m.group("v")
        value = _strip_value(raw)
        if not _looks_like_secret(value, strict=strict):
            continue
        start = m.start("v")
        yield start, start + len(value), 0.9


PASSWORD = FunctionRecognizer(entity="PASSWORD", kind=SECRET, func=_find_passwords)


_CREDENTIAL_ASSIGNMENT = re.compile(
    r"(?i)(?<![A-Za-z0-9])(?P<k>api[_-]?key|apikey|x-api-key|secret[_-]?key|client[_-]?secret|"
    r"secret|access[_-]?token|auth[_-]?token|refresh[_-]?token|id[_-]?token|"
    r"session[_-]?(?:id|token|key)|sessionid|csrf[_-]?token|token|private[_-]?key|"
    r"access[_-]?key(?:[_-]?id)?|secret[_-]?access[_-]?key|account[_-]?key|sas[_-]?token|"
    r"encryption[_-]?key|signing[_-]?key)(?![A-Za-z0-9])"
    r"[\"']?\s*(?:[:=]|=>)\s*[\"']?(?P<v>[^\s\"',;]{8,512})"
)


def _credential_entity(key: str) -> str:
    key = key.lower()
    if "session" in key or "csrf" in key:
        return "SESSION_TOKEN"
    if "token" in key:
        return "ACCESS_TOKEN"
    return "API_KEY"


def _make_credential_finder(entity: str):
    def finder(text: str):
        for m in _CREDENTIAL_ASSIGNMENT.finditer(text):
            if _credential_entity(m.group("k")) != entity:
                continue
            value = _strip_value(m.group("v"))
            if len(value) < 8 or not _looks_like_secret(value, strict=True):
                continue
            start = m.start("v")
            yield start, start + len(value), 0.9
    return finder


API_KEY_ASSIGNMENT = FunctionRecognizer("API_KEY", SECRET, _make_credential_finder("API_KEY"))
ACCESS_TOKEN_ASSIGNMENT = FunctionRecognizer("ACCESS_TOKEN", SECRET, _make_credential_finder("ACCESS_TOKEN"))
SESSION_TOKEN_ASSIGNMENT = FunctionRecognizer("SESSION_TOKEN", SECRET, _make_credential_finder("SESSION_TOKEN"))

COOKIE_SESSION = PatternRecognizer(
    entity="SESSION_TOKEN",
    kind=SECRET,
    pattern=re.compile(
        r"(?i)\b(?:sessionid|session_id|phpsessid|jsessionid|connect\.sid|asp\.net_sessionid|sid)=(?P<v>[A-Za-z0-9%._-]{12,})"
    ),
    group="v",
    score=0.9,
)


# ── High-entropy blobs ───────────────────────────────────────────────────────
_HIGH_ENTROPY = re.compile(r"(?<![\w/+=-])[A-Za-z0-9_\-+/=]{32,}(?![\w/+=-])")
_HEX_OR_UUID = re.compile(r"^(?:[0-9a-fA-F]+|[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12})$")


def _find_high_entropy(text: str):
    for m in _HIGH_ENTROPY.finditer(text):
        value = m.group(0)
        if _HEX_OR_UUID.match(value):
            continue  # commit hashes / UUIDs are identifiers, not credentials
        has_digit = any(c.isdigit() for c in value)
        has_upper = any(c.isupper() for c in value)
        has_lower = any(c.islower() for c in value)
        if not (has_digit and has_upper and has_lower):
            continue
        if shannon_entropy(value) >= 4.0:
            yield m.start(), m.end(), 0.6


HIGH_ENTROPY_SECRET = FunctionRecognizer("SECRET", SECRET, _find_high_entropy)


# ── Known in-process secrets ─────────────────────────────────────────────────
_SECRET_ENV_NAME = re.compile(
    r"(?i)(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|_PWD|CONNECTION_STRING|DATABASE_URL|_DSN|CREDENTIAL|ACCESS_KEY)"
)
# Path-valued variables match the name pattern but are not secrets.
_NON_SECRET_ENV_NAME = re.compile(r"(?i)(?:^OLDPWD$|^PWD$|_PATH$|_FILE$|_DIR$)")


def _strong_enough(value: str) -> bool:
    """Only exact-match values that cannot collide with ordinary words."""
    value = value.strip().strip("'\"")
    if len(value) < 8 or value.lower() in {"true", "false", "none", "null"}:
        return False
    has_digit = any(c.isdigit() for c in value)
    has_alpha = any(c.isalpha() for c in value)
    return len(value) >= 12 or (has_digit and has_alpha)


class KnownSecretRegistry:
    """
    Values that must never leave the process: secret-looking environment
    variables plus runtime-registered secrets (bounded LRU). Values are kept
    only in memory and never logged or serialized.
    """

    def __init__(self, max_runtime: int = 256):
        self._lock = threading.Lock()
        self._runtime: OrderedDict[str, None] = OrderedDict()
        self._max_runtime = max_runtime
        self._cached_values: frozenset[str] = frozenset()
        self._pattern: re.Pattern | None = None

    def __repr__(self) -> str:
        return f"<KnownSecretRegistry runtime={len(self._runtime)}>"

    def __reduce__(self):  # never pickle secret values
        raise TypeError("KnownSecretRegistry cannot be serialized")

    def register(self, value: str | None) -> None:
        if not value or not _strong_enough(value):
            return
        value = value.strip().strip("'\"")
        with self._lock:
            self._runtime[value] = None
            self._runtime.move_to_end(value)
            while len(self._runtime) > self._max_runtime:
                self._runtime.popitem(last=False)

    def _current_values(self) -> frozenset[str]:
        env_values = {
            v.strip().strip("'\"")
            for k, v in os.environ.items()
            if v
            and _SECRET_ENV_NAME.search(k)
            and not _NON_SECRET_ENV_NAME.search(k)
            and _strong_enough(v)
        }
        with self._lock:
            env_values.update(self._runtime.keys())
        return frozenset(env_values)

    def pattern(self) -> re.Pattern | None:
        values = self._current_values()
        if values != self._cached_values:
            ordered = sorted(values, key=len, reverse=True)
            self._pattern = re.compile("|".join(re.escape(v) for v in ordered)) if ordered else None
            self._cached_values = values
        return self._pattern

    def find(self, text: str):
        pat = self.pattern()
        if pat is None:
            return
        for m in pat.finditer(text):
            yield m.start(), m.end(), 0.99


known_secrets = KnownSecretRegistry()
KNOWN_SECRET = FunctionRecognizer("SECRET", SECRET, known_secrets.find)


def build_secret_recognizers():
    return [
        PRIVATE_KEY, JWT, API_KEY, AWS_SECRET_KEY, BEARER_TOKEN, BASIC_AUTH,
        CONNECTION_URL, KV_CONNECTION_STRING, URL_CREDENTIALS, PASSWORD,
        API_KEY_ASSIGNMENT, ACCESS_TOKEN_ASSIGNMENT, SESSION_TOKEN_ASSIGNMENT,
        COOKIE_SESSION, HIGH_ENTROPY_SECRET, KNOWN_SECRET,
    ]
