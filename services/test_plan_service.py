"""
services/test_plan_service.py — AI Test Planning.

    create_plan:     feature description → planner agent → phases (status "proposed")
    update_phase:    a person edits, approves or skips each phase
    generate_phase:  approved phase → the existing test case agent → coverage and
                     grounding checks → test cases saved with origin "plan"

Nothing is generated for a phase until someone approves it. Plan cases live in
the normal test_cases table (so assignment, status and issues work as usual) but
an analysis save never removes them.
"""

import logging
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from agents.coverage import coverage_report, is_near_duplicate
from agents.grounding import ground_test_cases
from agents.test_case_agent import generate_test_cases_agent
from agents.test_plan_agent import AGENT as PLAN_AGENT, plan_tests_agent
from auth.permissions import require_project_role
from config import DEFAULT_MODEL
from database.models.test_case import TestCase
from database.models.test_plan import TestPlan, TestPlanPhase
from database.models.workspace import Workspace
from guardrails import Source, input_guardrail, masker, output_guardrail
from services.ai_output import safe_generated_text
from services.ai_settings_service import ai_settings_service
from services.guardrail_llm import guardrail_llm
from services.knowledge_retrieval import retrieve, summarize_sources
from services.prompt_budget import plan_budget
from services.test_case_service import PLAN_ORIGIN, sanitize_grounding

logger = logging.getLogger("BugMind")

MAX_PLANS_PER_PROJECT = 20
MAX_CASES_PER_PHASE = 100
MAX_EXISTING_CASES_IN_PROMPT = 60
# A phase stuck in "generating" this long (worker crash, timeout) can be generated again.
STALE_GENERATION = timedelta(minutes=10)

EDITABLE_STATUSES = ("proposed", "approved", "skipped")
TEXT_FIELDS = ("title", "objective", "scope", "entry_criteria", "exit_criteria")
CONTENT_FIELDS = TEXT_FIELDS + ("modules", "risks", "priority")


def _error(code: str, message: str) -> dict:
    return {"success": False, "code": code, "error": message}


# ── Reading ──────────────────────────────────────────────────────────────────

def _case_counts(db: Session, phase_ids: list[int]) -> dict[int, int]:
    if not phase_ids:
        return {}
    rows = (
        db.query(TestCase.plan_phase_id, func.count(TestCase.id))
        .filter(TestCase.plan_phase_id.in_(phase_ids))
        .group_by(TestCase.plan_phase_id)
        .all()
    )
    return dict(rows)


def serialize_phase(phase: TestPlanPhase, case_count: int = 0) -> dict:
    return {
        "id": phase.id,
        "planId": phase.plan_id,
        "ordinal": phase.ordinal,
        "title": phase.title,
        "objective": phase.objective,
        "scope": phase.scope,
        "modules": phase.modules or [],
        "risks": phase.risks or [],
        "entryCriteria": phase.entry_criteria,
        "exitCriteria": phase.exit_criteria,
        "priority": phase.priority,
        "status": phase.status,
        "grounding": phase.grounding,
        "generation": phase.generation,
        "approvedAt": phase.approved_at.isoformat() if phase.approved_at else None,
        "generatedAt": phase.generated_at.isoformat() if phase.generated_at else None,
        "testCaseCount": case_count,
    }


def serialize_plan(db: Session, plan: TestPlan) -> dict:
    counts = _case_counts(db, [p.id for p in plan.phases])
    return {
        "id": plan.id,
        "projectId": plan.project_id,
        "title": plan.title,
        "scope": plan.scope,
        "summary": plan.summary,
        "gaps": (plan.details or {}).get("gaps", []),
        "knowledgeSources": (plan.details or {}).get("knowledgeSources", []),
        "createdAt": plan.created_at.isoformat() if plan.created_at else None,
        "phases": [serialize_phase(p, counts.get(p.id, 0)) for p in plan.phases],
    }


def _get_plan(db: Session, project_id: int, plan_id: int) -> TestPlan:
    plan = db.query(TestPlan).filter(TestPlan.id == plan_id, TestPlan.project_id == project_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Test plan not found.")
    return plan


def _get_phase(db: Session, project_id: int, plan_id: int, phase_id: int) -> tuple[TestPlan, TestPlanPhase]:
    plan = _get_plan(db, project_id, plan_id)
    phase = db.query(TestPlanPhase).filter(TestPlanPhase.id == phase_id, TestPlanPhase.plan_id == plan.id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found.")
    return plan, phase


def list_plans(db: Session, user_id: int, project_id: int) -> list[dict]:
    require_project_role(db, user_id, project_id, "viewer")
    plans = (db.query(TestPlan).filter(TestPlan.project_id == project_id)
             .order_by(TestPlan.created_at.desc(), TestPlan.id.desc()).all())
    return [serialize_plan(db, plan) for plan in plans]


def get_plan(db: Session, user_id: int, project_id: int, plan_id: int) -> dict:
    require_project_role(db, user_id, project_id, "viewer")
    return serialize_plan(db, _get_plan(db, project_id, plan_id))


# ── Shared AI context ────────────────────────────────────────────────────────

def _model(db: Session, user_id: int) -> str:
    try:
        return ai_settings_service.get_model(db, user_id)
    except Exception:  # settings lookup failed: budget for the default model rather than fail
        db.rollback()
        return DEFAULT_MODEL


def _environment(db: Session, project_id: int) -> tuple[dict, dict | None]:
    """The workspace's saved test environment, re-checked like fresh user input. (env, blocking error)"""
    workspace = db.query(Workspace).filter(Workspace.project_id == project_id).first()
    environment = {}
    for key in ("platform", "os_version", "build", "device"):
        value = str(getattr(workspace, key, "") or "").strip() if workspace else ""
        if not value:
            continue
        check = input_guardrail.validate(value, source=Source.USER, field=f"environment.{key}")
        if check.blocked:
            return {}, check.error_response()
        environment[key] = check.sanitized_text
    return environment, None


def _too_long(budget) -> dict:
    return _error(
        "context_too_long",
        f"This text is too long for the selected AI model ({budget.workflow_tokens:,} tokens; the model reads "
        f"about {budget.context_tokens:,}). Shorten it or choose a model with a larger context window.",
    )


# ── Planning ─────────────────────────────────────────────────────────────────

def _phase_as_case(phase: dict) -> dict:
    """The shape agents/grounding.py checks: claims about behavior in description/objective/criteria."""
    return {
        "description": phase["title"],
        "objective": f"{phase['objective']} {phase['scope']}",
        "preconditions": phase["entryCriteria"],
        "expectedResult": phase["exitCriteria"],
        "steps": phase["risks"] + phase["modules"],
        "sources": phase.get("sources"),
    }


def create_plan(db: Session, user_id: int, project_id: int, scope: str, title: str | None = None) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    if db.query(TestPlan).filter(TestPlan.project_id == project_id).count() >= MAX_PLANS_PER_PROJECT:
        raise HTTPException(status_code=409, detail=f"A project can have at most {MAX_PLANS_PER_PROJECT} test plans. "
                                                    "Delete an old plan first.")

    scope_check = input_guardrail.validate(scope, source=Source.USER, field="scope")
    if scope_check.blocked:
        return scope_check.error_response()
    clean_scope = scope_check.sanitized_text
    clean_title = None
    if title and title.strip():
        title_check = input_guardrail.validate(title.strip(), source=Source.USER, field="title")
        if title_check.blocked:
            return title_check.error_response()
        clean_title = title_check.sanitized_text

    model = _model(db, user_id)
    budget = plan_budget(model, clean_scope)
    if not budget.fits:
        return _too_long(budget)
    classifier_check = input_guardrail.classify({"scope": clean_scope}, guardrail_llm(user_id))
    if classifier_check.blocked:
        return classifier_check.error_response()

    environment, env_block = _environment(db, project_id)
    if env_block:
        return env_block
    knowledge = retrieve(db, user_id, project_id, clean_scope, token_budget=budget.knowledge_tokens, model=model)

    draft = plan_tests_agent(clean_scope, user_id=user_id, knowledge=knowledge, environment=environment)
    if isinstance(draft, dict) and draft.get("success") is False:
        return draft

    # Every model-written string: output guardrail + injection check. A phase whose title
    # or scope fails is dropped; optional fields that fail are blanked.
    phases = []
    removed = 0
    for phase in draft["phases"]:
        clean = dict(phase)
        for key in ("title", "scope"):
            clean[key] = safe_generated_text(phase[key], PLAN_AGENT)
        if not clean["title"] or not clean["scope"]:
            removed += 1
            continue
        for key in ("objective", "entryCriteria", "exitCriteria"):
            clean[key] = safe_generated_text(phase[key], PLAN_AGENT) or "" if phase[key] else ""
        for key in ("modules", "risks"):
            clean[key] = [t for t in (safe_generated_text(v, PLAN_AGENT) for v in phase[key]) if t]
        phases.append(clean)
    if not phases:
        return _error("no_plan", "Couldn't build a test plan from this description. Describe the feature's "
                                 "user flow in a few steps and try again.")

    graded, summary = ground_test_cases([_phase_as_case(p) for p in phases], workflow=clean_scope,
                                        excerpts=knowledge)
    gaps = [g for g in (safe_generated_text(g, PLAN_AGENT) for g in draft["gaps"]) if g]
    plan_title = clean_title or (draft["title"] and safe_generated_text(draft["title"], PLAN_AGENT)) \
        or clean_scope.split("\n", 1)[0][:80]

    plan = TestPlan(
        project_id=project_id, created_by=user_id, title=plan_title[:200], scope=clean_scope,
        summary=safe_generated_text(draft["summary"], PLAN_AGENT) or "" if draft["summary"] else "",
        details={"gaps": gaps, "knowledgeSources": summarize_sources(knowledge) if knowledge else []},
    )
    db.add(plan)
    db.flush()
    for ordinal, (phase, checked) in enumerate(zip(phases, graded), start=1):
        db.add(TestPlanPhase(
            plan_id=plan.id, ordinal=ordinal, title=phase["title"][:200], objective=phase["objective"],
            scope=phase["scope"], modules=phase["modules"], risks=phase["risks"],
            entry_criteria=phase["entryCriteria"], exit_criteria=phase["exitCriteria"],
            priority=phase["priority"], status="proposed", grounding=sanitize_grounding(checked["grounding"]),
        ))
    db.commit()
    db.refresh(plan)
    logger.info(f"Test plan created | project={project_id} plan={plan.id} phases={len(phases)} "
                f"removed_unsafe={removed} grounding={summary}")
    return {"success": True, "plan": serialize_plan(db, plan), "removedForSafety": removed}


# ── Review ───────────────────────────────────────────────────────────────────

def update_phase(db: Session, user_id: int, project_id: int, plan_id: int, phase_id: int, patch: dict) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    _, phase = _get_phase(db, project_id, plan_id, phase_id)

    content_changed = False
    for field in CONTENT_FIELDS:
        if field in patch and patch[field] is not None and patch[field] != getattr(phase, field):
            setattr(phase, field, patch[field])
            content_changed = True
    if content_changed:
        phase.grounding = None  # a person's edit: no longer the model's (checked) claim

    status = patch.get("status")
    if status is not None and status != phase.status:
        if phase.status not in EDITABLE_STATUSES:
            raise HTTPException(status_code=409, detail="Test cases were already generated for this phase.")
        phase.status = status
        if status == "approved":
            phase.approved_by, phase.approved_at = user_id, datetime.utcnow()
        else:
            phase.approved_by, phase.approved_at = None, None

    db.commit()
    db.refresh(phase)
    return serialize_phase(phase, _case_counts(db, [phase.id]).get(phase.id, 0))


def delete_plan(db: Session, user_id: int, project_id: int, plan_id: int) -> None:
    """Deletes the plan and its phases. Generated test cases stay (still protected as plan cases)."""
    require_project_role(db, user_id, project_id, "editor")
    plan = _get_plan(db, project_id, plan_id)
    phase_ids = [p.id for p in plan.phases]
    if phase_ids:
        (db.query(TestCase).filter(TestCase.plan_phase_id.in_(phase_ids))
         .update({TestCase.plan_phase_id: None}, synchronize_session=False))
    db.delete(plan)
    db.commit()


def delete_project_plans(db: Session, project_id: int) -> None:
    """For project deletion (caller commits): plans and phases, without leaving dangling links."""
    plan_ids = [pid for (pid,) in db.query(TestPlan.id).filter(TestPlan.project_id == project_id)]
    if not plan_ids:
        return
    phase_ids = [pid for (pid,) in db.query(TestPlanPhase.id).filter(TestPlanPhase.plan_id.in_(plan_ids))]
    if phase_ids:
        (db.query(TestCase).filter(TestCase.plan_phase_id.in_(phase_ids))
         .update({TestCase.plan_phase_id: None}, synchronize_session=False))
        db.query(TestPlanPhase).filter(TestPlanPhase.id.in_(phase_ids)).delete(synchronize_session=False)
    db.query(TestPlan).filter(TestPlan.id.in_(plan_ids)).delete(synchronize_session=False)


# ── Generation ───────────────────────────────────────────────────────────────

def _claim_for_generation(db: Session, phase: TestPlanPhase) -> bool:
    """Atomically mark the phase "generating", so two clicks can't generate twice."""
    now = datetime.utcnow()
    claimed = (
        db.query(TestPlanPhase)
        .filter(
            TestPlanPhase.id == phase.id,
            or_(TestPlanPhase.status.in_(("approved", "generated")),
                and_(TestPlanPhase.status == "generating", TestPlanPhase.updated_at < now - STALE_GENERATION)),
        )
        .update({TestPlanPhase.status: "generating", TestPlanPhase.updated_at: now}, synchronize_session=False)
    )
    db.commit()
    return claimed == 1


def _release(db: Session, phase: TestPlanPhase) -> None:
    """Back to approved / generated after a failed run."""
    db.rollback()
    has_cases = db.query(TestCase.id).filter(TestCase.plan_phase_id == phase.id).first() is not None
    db.query(TestPlanPhase).filter(TestPlanPhase.id == phase.id).update(
        {TestPlanPhase.status: "generated" if has_cases else "approved", TestPlanPhase.updated_at: datetime.utcnow()},
        synchronize_session=False,
    )
    db.commit()


def serialize_case(tc: TestCase) -> dict:
    return {
        "id": tc.id,
        "test_case_id": tc.test_case_id,
        "description": tc.description,
        "module": tc.module,
        "category": tc.category,
        "priority": tc.priority,
        "status": tc.status,
        "preconditions": tc.preconditions,
        "steps": tc.steps,
        "expected_result": tc.expected_result,
        "actual_result": tc.actual_result,
        "notes": tc.notes,
        "is_manual": tc.is_manual,
        "custom_fields": tc.custom_fields or {},
        "grounding": tc.grounding,
        "origin": tc.origin,
        "plan_phase_id": tc.plan_phase_id,
        "assignee_id": tc.assignee_id,
    }


def generate_phase(db: Session, user_id: int, project_id: int, plan_id: int, phase_id: int) -> dict:
    require_project_role(db, user_id, project_id, "editor")
    plan, phase = _get_phase(db, project_id, plan_id, phase_id)
    if phase.status in ("proposed", "skipped"):
        raise HTTPException(status_code=409, detail="Approve this phase before generating test cases.")
    workspace = db.query(Workspace).filter(Workspace.project_id == project_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found for this project.")
    existing_in_phase = db.query(TestCase).filter(TestCase.plan_phase_id == phase.id).count()
    if existing_in_phase >= MAX_CASES_PER_PHASE:
        raise HTTPException(status_code=409, detail=f"This phase already has {MAX_CASES_PER_PHASE} test cases.")
    if not _claim_for_generation(db, phase):
        raise HTTPException(status_code=409, detail="Test cases are already being generated for this phase.")

    try:
        result = _generate(db, user_id, project_id, plan, phase, workspace, existing_in_phase)
    except Exception:
        _release(db, phase)
        raise
    if not result.get("success"):
        _release(db, phase)
    return result


def _generate(db, user_id, project_id, plan, phase, workspace, existing_in_phase) -> dict:
    # The phase was written by the model and may have been edited since: checked like user input.
    fields = {"title": phase.title, "objective": phase.objective, "scope": phase.scope,
              "risks": "\n".join(phase.risks or []), "modules": "\n".join(phase.modules or [])}
    clean = {}
    for key, value in fields.items():
        check = input_guardrail.validate(value, source=Source.USER, field=f"phase.{key}")
        if check.blocked:
            return check.error_response()
        clean[key] = check.sanitized_text
    workflow = f"{clean['title']}: {clean['objective']}\n{clean['scope']}".strip()
    modules = [m for m in clean["modules"].split("\n") if m.strip()] or [clean["title"]]
    risks = [r for r in clean["risks"].split("\n") if r.strip()]

    model = _model(db, user_id)
    budget = plan_budget(model, workflow)
    if not budget.fits:
        return _too_long(budget)
    environment, env_block = _environment(db, project_id)
    if env_block:
        return env_block
    knowledge = retrieve(db, user_id, project_id, workflow, token_budget=budget.knowledge_tokens, model=model)

    existing_rows = (db.query(TestCase).filter(TestCase.workspace_id == workspace.id,
                                               TestCase.test_case_id != "IMPORT-DEFAULT")
                     .order_by(TestCase.id.desc()).all())
    # Shown to the model as "already covered"; masked like other prompt context.
    existing, _ = masker.mask_obj([
        {"id": tc.test_case_id, "module": tc.module or "", "category": tc.category or "",
         "description": tc.description or "", "steps": [s for s in (tc.steps or "").split("\n") if s.strip()],
         "expectedResult": tc.expected_result or ""}
        for tc in existing_rows[:MAX_EXISTING_CASES_IN_PROMPT]
    ])

    module_info = {"confirmed_modules": modules, "assumed_modules": [], "unknown_areas": []}
    generated = generate_test_cases_agent(
        workflow=workflow, modules=module_info, critical_workflows=[clean["title"]], high_risk_areas=risks,
        observed_steps=None, user_id=user_id, manual_test_cases=existing,
        manual_cases_budget=budget.manual_cases_tokens, knowledge=knowledge, environment=environment,
    )
    if isinstance(generated, dict):  # {"success": False, ...}
        return generated

    descriptions = [tc.description or "" for tc in existing_rows]
    fresh, duplicates = [], 0
    for tc in generated:
        if is_near_duplicate(tc.get("description", ""), descriptions):
            duplicates += 1
            continue
        descriptions.append(tc.get("description", ""))
        fresh.append(tc)
    fresh = fresh[:MAX_CASES_PER_PHASE - existing_in_phase]

    coverage = coverage_report(module_info, [clean["title"]], risks, fresh)
    graded, grounding_summary = ground_test_cases(
        fresh, workflow=f"{plan.scope}\n{workflow}", excerpts=knowledge)
    safe_cases, output_check = output_guardrail.validate_obj(graded, agent="test_plan_generation")
    if output_check.blocked:
        return output_check.error_response()

    rows = []
    for index, tc in enumerate(safe_cases, start=existing_in_phase + 1):
        row = TestCase(
            workspace_id=workspace.id, is_manual=False, origin=PLAN_ORIGIN, plan_phase_id=phase.id,
            test_case_id=f"P{phase.id}-TC-{index:03d}",
            description=str(tc.get("description") or "")[:5000], module=str(tc.get("module") or "General")[:100],
            category=str(tc.get("category") or "Functional")[:50], priority=str(tc.get("priority") or "Medium")[:20],
            status="Not Executed", preconditions=str(tc.get("preconditions") or ""),
            steps="\n".join(str(s).strip() for s in tc.get("steps") or [] if str(s).strip()),
            expected_result=str(tc.get("expectedResult") or ""), actual_result="", notes="",
            grounding=sanitize_grounding(tc.get("grounding")), custom_fields={},
        )
        db.add(row)
        rows.append(row)

    phase.status = "generated"
    phase.generated_at = datetime.utcnow()
    phase.generation = {
        "generated": len(rows), "skippedDuplicates": duplicates, "coverage": coverage["score"],
        "grounded": grounding_summary["grounded"], "assumed": grounding_summary["assumed"],
        "knowledgeSources": summarize_sources(knowledge) if knowledge else [],
    }
    db.commit()
    for row in rows:
        db.refresh(row)
    db.refresh(phase)
    logger.info(f"Test plan phase generated | project={project_id} phase={phase.id} cases={len(rows)} "
                f"duplicates={duplicates} coverage={coverage['score']}")
    return {
        "success": True,
        "phase": serialize_phase(phase, existing_in_phase + len(rows)),
        "testCases": [serialize_case(row) for row in rows],
    }
