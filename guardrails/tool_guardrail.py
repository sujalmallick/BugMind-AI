"""
guardrails/tool_guardrail.py — authorizes LLM-proposed actions independently of the LLM.

    result = tool_guardrail.authorize(
        tool_name="assign_work_item",
        arguments=llm_proposed_args,
        user_context=UserContext(user_id=..., role=..., project_id=...),
        resources={"db": db},
    )

Pipeline: allowlist → schema validation (unknown fields rejected) → secret /
injection scan of string arguments → role + scope check → resource ownership
check → confirmation gate for high-risk / destructive tools.

A valid-looking function call from the model is never enough on its own.
"""

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from pydantic import BaseModel, ConfigDict, ValidationError

from guardrails.audit_logger import Timer, audit
from guardrails.config import confirmation_secret, get_settings
from guardrails.data_masker import masker
from guardrails.detection import PII, SECRET
from guardrails.injection_detector import injection_detector
from guardrails.models import Decision, RiskLevel, Source, ToolAuthorizationResult
from guardrails.policy_engine import policy


DEFAULT_ROLE_HIERARCHY = {"viewer": 0, "editor": 1, "admin": 2, "owner": 3}


class UserContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    user_id: int
    role: str | None = None
    project_id: int | None = None
    scopes: frozenset[str] = frozenset()


ResourceValidator = Callable[[BaseModel, UserContext, dict], list[str]]


@dataclass(frozen=True)
class ToolSpec:
    name: str
    args_model: type[BaseModel]
    description: str = ""
    risk: RiskLevel = RiskLevel.LOW
    min_role: str | None = None
    role_hierarchy: dict[str, int] = field(default_factory=lambda: dict(DEFAULT_ROLE_HIERARCHY))
    required_scopes: frozenset[str] = frozenset()
    requires_confirmation: bool = False
    destructive: bool = False
    # String arguments allowed to carry PII / secrets (none by default).
    pii_allowed_args: frozenset[str] = frozenset()
    secret_allowed_args: frozenset[str] = frozenset()
    resource_validator: ResourceValidator | None = None


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, ToolSpec] = {}

    def register(self, spec: ToolSpec, *, replace: bool = False) -> ToolSpec:
        if spec.name in self._tools and not replace:
            raise ValueError(f"Tool '{spec.name}' is already registered")
        self._tools[spec.name] = spec
        return spec

    def unregister(self, name: str) -> None:
        self._tools.pop(name, None)

    def get(self, name: str) -> ToolSpec | None:
        return self._tools.get(name)

    def names(self) -> list[str]:
        return sorted(self._tools)


tool_registry = ToolRegistry()


def _iter_strings(value: Any, path: str = ""):
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from _iter_strings(v, f"{path}.{k}" if path else str(k))
    elif isinstance(value, (list, tuple)):
        for i, v in enumerate(value):
            yield from _iter_strings(v, f"{path}[{i}]")


def _top_level(path: str) -> str:
    return path.split(".", 1)[0].split("[", 1)[0]


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _args_digest(args: dict) -> str:
    canonical = json.dumps(args, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


class ToolGuardrail:
    name = "tool"

    def __init__(self, registry: ToolRegistry = tool_registry):
        self.registry = registry

    # ── Confirmation tokens ──────────────────────────────────────────────────
    def issue_confirmation_token(self, tool_name: str, args: dict, user_context: UserContext) -> str | None:
        key = confirmation_secret()
        if not key:
            return None  # no key configured → no stateless confirmations (fail closed)
        payload = {
            "t": tool_name,
            "u": user_context.user_id,
            "a": _args_digest(args),
            "exp": int(time.time()) + get_settings().confirmation_ttl_seconds,
        }
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        sig = hmac.new(key, body, hashlib.sha256).digest()
        return f"{_b64(body)}.{_b64(sig)}"

    def verify_confirmation_token(self, token: str, tool_name: str, args: dict, user_context: UserContext) -> bool:
        key = confirmation_secret()
        if not key or not token or "." not in token:
            return False
        try:
            body_b64, sig_b64 = token.split(".", 1)
            body = _unb64(body_b64)
            expected = hmac.new(key, body, hashlib.sha256).digest()
            if not hmac.compare_digest(expected, _unb64(sig_b64)):
                return False
            payload = json.loads(body)
        except Exception:
            return False
        return (
            payload.get("t") == tool_name
            and payload.get("u") == user_context.user_id
            and payload.get("a") == _args_digest(args)
            and int(payload.get("exp", 0)) >= int(time.time())
        )

    # ── Authorization ────────────────────────────────────────────────────────
    def authorize(
        self,
        tool_name: str,
        arguments: Any,
        user_context: UserContext,
        *,
        confirmed: bool = False,
        confirmation_token: str | None = None,
        resources: dict | None = None,
        agent: str | None = None,
    ) -> ToolAuthorizationResult:
        settings = get_settings()
        name = tool_name.strip() if isinstance(tool_name, str) else ""
        spec = self.registry.get(name)

        if not settings.enabled or not settings.tool_guardrails_enabled:
            audit.event(self.name, "allow", tool=name, agent=agent, reasons=["tool_guardrail_disabled"])
            return ToolAuthorizationResult(
                tool_name=name, decision=Decision.ALLOW, reasons=["tool_guardrail_disabled"],
                sanitized_arguments=arguments if isinstance(arguments, dict) else None,
            )

        timer = Timer()
        try:
            result = self._authorize(name, spec, arguments, user_context, confirmed,
                                     confirmation_token, resources or {}, agent)
        except Exception:
            risk = spec.risk if spec else None
            closed = policy.fail_closed(risk) or spec is None
            result = ToolAuthorizationResult(
                tool_name=name, decision=Decision.DENY if closed else Decision.ALLOW,
                risk=risk, reasons=["guardrail_error"],
                sanitized_arguments=None if closed else arguments,
            )

        audit.event(
            self.name, result.decision, tool=name or "<invalid>", agent=agent,
            reasons=result.reasons, latency_ms=timer.elapsed_ms,
            success=result.decision != Decision.DENY,
        )
        return result

    def _authorize(self, name, spec, arguments, user_context, confirmed,
                   confirmation_token, resources, agent) -> ToolAuthorizationResult:
        def deny(*reasons: str) -> ToolAuthorizationResult:
            return ToolAuthorizationResult(
                tool_name=name, decision=Decision.DENY, risk=spec.risk if spec else None,
                reasons=list(reasons),
            )

        if spec is None:
            return deny("tool_not_allowlisted")
        if not isinstance(user_context, UserContext):
            return deny("missing_user_context")
        if not isinstance(arguments, dict):
            return deny("arguments_not_an_object")

        try:
            parsed = spec.args_model.model_validate(arguments)
        except ValidationError as e:
            # Field names and error types only — never the offending values.
            return deny(*[
                f"invalid_argument:{'.'.join(str(p) for p in err['loc']) or '<root>'}:{err['type']}"
                for err in e.errors()
            ])

        clean_args = parsed.model_dump()
        for path, value in list(_iter_strings(clean_args)):
            top = _top_level(path)
            if top not in spec.secret_allowed_args and masker.detect(value, kinds=(SECRET,)):
                return deny(f"secret_in_argument:{top}")
            report = injection_detector.assess(value, source=Source.LLM)
            if report.score >= get_settings().injection_block_threshold:
                return deny(f"injection_in_argument:{top}")

        if spec.min_role is not None:
            rank = spec.role_hierarchy.get(user_context.role or "", -1)
            if rank < spec.role_hierarchy.get(spec.min_role, 10**6):
                return deny("insufficient_role")
        if spec.required_scopes - user_context.scopes:
            return deny("missing_scope")

        if spec.resource_validator is not None:
            violations = spec.resource_validator(parsed, user_context, resources)
            if violations:
                return deny(*violations)

        # PII in string arguments is masked unless the tool explicitly needs it.
        def mask_args(value: Any, path: str = "") -> Any:
            if isinstance(value, str):
                if _top_level(path) in spec.pii_allowed_args:
                    return value
                return masker.redact(value, kinds=(PII,), stage="input")
            if isinstance(value, dict):
                return {k: mask_args(v, f"{path}.{k}" if path else str(k)) for k, v in value.items()}
            if isinstance(value, list):
                return [mask_args(v, f"{path}[{i}]") for i, v in enumerate(value)]
            return value

        safe_args = mask_args(clean_args)

        if policy.requires_confirmation(spec.risk, spec.requires_confirmation or spec.destructive):
            if confirmed:
                pass  # caller verified an explicit human confirmation server-side
            elif confirmation_token and self.verify_confirmation_token(confirmation_token, name, clean_args, user_context):
                pass
            else:
                return ToolAuthorizationResult(
                    tool_name=name, decision=Decision.REQUIRE_CONFIRMATION, risk=spec.risk,
                    reasons=["confirmation_required"], sanitized_arguments=safe_args,
                    confirmation_token=self.issue_confirmation_token(name, clean_args, user_context),
                )

        return ToolAuthorizationResult(
            tool_name=name, decision=Decision.ALLOW, risk=spec.risk, sanitized_arguments=safe_args,
        )

    def sanitize_result(self, tool_name: str, result: Any, *, agent: str | None = None) -> Any:
        """Tool output goes back to an agent as untrusted data: contain every string."""
        from guardrails.input_guardrail import input_guardrail

        def walk(value: Any) -> Any:
            if isinstance(value, str):
                return input_guardrail.contain(value, source=Source.TOOL, field=tool_name, agent=agent)
            if isinstance(value, dict):
                return {k: walk(v) for k, v in value.items()}
            if isinstance(value, (list, tuple)):
                return type(value)(walk(v) for v in value)
            return value

        return walk(result)


tool_guardrail = ToolGuardrail()
