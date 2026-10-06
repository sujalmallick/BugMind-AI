"""
guardrails/data_masker.py — centralized masking / sanitization.

Default behaviour is irreversible redaction that keeps sentence structure:

    "Send an email to john.doe@gmail.com"  →  "Send an email to [EMAIL_REDACTED]"

Reversible masking is opt-in and scoped: pass a MaskingVault, and PII values
become indexed tokens ([NAME_1]) whose originals live only inside that vault
object in memory. Secrets never enter a vault — they are always redacted.
"""

import re
from dataclasses import dataclass, field
from typing import Any

from guardrails.config import get_settings
from guardrails.detection import PII, SECRET, EntityDetector, Span
from guardrails.policy_engine import policy
from guardrails.pii_detector import build_pii_recognizers
from guardrails.secret_detector import build_secret_recognizers


PLACEHOLDER_LABELS = {
    "EMAIL": "EMAIL",
    "PHONE": "PHONE",
    "AADHAAR": "AADHAAR",
    "PAN": "PAN",
    "CREDIT_CARD": "CARD",
    "BANK_ACCOUNT": "BANK_ACCOUNT",
    "UPI_ID": "UPI",
    "IP_ADDRESS": "IP",
    "PASSPORT": "PASSPORT",
    "GOV_ID": "GOV_ID",
    "PERSON": "NAME",
    "ADDRESS": "ADDRESS",
    "API_KEY": "API_KEY",
    "JWT": "TOKEN",
    "ACCESS_TOKEN": "TOKEN",
    "SESSION_TOKEN": "SESSION_TOKEN",
    "PASSWORD": "PASSWORD",
    "URL_CREDENTIALS": "PASSWORD",
    "PRIVATE_KEY": "PRIVATE_KEY",
    "CONNECTION_STRING": "CONNECTION_STRING",
    "SECRET": "SECRET",
}

PLACEHOLDER_RE = re.compile(r"\[[A-Z_]+_(?:REDACTED|\d+)\]")
_VAULT_TOKEN_RE = re.compile(r"\[([A-Z_]+_\d+)\]")


def placeholder_label(entity: str) -> str:
    return PLACEHOLDER_LABELS.get(entity, entity)


class MaskingVault:
    """
    Short-lived, in-memory map of reversible tokens → original PII.

    Use as a context manager so it is wiped when the operation ends. It cannot
    be printed, pickled or serialized, so it never reaches logs, traces,
    persistence, or the LLM.
    """

    __slots__ = ("_forward", "_reverse", "_counters")

    def __init__(self):
        self._forward: dict[tuple[str, str], str] = {}
        self._reverse: dict[str, str] = {}
        self._counters: dict[str, int] = {}

    def __repr__(self) -> str:
        return f"<MaskingVault entries={len(self._reverse)}>"

    __str__ = __repr__

    def __reduce__(self):
        raise TypeError("MaskingVault cannot be serialized")

    def __enter__(self) -> "MaskingVault":
        return self

    def __exit__(self, *exc) -> None:
        self.clear()

    def __len__(self) -> int:
        return len(self._reverse)

    def token_for(self, label: str, value: str) -> str:
        key = (label, value)
        if key not in self._forward:
            self._counters[label] = self._counters.get(label, 0) + 1
            token = f"{label}_{self._counters[label]}"
            self._forward[key] = token
            self._reverse[token] = value
        return f"[{self._forward[key]}]"

    def unmask(self, text: str) -> str:
        if not text or not self._reverse:
            return text
        return _VAULT_TOKEN_RE.sub(lambda m: self._reverse.get(m.group(1), m.group(0)), text)

    def unmask_obj(self, obj: Any) -> Any:
        if isinstance(obj, str):
            return self.unmask(obj)
        if isinstance(obj, dict):
            return {k: self.unmask_obj(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return type(obj)(self.unmask_obj(v) for v in obj)
        return obj

    def clear(self) -> None:
        self._forward.clear()
        self._reverse.clear()
        self._counters.clear()


@dataclass
class MaskResult:
    text: str
    entity_counts: dict[str, int] = field(default_factory=dict)

    @property
    def changed(self) -> bool:
        return bool(self.entity_counts)

    def __str__(self) -> str:
        return self.text


class DataMasker:
    def __init__(self, detector: EntityDetector | None = None):
        self.detector = detector or EntityDetector(
            build_secret_recognizers() + build_pii_recognizers()
        )

    def detect(
        self,
        text: str,
        *,
        kinds: tuple[str, ...] = (PII, SECRET),
        stage: str = "input",
    ) -> list[Span]:
        settings = get_settings()
        spans = self.detector.detect(
            text,
            kinds=kinds,
            # Disabling an entity only ever applies to PII; secrets are always detected.
            exclude_entities=(settings.disabled_entities - _SECRET_ENTITIES) | policy.stage_exclusions(stage),
            min_score=settings.min_detection_score,
        )
        if stage == "output" and settings.safe_email_domains:
            spans = [s for s in spans if not _is_safe_email(text, s, settings.safe_email_domains)]
        return spans

    def mask(
        self,
        text: str,
        *,
        kinds: tuple[str, ...] = (PII, SECRET),
        stage: str = "input",
        vault: MaskingVault | None = None,
    ) -> MaskResult:
        if not isinstance(text, str) or not text:
            return MaskResult(text=text if isinstance(text, str) else "")

        spans = self.detect(text, kinds=kinds, stage=stage)
        if not spans:
            return MaskResult(text=text)

        indexed = get_settings().mask_style == "indexed"
        local_index: dict[tuple[str, str], int] = {}
        local_counter: dict[str, int] = {}
        counts: dict[str, int] = {}
        out: list[str] = []
        cursor = 0

        for span in spans:
            value = text[span.start:span.end]
            label = placeholder_label(span.entity)
            if vault is not None and span.kind == PII:
                token = vault.token_for(label, value)
            elif indexed and span.kind == PII:
                key = (label, value)
                if key not in local_index:
                    local_counter[label] = local_counter.get(label, 0) + 1
                    local_index[key] = local_counter[label]
                token = f"[{label}_{local_index[key]}]"
            else:
                token = f"[{label}_REDACTED]"
            out.append(text[cursor:span.start])
            out.append(token)
            cursor = span.end
            counts[span.entity] = counts.get(span.entity, 0) + 1

        out.append(text[cursor:])
        return MaskResult(text="".join(out), entity_counts=counts)

    def redact(self, text: str, **kwargs) -> str:
        return self.mask(text, **kwargs).text

    def mask_obj(self, obj: Any, **kwargs) -> tuple[Any, dict[str, int]]:
        """Recursively mask every string in a JSON-like structure (keys untouched)."""
        counts: dict[str, int] = {}

        def walk(value: Any) -> Any:
            if isinstance(value, str):
                result = self.mask(value, **kwargs)
                for k, v in result.entity_counts.items():
                    counts[k] = counts.get(k, 0) + v
                return result.text
            if isinstance(value, dict):
                return {k: walk(v) for k, v in value.items()}
            if isinstance(value, (list, tuple)):
                return type(value)(walk(v) for v in value)
            return value

        return walk(obj), counts


_SECRET_ENTITIES = frozenset(
    {
        "API_KEY", "JWT", "ACCESS_TOKEN", "SESSION_TOKEN", "PASSWORD", "URL_CREDENTIALS",
        "PRIVATE_KEY", "CONNECTION_STRING", "SECRET",
    }
)


def _is_safe_email(text: str, span: Span, safe_domains: frozenset[str]) -> bool:
    if span.entity != "EMAIL":
        return False
    domain = text[span.start:span.end].rsplit("@", 1)[-1].lower()
    return any(domain == d or domain.endswith("." + d) for d in safe_domains) or domain.endswith(
        (".test", ".example", ".invalid", ".localhost")
    )


masker = DataMasker()
