from langgraph.graph import StateGraph, START, END

from models import WorkflowState

from agents.module_agent import identify_modules_agent
from agents.checklist_agent import generate_checklist_agent
from agents.testcase_agent import generate_test_cases_agent


# Module Agent Node
def module_node(state: WorkflowState):

    module_data = identify_modules_agent(
        state["workflow"]
    )

    return {

        "modules": module_data,

        "critical_workflows":
            module_data.get(
                "critical_workflows",
                []
            ),

        "high_risk_areas":
            module_data.get(
                "high_risk_areas",
                []
            )

    }


# Checklist Agent Node
def checklist_node(state: WorkflowState):

    checklist = generate_checklist_agent(

        workflow=state["workflow"],

        modules=state["modules"],

        critical_workflows=state["critical_workflows"],

        high_risk_areas=state["high_risk_areas"]

    )

    return {

        "checklist": checklist

    }
# Test Case Agent Node
def test_case_node(state: WorkflowState):

    return {
        "test_cases": generate_test_cases_agent(

            workflow=state["workflow"],

            modules=state["modules"],

            critical_workflows=state["critical_workflows"],

            high_risk_areas=state["high_risk_areas"],

            observed_steps=state.get("observed_steps")

        )
    }

# Build graph
graph_builder = StateGraph(WorkflowState)


# Add nodes
graph_builder.add_node(
    "module_agent",
    module_node
)

graph_builder.add_node(
    "checklist_agent",
    checklist_node
)

graph_builder.add_node(
    "test_case_agent",
    test_case_node
)


# Connect nodes
graph_builder.add_edge(
    START,
    "module_agent"
)

graph_builder.add_edge(
    "module_agent",
    "checklist_agent"
)

graph_builder.add_edge(
    "checklist_agent",
    "test_case_agent"
)

graph_builder.add_edge(
    "test_case_agent",
    END
)


# Compile graph
workflow_graph = graph_builder.compile()