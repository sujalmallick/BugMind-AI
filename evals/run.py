"""
Run the quality evals against a real model.

    python -m evals.run                              # default provider/model from config.py, keys from .env
    python -m evals.run --model groq/openai/gpt-oss-20b --provider groq
    python -m evals.run --cases auth_signup_login,bank_transfer --repeat 2
    python -m evals.run --pause 60                                # Groq free tier: one case per minute
    python -m evals.run --baseline evals/baseline.json            # exit 1 on regression
    python -m evals.run --update-baseline                         # record the current scores

This makes real LLM calls (3 per case per repeat) and spends provider quota.
It never touches the application database.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = Path(__file__).parent / "reports"
DEFAULT_BASELINE = Path(__file__).parent / "baseline.json"


def _fmt(value):
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "yes" if value else "NO"
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--provider", help="Override provider (default: config.DEFAULT_PROVIDER)")
    parser.add_argument("--model", help="Override model (default: config.DEFAULT_MODEL)")
    parser.add_argument("--cases", help="Comma-separated case ids (default: all)")
    parser.add_argument("--repeat", type=int, default=1, help="Runs per case, to smooth out sampling noise")
    parser.add_argument("--pause", type=float, default=0,
                        help="Seconds to wait between runs, for per-minute token limits (e.g. 60 on Groq free tier)")
    parser.add_argument("--baseline", type=Path, help="Compare against this baseline; exit 1 on regression")
    parser.add_argument("--tolerance", type=float, default=0.1, help="Allowed absolute drop per metric")
    parser.add_argument("--update-baseline", action="store_true", help=f"Write aggregate scores to {DEFAULT_BASELINE.name}")
    parser.add_argument("--out", type=Path, help="Report path (default: evals/reports/<timestamp>.json)")
    args = parser.parse_args(argv)

    sys.path.insert(0, str(ROOT))
    import utils  # loads .env and builds the default LLM manager
    from config import DEFAULT_MODEL, DEFAULT_PROVIDER
    from evals.harness import compare_to_baseline, evaluate, load_cases
    from services.llm_manager import LLMManager

    provider = args.provider or DEFAULT_PROVIDER
    model = args.model or DEFAULT_MODEL
    utils.default_llm_manager = LLMManager(provider=provider, model=model)

    cases = load_cases(only=args.cases.split(",") if args.cases else None)
    print(f"Evaluating {len(cases)} case(s) x {args.repeat} on {provider} / {model} "
          f"({len(cases) * args.repeat * 3} LLM calls)\n")

    columns = ("case", "ok", "quality", "module_recall", "risk_coverage", "category_coverage",
               "uniqueness", "step_completeness", "checklist_module_coverage", "test_case_count", "seconds")
    print(" | ".join(columns))

    def show(run):
        print(" | ".join(_fmt(run.get(c)) for c in columns) + (f"   ({run['error']})" if run.get("error") else ""))

    report = evaluate(cases, repeat=args.repeat, on_result=show, pause_seconds=args.pause)
    report["meta"] = {
        "provider": provider,
        "model": model,
        "cases": [c["id"] for c in cases],
        "repeat": args.repeat,
        "pause_seconds": args.pause,
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    print("\nAggregate:")
    for key, value in report["aggregate"].items():
        print(f"  {key:28} {_fmt(value)}")

    out = args.out or REPORTS / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{model.replace('/', '_')}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nReport: {out}")

    if args.update_baseline:
        DEFAULT_BASELINE.write_text(json.dumps({"meta": report["meta"], **report["aggregate"]}, indent=2) + "\n",
                                    encoding="utf-8")
        print(f"Baseline updated: {DEFAULT_BASELINE}")

    if args.baseline:
        baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
        regressions = compare_to_baseline(report["aggregate"], baseline, args.tolerance)
        if regressions:
            print("\nREGRESSIONS vs baseline:")
            for r in regressions:
                print(f"  - {r}")
            return 1
        print(f"\nNo regressions vs baseline (tolerance {args.tolerance}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
