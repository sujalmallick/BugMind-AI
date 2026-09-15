from langgraph.graph import StateGraph, START, END

from models import WorkflowState
from agents.module_agent import identify_modules_agent
from agents.checklist_agent import generate_checklist_agent
from agents.test_case_agent import generate_test_cases_agent


# ── Node 1: Module Agent ──
def module_node(state: WorkflowState):
    workflow = state.get("workflow", "")
    user_id = state.get("user_id")

    module_data = identify_modules_agent(workflow, user_id=user_id)

    # Stop immediately if AI failed
    if isinstance(module_data, dict) and module_data.get("success") is False:
        return {"modules": module_data}

    return {
        "modules": module_data,
        "critical_workflows": module_data.get("critical_workflows", []),
        "high_risk_areas": module_data.get("high_risk_areas", []),
    }


# ── Node 2: Checklist Agent ──
def checklist_node(state: WorkflowState):
    modules = state.get("modules", {})

    # Forward AI error if prior step failed
    if isinstance(modules, dict) and modules.get("success") is False:
        return {"checklist": modules}

    checklist = generate_checklist_agent(
        workflow=state.get("workflow", ""),
        modules=modules,
        critical_workflows=state.get("critical_workflows", []),
        high_risk_areas=state.get("high_risk_areas", []),
        user_id=state.get("user_id"),
    )

    return {"checklist": checklist}


# ── Node 3: Test Case Agent ──
def test_case_node(state: WorkflowState):
    modules = state.get("modules", {})
    checklist = state.get("checklist")

    # Forward AI error if prior steps failed
    if isinstance(modules, dict) and modules.get("success") is False:
        return {"test_cases": modules}

    if isinstance(checklist, dict) and checklist.get("success") is False:
        return {"test_cases": checklist}

    test_cases = generate_test_cases_agent(
        workflow=state.get("workflow", ""),
        modules=modules,
        critical_workflows=state.get("critical_workflows", []),
        high_risk_areas=state.get("high_risk_areas", []),
        observed_steps=state.get("observed_steps"),
        user_id=state.get("user_id"),
    )

    return {"test_cases": test_cases}


# ── Conditional Routing Functions ──
def route_after_module(state: WorkflowState):
    modules = state.get("modules")
    if isinstance(modules, dict) and modules.get("success") is False:
        return END
    return "checklist_agent"


def route_after_checklist(state: WorkflowState):
    checklist = state.get("checklist")
    if isinstance(checklist, dict) and checklist.get("success") is False:
        return END
    return "test_case_agent"


# ── Build Graph ──
graph_builder = StateGraph(WorkflowState)

# Add nodes
graph_builder.add_node("module_agent", module_node)
graph_builder.add_node("checklist_agent", checklist_node)
graph_builder.add_node("test_case_agent", test_case_node)

# Connect edges with conditional error routing
graph_builder.add_edge(START, "module_agent")
graph_builder.add_conditional_edges("module_agent", route_after_module)
graph_builder.add_conditional_edges("checklist_agent", route_after_checklist)
graph_builder.add_edge("test_case_agent", END)

# Compile graph
workflow_graph = graph_builder.compile()