import { Route, Pencil, Loader2 } from "lucide-react";

export default function WorkflowInputPanel({
  workflow,
  observedSteps,
  onWorkflowChange,
  onObservedStepsChange,
  onAnalyze,
  isAnalyzing,
  isCollapsed,
  onExpand,
  error,
  hasResult,
  analysisOutdated,
}) {
  if (isCollapsed) {
    return (
      <div className="mt-4 rounded-xl border border-hairline bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 text-sm text-muted">
            <Route size={17} className="shrink-0 text-signal" />

            <span className="truncate font-medium text-ink">
              {workflow}
            </span>

         {analysisOutdated ? (
  <span className="hidden shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 sm:inline">
    Modified after last analysis
  </span>
) : (
  <span className="hidden shrink-0 sm:inline">
    • analyzed just now
  </span>
)}

          </div>

          <button
            type="button"
            onClick={onExpand}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-muted transition-all duration-200 hover:border-signal hover:bg-paper hover:text-ink"
          >
            <Pencil size={14} />
            Edit workflow
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-5 ${hasResult ? "py-6" : "py-10"}`}>
      <div className="mx-auto max-w-5xl rounded-2xl border border-hairline bg-white p-8 shadow-sm">
        {!hasResult && (
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-ink">
              Describe the workflow to test
            </h1>

            <p className="mt-3 text-sm leading-6 text-muted">
              Paste your application's workflow and optionally include the
              steps you observed while testing.
            </p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-ink">
              Application Workflow
            </label>

            <textarea
              value={workflow}
              onChange={(event) => onWorkflowChange(event.target.value)}
              placeholder="Login → Dashboard → Messages"
              rows={2}
              className="w-full resize-none rounded-xl border border-hairline bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted transition-all duration-200 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/10"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-ink">
              Observed Steps
              <span className="ml-1 text-xs font-normal text-muted">
                (Optional)
              </span>
            </label>

            <textarea
              value={observedSteps}
              onChange={(event) => onObservedStepsChange(event.target.value)}
              placeholder={"1. Open App\n2. Tap Login\n3. Enter Email"}
              rows={4}
              className="w-full resize-none rounded-xl border border-hairline bg-surface px-4 py-3 font-mono text-sm text-ink placeholder:text-muted transition-all duration-200 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/10"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
<div className="mt-2 flex items-center justify-end gap-3">
            {hasResult && (
              <button
                type="button"
                onClick={onExpand}
                className="rounded-lg border border-hairline bg-white px-4 py-2 text-sm text-muted transition-all duration-200 hover:border-signal hover:bg-paper hover:text-ink"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="flex items-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzing && (
                <Loader2 size={15} className="animate-spin" />
              )}

            {isAnalyzing
  ? "Analyzing workflow..."
  : analysisOutdated
  ? "Re-analyze Workflow"
  : "Analyze Workflow"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}