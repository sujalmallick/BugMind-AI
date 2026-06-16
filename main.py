from fastapi import FastAPI
from models import WorkflowInput
from agents.checklist_agent import generate_checklist_agent
from agents.module_agent import identify_modules_agent
from agents.testcase_agent import generate_test_cases_agent
from graph import workflow_graph

app = FastAPI()

@app.post("/generate-checklist")
def generate_checklist(data: WorkflowInput):

    return {
        "checklist":
        generate_checklist_agent(
            data.workflow
        )
    }

@app.post("/identify-modules")
def identify_modules(data: WorkflowInput):

    return identify_modules_agent(
        data.workflow
    )

@app.post("/generate-test-cases")
def generate_test_cases(data: WorkflowInput):

    return {
        "test_cases":
        generate_test_cases_agent(
            data.workflow,
            data.observed_steps
        )
    }

@app.post("/analyze-workflow")
def analyze_workflow(data: WorkflowInput):

    result = workflow_graph.invoke(
        {
            "workflow":
            data.workflow,

            "observed_steps":
            data.observed_steps
        }
    )

    return result