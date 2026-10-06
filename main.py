import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes.workspace import router as workspace_router
from models import WorkflowInput, IssueInput
from graph import workflow_graph
from agents.issue_agent import analyze_issue_agent
from routes.project import router as project_router
from routes.analysis import router as analysis_router
from routes.test_case import router as test_case_router
from routes.issue import router as issue_router
from routes.auth import router as auth_router
from routes.user import router as user_router
from routes.notification import router as notification_router
from routes.organization import router as organization_router
from routes.invitation import router as invitation_router
from routes.assignment import router as assignment_router
from routes.comment import router as comment_router
from routes.dashboard import router as dashboard_router
from routes.activity import router as activity_router
from routes.documents import router as documents_router
from auth.dependencies import get_current_user
from database.models.user import User
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from database.session import get_db
from services.project_context import find_similar_issues, get_manual_test_cases, get_test_case_by_ref
from services.knowledge_retrieval import retrieve as retrieve_knowledge, summarize_sources
from services.prompt_budget import plan_budget
from config import DEFAULT_MODEL
from services.ai_settings_service import ai_settings_service
from auth.permissions import require_project_role
from limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIASGIMiddleware
from body_limit import StreamingBodyLimitMiddleware
from slowapi.errors import RateLimitExceeded
from middlewares import (
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
    MaxBodySizeMiddleware,
    TimeoutMiddleware,
)
from routes.ai_settings import (
    router as ai_settings_router
)
from routes.ai_workload import router as ai_workload_router
from guardrails import Source, input_guardrail, masker, output_guardrail
from services.guardrail_llm import guardrail_llm

# API docs are a full endpoint map; only serve them outside production.
_is_development = os.getenv("ENVIRONMENT", "production").lower() in ("development", "dev", "local")
app = FastAPI(
    docs_url="/docs" if _is_development else None,
    redoc_url="/redoc" if _is_development else None,
    openapi_url="/openapi.json" if _is_development else None,
)

# Registered first so it sits innermost, right next to the router: its 413 must
# reach FastAPI's body parser directly, not through BaseHTTPMiddleware task groups.
app.add_middleware(StreamingBodyLimitMiddleware)

app.include_router(
    ai_settings_router
)
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "https://black-smoke-05d3e7e00.5.azurestaticapps.net").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(MaxBodySizeMiddleware)
app.add_middleware(TimeoutMiddleware)

app.state.limiter = limiter
# Applies limiter.default_limits to every route without its own @limiter.limit.
app.add_middleware(SlowAPIASGIMiddleware)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from fastapi.responses import JSONResponse
import logging

app_logger = logging.getLogger("BugMind")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None)
    app_logger.error(f"[{request_id}] Unhandled Exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    # This handler runs outside CORSMiddleware, so add CORS headers here so the
    # frontend can read the error -- but only for allowlisted origins.
    headers = {}
    origin = request.headers.get("origin")
    if origin and origin in allowed_origins:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": "An unexpected error occurred.", "request_id": request_id},
        headers=headers,
    )

app.include_router(project_router)
app.include_router(workspace_router)
app.include_router(analysis_router)
app.include_router(ai_workload_router)
app.include_router(test_case_router)
app.include_router(issue_router)
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(notification_router)
app.include_router(organization_router)
app.include_router(invitation_router, prefix="/api")
app.include_router(assignment_router, prefix="/api")
app.include_router(comment_router, prefix="/api")
app.include_router(dashboard_router)
app.include_router(activity_router)
app.include_router(documents_router)

# Serve uploaded avatars as static files
os.makedirs("uploads/avatars", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.on_event("startup")
def start_job_worker():
    """Background jobs (e.g. document processing) run in a worker thread per process."""
    from services import documents  # noqa: F401 — registers the document.process handler
    from services.jobs import start_worker

    start_worker()


@app.on_event("startup")
def self_heal_database_schema():
    """Ensure newly added columns exist in the database upon startup."""
    from sqlalchemy import text
    from database.session import engine
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS custom_fields JSON DEFAULT '{}'::json;"))
        except Exception as e:
            print(f"Startup self-heal test_cases.custom_fields: {e}")
        try:
            conn.execute(text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS custom_fields JSON DEFAULT '{}'::json;"))
        except Exception as e:
            print(f"Startup self-heal issues.custom_fields: {e}")
        try:
            conn.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS checklist_progress JSON DEFAULT '{}'::json;"))
        except Exception as e:
            print(f"Startup self-heal workspaces.checklist_progress: {e}")


@app.get("/health")
def health_check():
    from sqlalchemy import text
    from database.session import SessionLocal
    db_status = "ok"
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        # Unauthenticated endpoint: never return driver errors (host/user names).
        app_logger.error(f"Health check database error: {e}")
        db_status = "error"
    finally:
        db.close()

    all_ok = db_status == "ok"
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={"status": "healthy" if all_ok else "degraded", "database": db_status}
    )

@app.post("/analyze-workflow")
@limiter.limit("10/minute")
def analyze_workflow(
    request: Request,
    data: WorkflowInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Project access first: no guardrail or LLM work on behalf of a project the caller can't view.
    project_test_cases = []
    if data.project_id is not None:
        require_project_role(db, current_user.id, data.project_id, "viewer")
        # Server-loaded (never client-supplied) manual test cases, masked like other graph state.
        project_test_cases, _ = masker.mask_obj(get_manual_test_cases(db, current_user.id, data.project_id))

    # ── Input guardrail: injection check + PII/secret masking before any agent runs ──
    workflow_check = input_guardrail.validate(data.workflow, source=Source.USER, field="workflow")
    if workflow_check.blocked:
        return workflow_check.error_response()

    observed_steps, steps_block = input_guardrail.validate_many(
        data.observed_steps, source=Source.USER, field="observed_steps"
    )
    if steps_block:
        return steps_block.error_response()

    # Context-window budget for the user's model. A workflow that can't fit is refused
    # here, before any model call (including the injection classifier) spends tokens.
    try:
        model = ai_settings_service.get_model(db, current_user.id)
    except Exception:  # settings lookup failed: budget for the default model rather than fail the request
        db.rollback()
        model = DEFAULT_MODEL
    budget = plan_budget(model, "\n".join([data.workflow, *(data.observed_steps or [])]))
    if not budget.fits:
        return {
            "success": False,
            "code": "context_too_long",
            "error": (
                f"This workflow is too long for the selected AI model ({budget.workflow_tokens:,} tokens; "
                f"the model reads about {budget.context_tokens:,}). Shorten it or choose a model with a "
                "larger context window."
            ),
        }

    # Model-based second opinion (paraphrased / non-English injections). Runs on
    # the masked text; fails open, since the rule checks above already ran.
    classifier_check = input_guardrail.classify(
        {"workflow": workflow_check.sanitized_text, "observed_steps": "\n".join(observed_steps or [])},
        guardrail_llm(current_user.id),
    )
    if classifier_check.blocked:
        return classifier_check.error_response()

    # Target test environment (user text): the same input checks as the workflow.
    test_environment = {}
    if data.environment:
        for key, value in data.environment.model_dump().items():
            if not value or not str(value).strip():
                continue
            env_check = input_guardrail.validate(str(value), source=Source.USER, field=f"environment.{key}")
            if env_check.blocked:
                return env_check.error_response()
            test_environment[key] = env_check.sanitized_text

    # RAG retrieval: excerpts of this project's documents that match the workflow.
    project_knowledge = []
    if data.project_id is not None:
        query = "\n".join([data.workflow, *(data.observed_steps or [])])
        project_knowledge = retrieve_knowledge(db, current_user.id, data.project_id, query,
                                               token_budget=budget.knowledge_tokens, model=model)

    # Not sent to the LLM today, but they enter graph state (and traces).
    existing_checklist, _ = masker.mask_obj(data.existing_checklist)
    existing_test_cases, _ = masker.mask_obj(data.existing_test_cases)

    run_config = {
        "run_name": f"Workflow Analysis - User {current_user.id}",
        "tags": ["workflow-analysis", f"user:{current_user.id}"],
        "metadata": {
            "user_id": current_user.id,
            "workflow_length": len(data.workflow) if data.workflow else 0,
            "has_observed_steps": bool(data.observed_steps),
            "knowledge_excerpts": len(project_knowledge),
            "model": model,
            "context_tokens": budget.context_tokens,
            "workflow_tokens": budget.workflow_tokens,
            "has_test_environment": bool(test_environment),
        },
    }

    result = workflow_graph.invoke(
        {
            "user_id": current_user.id,
            "workflow": workflow_check.sanitized_text,
            "observed_steps": observed_steps,
            "existing_checklist": existing_checklist,
            "existing_test_cases": existing_test_cases,
            "project_test_cases": project_test_cases,
            "project_knowledge": project_knowledge,
            "test_environment": test_environment,
            "manual_cases_tokens": budget.manual_cases_tokens,
        },
        config=run_config,
    )

    modules = result.get("modules", {})
    checklist = result.get("checklist")
    test_cases = result.get("test_cases")

    # Return AI errors immediately
    if isinstance(modules, dict) and modules.get("success") is False:
        return modules

    if isinstance(checklist, dict) and checklist.get("success") is False:
        return checklist

    if isinstance(test_cases, dict) and test_cases.get("success") is False:
        return test_cases

    # ── Output guardrail on everything the agents generated ──
    generated, output_check = output_guardrail.validate_obj({

        "confirmedModules":
            modules.get("confirmed_modules", []),

        "assumedModules":
            modules.get("assumed_modules", []),

        "criticalWorkflows":
            result.get("critical_workflows", []),

        "highRiskAreas":
            result.get("high_risk_areas", []),

        "checklist":
            checklist if isinstance(checklist, list) else [],

        "testCases":
            test_cases if isinstance(test_cases, list) else []

    }, agent="workflow_graph")

    if output_check.blocked:
        return output_check.error_response()

    response = {
        "success": True,
        # The caller's own input, echoed back unchanged (never the masked copy).
        "workflow": data.workflow,
        **generated,
    }
    if project_knowledge:
        # Which documents informed this analysis (only present when some did).
        response["knowledgeSources"] = summarize_sources(project_knowledge)
    return response


@app.post("/analyze-issue")
@limiter.limit("10/minute")
def analyze_issue(
    request: Request,
    data: IssueInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check project access before any guardrail or LLM work is done on its behalf.
    if data.project_id is not None:
        require_project_role(db, current_user.id, data.project_id, "viewer")

    sanitized = {}
    for field in ("workflow", "observation", "expected_result", "actual_result"):
        value = getattr(data, field)
        if value is None:
            sanitized[field] = None
            continue
        check = input_guardrail.validate(value, source=Source.USER, field=field)
        if check.blocked:
            return check.error_response()
        sanitized[field] = check.sanitized_text

    classifier_check = input_guardrail.classify(
        {k: v for k, v in sanitized.items() if v}, guardrail_llm(current_user.id),
    )
    if classifier_check.blocked:
        return classifier_check.error_response()

    # Project context (read-only, viewer role): the failing test case and possible duplicates.
    test_case = None
    if data.project_id is not None and data.test_case_ref:
        test_case = get_test_case_by_ref(db, current_user.id, data.project_id, data.test_case_ref)

    result = analyze_issue_agent(
        failed_test_case=data.failed_test_case,
        user_id=current_user.id,
        test_case=test_case,
        **sanitized,
    )

    if data.project_id is not None and not (isinstance(result, dict) and result.get("success") is False):
        result = {
            **result,
            # Keyword similarity against existing issues; computed locally, never sent to the LLM.
            "possibleDuplicates": find_similar_issues(db, current_user.id, data.project_id, data.observation),
            "linkedTestCase": {"dbId": test_case["dbId"], "id": test_case["id"]} if test_case else None,
        }

    safe_result, output_check = output_guardrail.validate_obj(result, agent="issue_agent")
    if output_check.blocked:
        return output_check.error_response()
    return safe_result
