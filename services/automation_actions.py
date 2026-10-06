"""
services/automation_actions.py — the E2E step model.

Automation scripts are data, never code: a list of steps from a fixed set of
actions, each naming its element with a structured locator (role, label,
text, placeholder, test id or a CSS selector). The runner (next phase) maps
each action to one Playwright call; there is no "evaluate", no script
injection and no navigation outside the environment's allowed domains.

    {"action": "fill", "target": {"by": "label", "value": "Email"},
     "value": "{{vars.USER_EMAIL}}", "description": "Enter the email"}

Secrets are referenced as {{vars.NAME}} and resolved by the runner; their
values never appear in a script or a prompt.
"""

import ipaddress
import re
from urllib.parse import urlsplit

MAX_STEPS = 50
MAX_TEXT = 500
MAX_CSS = 300
MAX_DESCRIPTION = 300
MAX_WAIT_MS = 10_000

ELEMENT_ACTIONS = {"click", "hover", "check", "uncheck", "fill", "select", "expect_visible", "expect_hidden",
                   "expect_text"}
ACTIONS = ELEMENT_ACTIONS | {"goto", "press", "wait", "expect_url", "expect_title", "screenshot"}
ASSERTIONS = {"expect_visible", "expect_hidden", "expect_text", "expect_url", "expect_title"}
NEEDS_VALUE = {"goto", "fill", "select", "press", "wait", "expect_text", "expect_url", "expect_title"}
MATCH_ACTIONS = {"expect_text", "expect_url", "expect_title"}

LOCATORS = ("role", "label", "text", "placeholder", "testid", "css")
ROLES = {
    "alert", "button", "cell", "checkbox", "columnheader", "combobox", "dialog", "grid", "heading", "img",
    "link", "list", "listitem", "menu", "menuitem", "navigation", "option", "progressbar", "radio", "row",
    "rowheader", "searchbox", "slider", "spinbutton", "status", "switch", "tab", "table", "tablist",
    "tabpanel", "textbox", "tooltip",
}
_KEY = re.compile(
    r"^(?:(?:Control|Shift|Alt|Meta)\+){0,3}"
    r"(?:Enter|Tab|Escape|Backspace|Delete|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|"
    r"F(?:[1-9]|1[0-2])|[A-Za-z0-9])$"
)
VAR_NAME = re.compile(r"^[A-Z][A-Z0-9_]{0,39}$")
_VAR_REF = re.compile(r"\{\{\s*vars\.([A-Za-z0-9_]+)\s*\}\}")
_SCREENSHOT_NAME = re.compile(r"^[\w \-]{1,60}$")
# "[INVALID_PASSWORD]", "[EMAIL_REDACTED]": a placeholder (from the model or from masking), not test data.
_PLACEHOLDER = re.compile(r"\[[A-Z][A-Z0-9_]{2,}\]")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class StepError(ValueError):
    pass


def _clean(value, limit: int = MAX_TEXT) -> str:
    text = _CONTROL.sub("", str(value if value is not None else "")).strip()
    if len(text) > limit:
        raise StepError(f"is longer than {limit} characters")
    return text


def _target(raw) -> dict:
    if not isinstance(raw, dict):
        raise StepError("needs an element (target)")
    by = str(raw.get("by") or "").strip().lower()
    if by == "test_id" or by == "data-testid":
        by = "testid"
    if by not in LOCATORS:
        raise StepError(f"target.by must be one of {', '.join(LOCATORS)}")
    value = _clean(raw.get("value"), MAX_CSS if by == "css" else 200)
    if not value:
        raise StepError("target.value is empty")
    target = {"by": by, "value": value}
    if by == "role":
        target["value"] = value.lower()
        if target["value"] not in ROLES:
            raise StepError(f"'{value}' is not a supported ARIA role")
        name = _clean(raw.get("name"), 200)
        if name:
            target["name"] = name
    if raw.get("exact") is True:
        target["exact"] = True
    return target


def is_safe_path_or_url(value: str) -> bool:
    """A relative path ("/cart") or an http(s) URL, nothing else (no javascript:, data:, file:)."""
    if not value or any(c.isspace() for c in value):
        return False
    if value.startswith("/") and not value.startswith("//"):
        return True
    parts = urlsplit(value)
    return parts.scheme in ("http", "https") and bool(parts.hostname) and not parts.username and not parts.password


def validate_step(raw) -> dict:
    """One step in canonical form, or StepError explaining what's wrong."""
    if not isinstance(raw, dict):
        raise StepError("must be an object")
    action = str(raw.get("action") or "").strip().lower()
    if action not in ACTIONS:
        raise StepError(f"'{action or '?'}' is not a supported action")
    step = {"action": action}
    if action in ELEMENT_ACTIONS or (action == "press" and raw.get("target")):
        step["target"] = _target(raw.get("target"))

    value = _clean(raw.get("value"))
    if action in NEEDS_VALUE and not value:
        raise StepError("needs a value")
    if action == "goto" and not is_safe_path_or_url(value):
        raise StepError("must go to a path like /cart or an http(s) URL")
    if action == "press" and not _KEY.match(value):
        raise StepError(f"'{value}' is not a supported key")
    if action == "wait":
        if not value.isdigit() or not 100 <= int(value) <= MAX_WAIT_MS:
            raise StepError(f"wait must be 100 to {MAX_WAIT_MS} milliseconds")
    if action == "screenshot" and value and not _SCREENSHOT_NAME.match(value):
        raise StepError("screenshot name may use letters, digits, spaces, - and _")
    if value:
        step["value"] = value
    if action in MATCH_ACTIONS:
        match = str(raw.get("match") or "contains").strip().lower()
        if match not in ("contains", "equals"):
            raise StepError("match must be contains or equals")
        step["match"] = match
    description = _clean(raw.get("description"), MAX_DESCRIPTION)
    if description:
        step["description"] = description
    return step


def validate_steps(raw_steps) -> list[dict]:
    """Strict (API input): every step must be valid. Raises StepError naming the step."""
    if not isinstance(raw_steps, list):
        raise StepError("steps must be a list")
    if len(raw_steps) > MAX_STEPS:
        raise StepError(f"a script can have at most {MAX_STEPS} steps")
    steps = []
    for index, raw in enumerate(raw_steps, start=1):
        try:
            steps.append(validate_step(raw))
        except StepError as exc:
            raise StepError(f"Step {index}: {exc}") from None
    return steps


def coerce_steps(raw_steps) -> tuple[list[dict], list[str]]:
    """Lenient (model output): keep the valid steps, report the dropped ones."""
    steps, dropped = [], []
    for index, raw in enumerate(raw_steps if isinstance(raw_steps, list) else [], start=1):
        if len(steps) >= MAX_STEPS:
            dropped.append(f"Step {index}: over the {MAX_STEPS}-step limit")
            continue
        try:
            steps.append(validate_step(raw))
        except StepError as exc:
            dropped.append(f"Step {index}: {exc}")
    return steps, dropped


def referenced_variables(steps: list[dict]) -> set[str]:
    names = set()
    for step in steps:
        names.update(_VAR_REF.findall(step.get("value", "")))
    return names


# ── Environments ─────────────────────────────────────────────────────────────

_HOSTNAME = re.compile(r"^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
_BLOCKED_SUFFIXES = (".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".test", ".invalid")


def _is_public_host(host: str) -> bool:
    host = host.lower().rstrip(".")
    if host == "localhost" or host.endswith(_BLOCKED_SUFFIXES):
        return False
    try:
        ip = ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return bool(_HOSTNAME.match(host))
    return ip.is_global


def normalize_base_url(value: str) -> str:
    """A public http(s) site URL. Runs happen on a hosted runner that can only reach public sites."""
    url = _clean(value)
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise StepError("Website URL must start with https:// (or http://)")
    if parts.username or parts.password:
        raise StepError("Don't put credentials in the URL; add them as secret variables instead")
    if not _is_public_host(parts.hostname):
        raise StepError("Use a public website address (localhost and private networks can't be reached by the runner)")
    return f"{parts.scheme}://{parts.netloc.lower()}{parts.path.rstrip('/')}"


def normalize_domains(base_url: str, domains) -> list[str]:
    """Allowed hosts for navigation: the base URL's host plus extra ones (e.g. a payment page), max 10."""
    base_host = urlsplit(base_url).hostname
    result = [base_host]
    for raw in domains or []:
        host = _clean(raw, 253).lower().removeprefix("https://").removeprefix("http://").split("/")[0]
        if not host:
            continue
        if not _HOSTNAME.match(host) or not _is_public_host(host.removeprefix("*.")):
            raise StepError(f"'{raw}' is not a valid public domain (e.g. pay.example.com or *.example.com)")
        if host not in result:
            result.append(host)
    if len(result) > 10:
        raise StepError("At most 10 allowed domains")
    return result


def host_allowed(host: str, allowed: list[str]) -> bool:
    host = (host or "").lower()
    for pattern in allowed:
        if pattern.startswith("*."):
            if host.endswith(pattern[1:]) or host == pattern[2:]:
                return True
        elif host == pattern:
            return True
    return False


def script_warnings(steps: list[dict], environment: dict | None) -> list[str]:
    """Things a reviewer should fix or confirm before approving (not hard errors)."""
    warnings = []
    if not steps:
        return ["The script has no steps."]
    if not any(step["action"] in ASSERTIONS for step in steps):
        warnings.append("The script checks nothing: add at least one expect step.")
    for index, step in enumerate(steps, start=1):
        placeholder = _PLACEHOLDER.search(step.get("value", ""))
        if placeholder:
            warnings.append(f"Step {index} uses the placeholder {placeholder.group(0)}: replace it with real test "
                            "data or a {{vars.NAME}} variable.")
    if environment is None:
        warnings.append("Choose an environment (the website to test) before approving.")
        return warnings
    allowed = environment.get("allowedDomains") or []
    for index, step in enumerate(steps, start=1):
        if step["action"] == "goto" and not step["value"].startswith("/"):
            if not host_allowed(urlsplit(step["value"]).hostname, allowed):
                warnings.append(f"Step {index} goes to {urlsplit(step['value']).hostname}, "
                                "which isn't in the environment's allowed domains.")
    defined = {v["name"] for v in environment.get("variables") or []}
    missing = sorted(referenced_variables(steps) - defined)
    if missing:
        warnings.append("Uses variables the environment doesn't define: " + ", ".join(missing) + ".")
    return warnings
