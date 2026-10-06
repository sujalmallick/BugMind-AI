"""
services/automation_service.py — E2E automation: environments and scripts.

    Environment: the website to test (public URL), where navigation may go,
                 and test variables (secret ones encrypted, never returned).
    Script:      structured steps (services/automation_actions.py), written by
                 hand or drafted by AI from a test case. Only an approved
                 script can be exported and run (automation_runs_service.py),
                 and any change to its steps or environment sends it back to
                 draft for another review.
"""

import logging
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from agents.e2e_script_agent import AGENT as SCRIPT_AGENT, draft_script_agent
from agents.grounding import _near, known_numbers, limit_claims
from auth.permissions import require_project_role
from database.models.automation import AutomationEnvironment, AutomationScript
from database.models.test_case import TestCase
from database.models.workspace import Workspace
from guardrails import masker
from services.ai_output import safe_generated_text
from services.automation_actions import (
    VAR_NAME, StepError, coerce_steps, normalize_base_url, normalize_domains, script_warnings, validate_step,
    validate_steps,
)

logger = logging.getLogger("BugMind")

MAX_ENVIRONMENTS = 10
MAX_SCRIPTS = 200
MAX_VARIABLES = 20
MAX_VARIABLE_VALUE = 500


def _bad_request(exc: Exception) -> HTTPException:
    return HTTPException(status_code=422, detail=str(exc))


def _encryption():
    from services.encryption_service import EncryptionService

    return EncryptionService()


# ── Environments ─────────────────────────────────────────────────────────────

def serialize_environment(env: AutomationEnvironment) -> dict:
    return {
        "id": env.id,
        "name": env.name,
        "baseUrl": env.base_url,
        "allowedDomains": env.allowed_domains or [],
        # Secret values never leave the server: only whether one is set.
        "variables": [
            {"name": v["name"], "secret": bool(v.get("secret")),
             "value": None if v.get("secret") else v.get("value", ""),
             "hasValue": bool(v.get("encrypted")) if v.get("secret") else bool(v.get("value"))}
            for v in env.variables or []
        ],
        "notes": env.notes,
        "updatedAt": env.updated_at.isoformat() if env.updated_at else None,
    }


def _merge_variables(incoming, existing: list[dict]) -> list[dict]:
    """
    New variable list from the client. A secret sent without a value keeps its stored
    (encrypted) value, so editing an environment never requires re-typing secrets.
    """
    if not isinstance(incoming, list):
        raise StepError("variables must be a list")
    if len(incoming) > MAX_VARIABLES:
        raise StepError(f"At most {MAX_VARIABLES} variables")
    stored = {v["name"]: v for v in existing or []}
    result, seen = [], set()
    for raw in incoming:
        if not isinstance(raw, dict):
            raise StepError("each variable needs a name")
        name = str(raw.get("name") or "").strip().upper()
        if not VAR_NAME.match(name):
            raise StepError(f"'{name}' isn't a valid name: use A-Z, 0-9 and _, starting with a letter")
        if name in seen:
            raise StepError(f"{name} is defined twice")
        seen.add(name)
        value = raw.get("value")
        value = None if value is None else str(value)
        if value is not None and len(value) > MAX_VARIABLE_VALUE:
            raise StepError(f"{name} is longer than {MAX_VARIABLE_VALUE} characters")
        if raw.get("secret"):
            if value:
                result.append({"name": name, "secret": True, "encrypted": _encryption().encrypt_key(value)})
            elif stored.get(name, {}).get("encrypted"):
                result.append({"name": name, "secret": True, "encrypted": stored[name]["encrypted"]})
            else:
                raise StepError(f"Enter a value for the secret {name}")
        else:
            result.append({"name": name, "secret": False, "value": value or ""})
    return result


def resolve_variables(env: AutomationEnvironment) -> dict[str, str]:
    """Plain values for the runner only (next phase). Never returned by the API or logged."""
    values = {}
    for v in env.variables or []:
        values[v["name"]] = _encryption().decrypt_key(v["encrypted"]) if v.get("secret") else v.get("value", "")
    return values


def _get_environment(db: Session, project_id: int, env_id: int) -> AutomationEnvironment:
    env = db.query(AutomationEnvironment).filter(
        AutomationEnvironment.id == env_id, AutomationEnvironment.project_id == project_id).first()
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found.")
    return env


def list_environments(db: Session, user_id: int, project_id: int) -> list[dict]:
    require_project_role(db, user_id, project_id, "viewer")
    envs = (db.query(AutomationEnvironment).filter(AutomationEnvironment.project_id == project_id)
            .order_by(AutomationEnvironment.id).all())
    return [serialize_environment(e) for e in envs]


def create_environment(db: Session, user_id: int, project_id: int, data: dict) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    if db.query(AutomationEnvironment).filter(AutomationEnvironment.project_id == project_id).count() \
            >= MAX_ENVIRONMENTS:
        raise HTTPException(status_code=409, detail=f"A project can have at most {MAX_ENVIRONMENTS} environments.")
    try:
        base_url = normalize_base_url(data["base_url"])
        env = AutomationEnvironment(
            project_id=project_id, created_by=user_id, name=data["name"], base_url=base_url,
            allowed_domains=normalize_domains(base_url, data.get("allowed_domains")),
            variables=_merge_variables(data.get("variables") or [], []), notes=data.get("notes") or "",
        )
    except StepError as exc:
        raise _bad_request(exc) from None
    db.add(env)
    db.commit()
    db.refresh(env)
    return serialize_environment(env)


def update_environment(db: Session, user_id: int, project_id: int, env_id: int, data: dict) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    env = _get_environment(db, project_id, env_id)
    try:
        if data.get("name") is not None:
            env.name = data["name"]
        if data.get("base_url") is not None:
            env.base_url = normalize_base_url(data["base_url"])
        if data.get("allowed_domains") is not None or data.get("base_url") is not None:
            extra = data["allowed_domains"] if data.get("allowed_domains") is not None else env.allowed_domains[1:]
            env.allowed_domains = normalize_domains(env.base_url, extra)
        if data.get("variables") is not None:
            env.variables = _merge_variables(data["variables"], env.variables)
        if data.get("notes") is not None:
            env.notes = data["notes"]
    except StepError as exc:
        db.rollback()
        raise _bad_request(exc) from None
    # The website a script runs against changed: approved scripts need another look.
    if data.get("base_url") is not None or data.get("allowed_domains") is not None:
        _unapprove(db.query(AutomationScript).filter(AutomationScript.environment_id == env.id))
    db.commit()
    db.refresh(env)
    return serialize_environment(env)


def delete_environment(db: Session, user_id: int, project_id: int, env_id: int) -> None:
    require_project_role(db, user_id, project_id, "editor")
    env = _get_environment(db, project_id, env_id)
    scripts = db.query(AutomationScript).filter(AutomationScript.environment_id == env.id)
    _unapprove(scripts)
    scripts.update({AutomationScript.environment_id: None}, synchronize_session=False)
    db.delete(env)
    db.commit()


def _unapprove(query) -> None:
    query.filter(AutomationScript.status == "approved").update(
        {AutomationScript.status: "draft", AutomationScript.approved_by: None, AutomationScript.approved_at: None},
        synchronize_session=False,
    )


# ── Scripts ──────────────────────────────────────────────────────────────────

def _test_case(db: Session, project_id: int, test_case_id: int | None) -> TestCase | None:
    if test_case_id is None:
        return None
    return (db.query(TestCase).join(Workspace, Workspace.id == TestCase.workspace_id)
            .filter(TestCase.id == test_case_id, Workspace.project_id == project_id).first())


def _case_dict(tc: TestCase) -> dict:
    return {
        "id": tc.id,
        "code": tc.test_case_id,
        "description": tc.description,
        "preconditions": tc.preconditions,
        "steps": [s for s in (tc.steps or "").split("\n") if s.strip()],
        "expected_result": tc.expected_result,
    }


_UNSET = object()


def serialize_script(db: Session, script: AutomationScript, detail: bool = True, env=_UNSET, tc=_UNSET) -> dict:
    if env is _UNSET:
        env = db.get(AutomationEnvironment, script.environment_id) if script.environment_id else None
    if tc is _UNSET:
        tc = _test_case(db, script.project_id, script.test_case_id)
    env_data = serialize_environment(env) if env else None
    warnings = script_warnings(script.steps or [], env_data)
    data = {
        "id": script.id,
        "name": script.name,
        "status": script.status,
        "version": script.version,
        "origin": script.origin,
        "stepCount": len(script.steps or []),
        "environmentId": script.environment_id,
        "environmentName": env.name if env else None,
        "testCaseId": tc.id if tc else None,
        "testCaseCode": tc.test_case_id if tc else None,
        "warnings": warnings,
        "approvedAt": script.approved_at.isoformat() if script.approved_at else None,
        "updatedAt": script.updated_at.isoformat() if script.updated_at else None,
    }
    if detail:
        data.update({
            "steps": script.steps or [],
            "generation": script.generation,
            "testCase": _case_dict(tc) if tc else None,
        })
    return data


def _get_script(db: Session, project_id: int, script_id: int) -> AutomationScript:
    script = db.query(AutomationScript).filter(
        AutomationScript.id == script_id, AutomationScript.project_id == project_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found.")
    return script


def _check_script_limit(db: Session, project_id: int) -> None:
    if db.query(AutomationScript).filter(AutomationScript.project_id == project_id).count() >= MAX_SCRIPTS:
        raise HTTPException(status_code=409, detail=f"A project can have at most {MAX_SCRIPTS} scripts.")


def _linked(db: Session, project_id: int, environment_id, test_case_id) -> tuple:
    """Validate that a referenced environment / test case belongs to this project."""
    env = _get_environment(db, project_id, environment_id) if environment_id is not None else None
    tc = None
    if test_case_id is not None:
        tc = _test_case(db, project_id, test_case_id)
        if tc is None:
            raise HTTPException(status_code=404, detail="Test case not found.")
    return env, tc


def list_scripts(db: Session, user_id: int, project_id: int) -> list[dict]:
    require_project_role(db, user_id, project_id, "viewer")
    scripts = (db.query(AutomationScript).filter(AutomationScript.project_id == project_id)
               .order_by(AutomationScript.updated_at.desc(), AutomationScript.id.desc()).all())
    # One query each for the linked environments and test cases, not one per script.
    envs = {e.id: e for e in db.query(AutomationEnvironment).filter(AutomationEnvironment.project_id == project_id)}
    case_ids = {s.test_case_id for s in scripts if s.test_case_id}
    cases = {}
    if case_ids:
        cases = {tc.id: tc for tc in db.query(TestCase).join(Workspace, Workspace.id == TestCase.workspace_id)
                 .filter(TestCase.id.in_(case_ids), Workspace.project_id == project_id)}
    return [serialize_script(db, s, detail=False, env=envs.get(s.environment_id), tc=cases.get(s.test_case_id))
            for s in scripts]


def get_script(db: Session, user_id: int, project_id: int, script_id: int) -> dict:
    require_project_role(db, user_id, project_id, "viewer")
    return serialize_script(db, _get_script(db, project_id, script_id))


def create_script(db: Session, user_id: int, project_id: int, data: dict) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    _check_script_limit(db, project_id)
    env, tc = _linked(db, project_id, data.get("environment_id"), data.get("test_case_id"))
    try:
        steps = validate_steps(data.get("steps") or [])
    except StepError as exc:
        raise _bad_request(exc) from None
    script = AutomationScript(
        project_id=project_id, created_by=user_id, name=data["name"], steps=steps, status="draft",
        environment_id=env.id if env else None, test_case_id=tc.id if tc else None, origin="manual",
    )
    db.add(script)
    db.commit()
    db.refresh(script)
    return serialize_script(db, script)


def update_script(db: Session, user_id: int, project_id: int, script_id: int, data: dict) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    script = _get_script(db, project_id, script_id)
    changed = False
    if "environment_id" in data or "test_case_id" in data:
        env, tc = _linked(db, project_id, data.get("environment_id"), data.get("test_case_id"))
        if "environment_id" in data and data["environment_id"] != script.environment_id:
            script.environment_id = env.id if env else None
            changed = True
        if "test_case_id" in data:
            script.test_case_id = tc.id if tc else None
    if data.get("steps") is not None:
        try:
            steps = validate_steps(data["steps"])
        except StepError as exc:
            raise _bad_request(exc) from None
        if steps != script.steps:
            script.steps = steps
            changed = True
    if data.get("name") is not None:
        script.name = data["name"]

    if changed:
        script.version += 1
        if script.status == "approved":
            script.status, script.approved_by, script.approved_at = "draft", None, None

    status = data.get("status")
    if status == "approved":
        env = db.get(AutomationEnvironment, script.environment_id) if script.environment_id else None
        problems = script_warnings(script.steps or [], serialize_environment(env) if env else None)
        if problems:
            db.rollback()
            raise HTTPException(status_code=409, detail="Fix these before approving: " + " ".join(problems))
        script.status, script.approved_by, script.approved_at = "approved", user_id, datetime.utcnow()
    elif status == "draft":
        script.status, script.approved_by, script.approved_at = "draft", None, None

    db.commit()
    db.refresh(script)
    return serialize_script(db, script)


def delete_script(db: Session, user_id: int, project_id: int, script_id: int) -> None:
    require_project_role(db, user_id, project_id, "editor")
    db.delete(_get_script(db, project_id, script_id))
    db.commit()


def delete_project_automation(db: Session, project_id: int) -> None:
    """For project deletion (caller commits)."""
    from database.models.automation import AutomationRun

    db.query(AutomationRun).filter(AutomationRun.project_id == project_id).delete(synchronize_session=False)
    db.query(AutomationScript).filter(AutomationScript.project_id == project_id).delete(synchronize_session=False)
    db.query(AutomationEnvironment).filter(AutomationEnvironment.project_id == project_id).delete(
        synchronize_session=False)


# ── AI drafting ──────────────────────────────────────────────────────────────

def generate_script(db: Session, user_id: int, project_id: int, test_case_id: int, environment_id: int) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    _check_script_limit(db, project_id)
    env, tc = _linked(db, project_id, environment_id, test_case_id)
    env_data = serialize_environment(env)
    case, _ = masker.mask_obj(_case_dict(tc))  # stored text can hold personal data

    result = draft_script_agent(case, env_data, user_id=user_id)
    if result.get("success") is False:
        return result

    steps, dropped = coerce_steps(result["steps"])
    # Generated text passes the output guardrail; a step carrying an injection is dropped.
    safe_steps = []
    for index, step in enumerate(steps, start=1):
        clean = dict(step)
        ok = True
        for key in ("value", "description"):
            if key in step:
                text = safe_generated_text(step[key], SCRIPT_AGENT)
                if text is None:
                    ok = False
                    break
                clean[key] = text
        if not ok:
            dropped.append(f"Step {index}: removed by safety checks")
            continue
        try:
            safe_steps.append(validate_step(clean))  # redaction may have changed a value
        except StepError as exc:
            dropped.append(f"Step {index}: {exc}")

    # Hallucination check: values an assertion expects must come from the test case.
    case_text = " ".join([tc.description or "", tc.preconditions or "", tc.steps or "", tc.expected_result or ""])
    known = known_numbers(case_text)
    checks = []
    for index, step in enumerate(safe_steps, start=1):
        if step["action"].startswith("expect_"):
            invented = sorted(n for n in limit_claims(step.get("value", "")) if not _near(n, known))
            if invented:
                checks.append(f"Step {index} expects {', '.join(invented)}, which the test case doesn't mention.")

    notes = [n for n in (safe_generated_text(n, SCRIPT_AGENT) for n in result["notes"]) if n]
    name = (result["name"] and safe_generated_text(result["name"], SCRIPT_AGENT)) or tc.description[:200]
    script = AutomationScript(
        project_id=project_id, created_by=user_id, name=name[:200], steps=safe_steps, status="draft",
        environment_id=env.id, test_case_id=tc.id, origin="ai",
        generation={"notes": notes, "dropped": dropped[:10], "checks": checks[:10]},
    )
    db.add(script)
    db.commit()
    db.refresh(script)
    logger.info(f"E2E script drafted | project={project_id} script={script.id} steps={len(safe_steps)} "
                f"dropped={len(dropped)} checks={len(checks)}")
    return {"success": True, "script": serialize_script(db, script)}
