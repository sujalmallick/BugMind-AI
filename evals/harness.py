"""
evals/harness.py — run eval cases through the real agent pipeline and score them.

run_pipeline() mirrors POST /analyze-workflow (input guardrail → LangGraph →
output guardrail → response shape) with user_id=None, so it uses the default
provider key and never touches the application database. A test keeps it in
lockstep with the endpoint.
"""

import json
import time
from pathlib import Path
from statistics import mean

from evals.scorers import QUALITY_METRICS, score_result

DATASET = Path(__file__).parent / "datasets" / "workflows.json"


def load_cases(path: Path = DATASET, only: list[str] | None = None) -> list[dict]:
    cases = json.loads(Path(path).read_text(encoding="utf-8"))["cases"]
    if only:
        unknown = set(only) - {c["id"] for c in cases}
        if unknown:
            raise ValueError(f"Unknown eval case id(s): {', '.join(sorted(unknown))}")
        cases = [c for c in cases if c["id"] in only]
    return cases


def run_pipeline(workflow: str, observed_steps: list[str] | None = None) -> dict:
    from graph import workflow_graph
    from guardrails import Source, input_guardrail, output_guardrail

    workflow_check = input_guardrail.validate(workflow, source=Source.USER, field="workflow")
    if workflow_check.blocked:
        return workflow_check.error_response()

    steps, steps_block = input_guardrail.validate_many(observed_steps, source=Source.USER, field="observed_steps")
    if steps_block:
        return steps_block.error_response()

    result = workflow_graph.invoke(
        {
            "user_id": None,
            "workflow": workflow_check.sanitized_text,
            "observed_steps": steps,
            "existing_checklist": None,
            "existing_test_cases": None,
        },
        config={"run_name": "Quality Eval", "tags": ["eval"]},
    )

    modules = result.get("modules", {})
    checklist = result.get("checklist")
    test_cases = result.get("test_cases")
    for part in (modules, checklist, test_cases):
        if isinstance(part, dict) and part.get("success") is False:
            return part

    generated, output_check = output_guardrail.validate_obj({
        "confirmedModules": modules.get("confirmed_modules", []),
        "assumedModules": modules.get("assumed_modules", []),
        "criticalWorkflows": result.get("critical_workflows", []),
        "highRiskAreas": result.get("high_risk_areas", []),
        "checklist": checklist if isinstance(checklist, list) else [],
        "testCases": test_cases if isinstance(test_cases, list) else [],
    }, agent="workflow_graph")
    if output_check.blocked:
        return output_check.error_response()

    return {"success": True, "workflow": workflow, **generated}


def evaluate(cases: list[dict], repeat: int = 1, on_result=None) -> dict:
    """Run every case `repeat` times. Returns per-run scores plus aggregates."""
    from services.llm_usage import finish_request_collection, start_request_collection

    runs = []
    for case in cases:
        for attempt in range(1, repeat + 1):
            token = start_request_collection()
            start = time.perf_counter()
            try:
                result = run_pipeline(case["workflow"], case.get("observed_steps"))
            except Exception as exc:  # a crash is a failed run, not a harness failure
                result = {"success": False, "error": f"{type(exc).__name__}: {exc}"}
            elapsed = time.perf_counter() - start
            usage = finish_request_collection(token, method="EVAL", path=case["id"], status_code=None) or {}

            run = {
                "case": case["id"],
                "attempt": attempt,
                "seconds": round(elapsed, 2),
                "llm_calls": usage.get("calls", 0),
                "total_tokens": usage.get("total_tokens"),
                "cost_usd": usage.get("cost_usd"),
                **score_result(result, case["expect"]),
            }
            runs.append(run)
            if on_result:
                on_result(run)

    return {"runs": runs, "aggregate": aggregate(runs)}


def aggregate(runs: list[dict]) -> dict:
    if not runs:
        return {}
    agg = {
        "runs": len(runs),
        "ok_rate": mean(1.0 if r["ok"] else 0.0 for r in runs),
        "quality": mean(r["quality"] for r in runs),
        **{m: mean(r[m] for r in runs) for m in QUALITY_METRICS},
        "category_diversity": mean(r["category_diversity"] for r in runs),
        "count_in_range_rate": mean(1.0 if r["test_case_count_in_range"] else 0.0 for r in runs),
        "mean_seconds": mean(r["seconds"] for r in runs),
    }
    tokens = [r["total_tokens"] for r in runs if r["total_tokens"] is not None]
    costs = [r["cost_usd"] for r in runs if r["cost_usd"] is not None]
    agg["total_tokens"] = sum(tokens) if tokens else None
    agg["total_cost_usd"] = round(sum(costs), 6) if costs else None
    return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in agg.items()}


# Metrics a baseline comparison guards (all "higher is better").
GUARDED_METRICS = ("ok_rate", "quality", *QUALITY_METRICS)


def compare_to_baseline(current: dict, baseline: dict, tolerance: float = 0.1) -> list[str]:
    """Regressions where a guarded metric dropped by more than `tolerance` (absolute)."""
    regressions = []
    for metric in GUARDED_METRICS:
        if metric in baseline and metric in current and current[metric] < baseline[metric] - tolerance:
            regressions.append(f"{metric}: {baseline[metric]:.3f} → {current[metric]:.3f}")
    return regressions
