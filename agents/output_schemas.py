"""
agents/output_schemas.py

Pydantic contracts for every agent's output. The LLM's JSON is untrusted and
often slightly off-spec, so each model coerces leniently (case, synonyms,
missing fields) into the exact shape the frontend and database expect.

Entries that can't be salvaged (non-objects, blank text, no module name) are
dropped by parse_items() instead of failing the whole response.
"""

import re
from typing import Any, Literal

from pydantic import BaseModel, ValidationError, ValidationInfo, model_validator

Level = Literal["High", "Medium", "Low"]

LEVEL_MAP = {
    "high": "High",
    "critical": "High",
    "p0": "High",
    "p1": "High",
    "medium": "Medium",
    "p2": "Medium",
    "low": "Low",
    "p3": "Low",
}

CATEGORY_MAP = {
    "functional": "Functional",
    "negative": "Negative",
    "edge case": "Edge Case",
    "edgecase": "Edge Case",
    "security": "Security",
    "regression": "Regression",
}


def _text(value: Any, default: str = "") -> str:
    """str() + strip, treating missing/None as the default."""
    if value is None:
        return default
    return str(value).strip()


def _level(value: Any) -> str:
    return LEVEL_MAP.get(_text(value, "Medium").lower(), "Medium")


def _str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if item is not None and str(item).strip()]


def parse_items(model: type[BaseModel], raw: Any, context: dict | None = None) -> list[BaseModel]:
    """Validate each element of a list, skipping the ones that can't be repaired."""
    if not isinstance(raw, list):
        return []
    parsed = []
    for item in raw:
        try:
            parsed.append(model.model_validate(item, context=context))
        except ValidationError:
            continue
    return parsed


def unwrap_list(raw: Any, key: str) -> Any:
    """
    Array-returning agents ask for {"<key>": [...]} so provider JSON mode
    (which requires a top-level object) can be used. Accept either form.
    """
    if isinstance(raw, dict):
        if isinstance(raw.get(key), list):
            return raw[key]
        lists = [v for v in raw.values() if isinstance(v, list)]
        if len(raw) == 1 and len(lists) == 1:
            return lists[0]
    return raw


# ── Module agent ─────────────────────────────────────────────────────────────

class ModuleAnalysis(BaseModel):
    confirmed_modules: list[str] = []
    assumed_modules: list[str] = []
    unknown_areas: list[str] = []
    critical_workflows: list[str] = []
    high_risk_areas: list[str] = []

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> dict:
        if not isinstance(data, dict):
            data = {}
        return {name: _str_list(data.get(name)) for name in cls.model_fields}


# ── Checklist agent ──────────────────────────────────────────────────────────

class ChecklistItem(BaseModel):
    id: str
    text: str
    confidence: Literal["confirmed", "assumed"]


class ChecklistModule(BaseModel):
    module: str
    items: list[ChecklistItem]

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> dict:
        if not isinstance(data, dict):
            raise ValueError("module entry must be an object")

        module_name = _text(data.get("module"))
        if not module_name:
            raise ValueError("module name is required")

        raw_items = data.get("items")
        if not isinstance(raw_items, list):
            raw_items = []

        items = []
        # Fallback IDs are positional over the raw list, so skipped entries still consume a number.
        for idx, item in enumerate(raw_items):
            if not isinstance(item, dict):
                continue

            text = _text(item.get("text"))
            if not text:
                continue

            confidence = _text(item.get("confidence"), "confirmed").lower()
            if confidence not in ("confirmed", "assumed"):
                confidence = "confirmed"

            item_id = _text(item.get("id")).upper()
            if not item_id:
                prefix = "".join(c for c in module_name if c.isalnum())[:4].upper() or "TEST"
                item_id = f"{prefix}-{idx + 1:03d}"

            items.append({"id": item_id, "text": text, "confidence": confidence})

        if not items:
            raise ValueError("module has no usable items")

        return {"module": module_name, "items": items}


# ── Test case agent ──────────────────────────────────────────────────────────

class GeneratedTestCase(BaseModel):
    module: str
    category: Literal["Functional", "Negative", "Edge Case", "Security", "Regression"]
    description: str
    objective: str
    preconditions: str
    steps: list[str]
    inputData: str
    expectedResult: str
    priority: Level
    # Where the model says the case comes from ("workflow", "doc:N", "assumed").
    # Unverified claims: agents/grounding.py checks them. None when not given.
    sources: list[str] | None = None

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any, info: ValidationInfo) -> dict:
        if not isinstance(data, dict):
            raise ValueError("test case must be an object")

        default_module = (info.context or {}).get("default_module") or "General"

        steps = data.get("steps")
        if isinstance(steps, list):
            steps = [str(step).strip() for step in steps if step is not None]
        else:
            steps = [str(steps).strip()] if steps else []

        return {
            "module": _text(data.get("module")) or default_module,
            "category": CATEGORY_MAP.get(_text(data.get("category"), "Functional").lower(), "Functional"),
            "description": _text(data.get("description"), "Perform test case execution"),
            "objective": _text(data.get("objective"), "Verify correct system response"),
            "preconditions": _text(data.get("preconditions"), "None"),
            "steps": steps,
            "inputData": _text(data.get("inputData"), "N/A"),
            "expectedResult": _text(data.get("expectedResult"), "System responds correctly"),
            "priority": _level(data.get("priority")),
            "sources": _sources(data["sources"]) if "sources" in data else None,
        }


_DOC_REFS = re.compile(
    r"(?:\bdoc(?:ument)?s?|\bexcerpts?|\bsources?)\s*[:#]?\s*\[?\s*(\d{1,3})\s*\]?|\[\s*(\d{1,3})\s*\]",
    re.IGNORECASE,
)
_WORKFLOW_REF = re.compile(r"\bworkflow\b|\bsteps?\b")
_ASSUMED_HINTS = ("assum", "general", "practice", "standard", "typical", "common", "heuristic", "best")


def _sources(value: Any) -> list[str]:
    """
    Normalize the model's source labels to "workflow" / "doc:N" / "assumed".
    A label that names none of these becomes "unrecognized" (checked as unverifiable),
    never silently dropped: an empty claim would otherwise be checked as unlabeled.
    """
    items = value if isinstance(value, list) else [value]
    normalized: list[str] = []
    for item in items[:10]:
        text = _text(item).lower()
        if not text:
            continue
        labels = []
        if _WORKFLOW_REF.search(text):
            labels.append("workflow")
        labels += [f"doc:{int(a or b)}" for a, b in _DOC_REFS.findall(text)]
        if any(hint in text for hint in _ASSUMED_HINTS):
            labels.append("assumed")
        for label in labels or ["unrecognized"]:
            if label not in normalized:
                normalized.append(label)
    return normalized


# ── Issue agent ──────────────────────────────────────────────────────────────

class BugReport(BaseModel):
    reportType: Literal["Bug"] = "Bug"
    title: str
    bugType: str
    severity: Level
    priority: Level

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any, info: ValidationInfo) -> dict:
        if not isinstance(data, dict):
            data = {}

        title = _text(data.get("title"))
        if not title:
            observation = (info.context or {}).get("observation") or ""
            title = f"Bug observed during: {observation[:60]}..." if observation else "Unspecified system bug"

        return {
            "reportType": "Bug",
            "title": title,
            "bugType": _text(data.get("bugType"), "Functional") or "Functional",
            "severity": _level(data.get("severity")),
            "priority": _level(data.get("priority")),
        }


class ObservationReport(BaseModel):
    reportType: Literal["Observation"] = "Observation"
    observationType: str
    severity: Level
    suggestedAction: str

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> dict:
        if not isinstance(data, dict):
            data = {}

        return {
            "reportType": "Observation",
            "observationType": _text(data.get("observationType"), "UX Improvement") or "UX Improvement",
            "severity": _level(data.get("severity")),
            "suggestedAction": _text(data.get("suggestedAction")) or "No suggested action provided.",
        }


# ── Workflow draft agent ─────────────────────────────────────────────────────

MAX_DRAFT_STEPS = 20
MAX_DRAFT_GAPS = 5
MAX_DRAFT_TEXT = 300


class DraftStep(BaseModel):
    text: str
    # Claimed excerpt numbers ("doc:N" etc.). Unverified: agents/grounding.py checks them.
    sources: list[str] = []

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> dict:
        if isinstance(data, str):
            data = {"text": data}
        if not isinstance(data, dict):
            raise ValueError("step must be an object or a string")
        text = _text(data.get("text") or data.get("step") or data.get("description"))
        if not text:
            raise ValueError("step has no text")
        return {"text": text[:MAX_DRAFT_TEXT], "sources": _sources(data["sources"]) if data.get("sources") else []}


class WorkflowDraft(BaseModel):
    title: str
    steps: list[DraftStep]
    gaps: list[str]

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> dict:
        if not isinstance(data, dict):
            data = {}
        return {
            "title": _text(data.get("title"))[:120],
            "steps": parse_items(DraftStep, data.get("steps"))[:MAX_DRAFT_STEPS],
            "gaps": [g[:MAX_DRAFT_TEXT] for g in _str_list(data.get("gaps") or data.get("questions"))][:MAX_DRAFT_GAPS],
        }
