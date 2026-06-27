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
      <div className="mx-auto max-w-4xl mt-4 rounded-2xl border border-white/40 bg-surface/40 px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.03)] backdrop-blur-xl sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 text-sm text-muted">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal-soft">
              <Route size={16} className="text-signal" />
            </div>

            <div className="min-w-0">
              <span className="block truncate font-medium text-ink">
                {workflow || "Workflow not added yet"}
              </span>

              <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted sm:block">
                {analysisOutdated
                  ? "Modified after last analysis"
                  : "Analysis up to date"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onExpand}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-hairline bg-white/60 px-4 py-2 text-[13px] font-bold text-ink shadow-sm transition-all duration-200 hover:border-signal/30 hover:bg-white hover:text-signal hover:shadow"
          >
            <Pencil size={14} />
            Edit Scope
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-4 sm:px-5 ${hasResult ? "py-6" : "py-8"}`}>
      <div className="mx-auto max-w-5xl rounded-[1.5rem] border border-hairline/70 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:p-8">
        {!hasResult && (
          <div className="hero-glow hero-glow-soft relative mb-8 overflow-hidden rounded-2xl border border-[#3454d1]/15 bg-gradient-to-br from-[#f0f4ff] via-white to-[#eef2ff] p-6 text-center sm:p-8">

            {/* Floating background orbs */}
            <div className="workflow-orb-1 pointer-events-none absolute -left-8 -top-8 h-40 w-40 rounded-full bg-[#3454d1]/10 blur-2xl" />
            <div className="workflow-orb-2 pointer-events-none absolute -right-8 -bottom-6 h-48 w-48 rounded-full bg-[#60a5fa]/10 blur-2xl" />
            <div className="workflow-orb-3 pointer-events-none absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 rounded-full bg-[#1e3a8a]/08 blur-xl" />

            {/* Pulsing dots row */}
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="workflow-dot h-1.5 w-1.5 rounded-full bg-[#3454d1]" />
              <span className="workflow-dot h-1.5 w-1.5 rounded-full bg-[#3454d1]" />
              <span className="workflow-dot h-1.5 w-1.5 rounded-full bg-[#3454d1]" />
            </div>

            <h1 className="workflow-hero-title relative text-3xl font-extrabold tracking-tight sm:text-4xl">
              Describe the workflow to test
            </h1>

            {/* Subtle underline accent */}
            <div className="mx-auto mt-3 h-0.5 w-20 rounded-full bg-gradient-to-r from-transparent via-[#3454d1]/40 to-transparent" />

            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
              Add your application flow and observed behavior. BugMind will intelligently generate
              structured modules, a rigorous checklist, and comprehensive test cases.
            </p>
          </div>
        )}

        <div className="space-y-7">
          <div>
            <label className="mb-2 block text-sm font-semibold text-ink">
              Application Workflow
            </label>

            <textarea
              value={workflow}
              onChange={(event) => onWorkflowChange(event.target.value)}
              placeholder="E.g., User logs in → Navigates to Dashboard → Opens Messages → Sends a new message"
              rows={2}
              className="w-full resize-none rounded-xl border-2 border-hairline/60 bg-surface px-4 py-3.5 text-sm text-ink placeholder:text-muted/60 transition-all duration-200 focus:border-signal focus:bg-white focus:outline-none focus:ring-4 focus:ring-signal/10"
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