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
 testEnvironment,
onTestEnvironmentChange,
}) {
  if (isCollapsed) {
    return (
      <div className="mt-4 rounded-xl border border-hairline bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 text-sm text-muted">
            <Route size={16} className="shrink-0 text-signal" />

            <div className="min-w-0">
              <span className="block truncate font-medium text-ink">
                {workflow || "Workflow not added yet"}
              </span>

              <span className="hidden text-xs text-muted sm:block">
                {analysisOutdated
                  ? "Modified after last analysis"
                  : "Analysis up to date"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onExpand}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-hairline bg-white px-3 py-2 text-sm font-semibold text-muted transition-all duration-200 hover:border-signal hover:text-ink"
          >
            <Pencil size={14} />
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-4 sm:px-5 ${hasResult ? "py-6" : "py-8"}`}>
      <div className="mx-auto max-w-5xl rounded-2xl border border-hairline bg-white p-5 shadow-sm md:p-7">
        {!hasResult && (
          <div className="hero-glow hero-glow-soft mb-7 rounded-xl border border-hairline bg-white p-5 text-left">
            <h1 className="text-2xl font-semibold text-ink md:text-3xl">
              Describe the workflow to test
            </h1>

            <p className="mt-2 text-sm leading-6 text-muted">
              Add your application flow and observed behavior. BugMind will generate
              structured modules, checklist items, and test cases.
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
            <label className="mb-3 block text-sm font-semibold text-ink">
              Test Environment
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium text-muted">
                  Platform
                </label>

                <select
                  value={testEnvironment.platform}
                  onChange={(e) =>
                    onTestEnvironmentChange({
                      ...testEnvironment,
                      platform: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-sm transition-all duration-200 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/10"
                >
                  <option value="">Select Platform</option>
                  <option value="Android">Android</option>
                  <option value="iOS">iOS</option>
                  <option value="Web">Web</option>
                  <option value="Desktop">Desktop</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted">
                  OS Version
                </label>

                <input
                  type="text"
                  placeholder="Android 15"
                  value={testEnvironment.osVersion}
                  onChange={(e) =>
                    onTestEnvironmentChange({
                      ...testEnvironment,
                      osVersion: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-sm transition-all duration-200 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted">
                  App Build
                </label>

                <input
                  type="text"
                  placeholder="1.4.2 (145)"
                  value={testEnvironment.build}
                  onChange={(e) =>
                    onTestEnvironmentChange({
                      ...testEnvironment,
                      build: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-sm transition-all duration-200 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted">
                  Device
                </label>

                <input
                  type="text"
                  placeholder="Pixel 8 Pro"
                  value={testEnvironment.device}
                  onChange={(e) =>
                    onTestEnvironmentChange({
                      ...testEnvironment,
                      device: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-sm transition-all duration-200 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/10"
                />
              </div>
            </div>
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
                className="rounded-lg border border-hairline bg-white px-4 py-2 text-sm font-semibold text-muted transition-all duration-200 hover:border-signal hover:bg-paper hover:text-ink"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="flex items-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
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