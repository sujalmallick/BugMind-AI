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
from auth.dependencies import get_current_user
from database.models.user import User
from fastapi import Depends, Request
from limiter import limiter
from slowapi import _rate_limit_exceeded_handler
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

app = FastAPI()

app.include_router(
    ai_settings_router
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(MaxBodySizeMiddleware)
app.add_middleware(TimeoutMiddleware)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(project_router)
app.include_router(workspace_router)
app.include_router(analysis_router)
app.include_router(test_case_router)
app.include_router(issue_router)
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(notification_router)
app.include_router(organization_router)
app.include_router(invitation_router, prefix="/api")
app.include_router(assignment_router, prefix="/api")

# Serve uploaded avatars as static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/health")
def health_check():
    return {
        "database": "ok",
        "llm": "ok",
        "redis": "ok"
    }

@app.post("/analyze-workflow")
@limiter.limit("10/minute")
def analyze_workflow(request: Request, data: WorkflowInput,  current_user: User = Depends(get_current_user)):

    result = workflow_graph.invoke(
        {
            "user_id": current_user.id,
            "workflow": data.workflow,
            "observed_steps": data.observed_steps,
            "existing_checklist": data.existing_checklist,
            "existing_test_cases": data.existing_test_cases
        }
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

    return {

        "success": True,

        "workflow": result.get("workflow"),

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

    }
@app.post("/analyze-issue")
@limiter.limit("10/minute")
def analyze_issue(request: Request, data: IssueInput):

    return analyze_issue_agent(

        workflow=data.workflow,

        observation=data.observation,

        expected_result=data.expected_result,

        actual_result=data.actual_result,

        failed_test_case=data.failed_test_case

    )