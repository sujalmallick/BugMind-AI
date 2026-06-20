from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.workspace import router as workspace_router
from models import WorkflowInput, IssueInput
from graph import workflow_graph
from agents.issue_agent import analyze_issue_agent
from routes.project import router as project_router
from routes.analysis import router as analysis_router
from routes.test_case import router as test_case_router
from routes.issue import router as issue_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(project_router)
app.include_router(workspace_router)
app.include_router(analysis_router)
app.include_router(test_case_router)
app.include_router(issue_router)

@app.post("/analyze-workflow")
def analyze_workflow(data: WorkflowInput):

    result = workflow_graph.invoke(
        {
            "workflow": data.workflow,
            "observed_steps": data.observed_steps
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
def analyze_issue(data: IssueInput):

    return analyze_issue_agent(

        workflow=data.workflow,

        observation=data.observation,

        expected_result=data.expected_result,

        actual_result=data.actual_result,

        failed_test_case=data.failed_test_case

    )