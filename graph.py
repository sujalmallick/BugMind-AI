import json
import logging
import os

from langgraph.graph import StateGraph, START, END

from models import WorkflowState
from agents.coverage import coverage_report, is_near_duplicate
from agents.module_agent import identify_modules_agent
from agents.checklist_agent import generate_checklist_agent
from agents.test_case_agent import fill_coverage_gaps_agent, generate_test_cases_agent, number_test_cases

logger = logging.getLogger("BugMind")


def coverage_max_rounds() -> int:
    """
    Targeted fill-in rounds after the first test case pass. Env: COVERAGE_MAX_ROUNDS (0-2).
    Defaults to 0: the coverage check still runs and logs, but no extra LLM call is
    made until the fill-in has been validated with the quality evals.
    """
    try:
        return max(0, min(2, int(os.getenv("COVERAGE_MAX_ROUNDS", "0"))))
    except ValueError:
        return 0


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
        manual_test_cases=state.get("project_test_cases"),
    )

    return {"test_cases": test_cases}


# ── Node 4: Coverage Check (deterministic) ──
def coverage_node(state: WorkflowState):
    # The project's manual test cases count too: a gap they already cover isn't a gap.
    report = coverage_report(
        modules=state.get("modules", {}),
        critical_workflows=state.get("critical_workflows", []),
        high_risk_areas=state.get("high_risk_areas", []),
        test_cases=(state.get("test_cases") or []) + (state.get("project_test_cases") or []),
    )
    rounds = state.get("coverage_rounds", 0)

    # Counts only: gap targets are model-written text derived from user input.
    gap_kinds: dict[str, int] = {}
    for gap in report["gaps"]:
        gap_kinds[gap["kind"]] = gap_kinds.get(gap["kind"], 0) + 1
    logger.info(json.dumps({
        "event": "coverage", "round": rounds, "score": report["score"],
        "covered": report["covered"], "targets": report["targets"], "gaps": gap_kinds,
    }, separators=(",", ":")))

    update = {"coverage": report}
    if "coverage_initial" not in state:
        update["coverage_initial"] = report
    return update


# ── Node 5: Targeted fill-in for coverage gaps ──
def fill_gaps_node(state: WorkflowState):
    """
    One extra LLM call for the gaps only. Best-effort: on any failure the
    existing test cases are kept unchanged, so the analysis never fails here.
    """
    test_cases = list(state.get("test_cases") or [])
    manual_test_cases = list(state.get("project_test_cases") or [])
    rounds = state.get("coverage_rounds", 0) + 1

    try:
        new_cases = fill_coverage_gaps_agent(
            workflow=state.get("workflow", ""),
            modules=state.get("modules", {}),
            gaps=state["coverage"]["gaps"],
            existing_test_cases=test_cases + manual_test_cases,
            user_id=state.get("user_id"),
        )
    except Exception:
        logger.warning("Coverage fill-in raised; keeping existing test cases.", exc_info=True)
        return {"coverage_rounds": rounds}

    if isinstance(new_cases, dict):  # {"success": False, ...}
        logger.warning(f"Coverage fill-in failed ({new_cases.get('code', 'error')}); keeping existing test cases.")
        return {"coverage_rounds": rounds}

    descriptions = [tc.get("description", "") for tc in test_cases + manual_test_cases]
    added = []
    for tc in new_cases:
        if is_near_duplicate(tc.get("description", ""), descriptions):
            continue
        descriptions.append(tc.get("description", ""))
        added.append(tc)

    number_test_cases(added, start=len(test_cases) + 1)
    return {"test_cases": test_cases + added, "coverage_rounds": rounds}


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


def route_after_test_cases(state: WorkflowState):
    test_cases = state.get("test_cases")
    if isinstance(test_cases, dict) and test_cases.get("success") is False:
        return END
    return "coverage_check"


def route_after_coverage(state: WorkflowState):
    if state["coverage"]["gaps"] and state.get("coverage_rounds", 0) < coverage_max_rounds():
        return "fill_gaps"
    return END


# ── Build Graph ──
graph_builder = StateGraph(WorkflowState)

# Add nodes
graph_builder.add_node("module_agent", module_node)
graph_builder.add_node("checklist_agent", checklist_node)
graph_builder.add_node("test_case_agent", test_case_node)
graph_builder.add_node("coverage_check", coverage_node)
graph_builder.add_node("fill_gaps", fill_gaps_node)

# Connect edges with conditional error routing
graph_builder.add_edge(START, "module_agent")
graph_builder.add_conditional_edges("module_agent", route_after_module)
graph_builder.add_conditional_edges("checklist_agent", route_after_checklist)
graph_builder.add_conditional_edges("test_case_agent", route_after_test_cases)
graph_builder.add_conditional_edges("coverage_check", route_after_coverage)
graph_builder.add_edge("fill_gaps", "coverage_check")

# Compile graph
workflow_graph = graph_builder.compile()