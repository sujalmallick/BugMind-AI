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
      <div className="glass mx-auto mt-3 max-w-4xl rounded-xl px-3 py-2.5 sm:mt-4 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5 text-xs sm:text-sm text-muted">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal-soft">
              <Route size={15} className="text-signal" />
            </div>

            <div className="min-w-0">
              <span className="block truncate font-medium text-ink">
                {workflow || "Workflow not added yet"}
              </span>

              <span className="hidden text-[12px] text-muted sm:block">
                {analysisOutdated
                  ? "Modified after last analysis"
                  : "Analysis up to date"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onExpand}
            className="btn-secondary shrink-0"
          >
            <Pencil size={13} />
            <span>Edit scope</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-2 sm:px-5 ${hasResult ? "py-4 sm:py-6" : "py-5 sm:py-8"}`}>
      <div className="mx-auto max-w-4xl rounded-xl border border-hairline bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6 md:p-8">
        {!hasResult && (
          <div className="mb-8 border-b border-hairline pb-6">
            <p className="eyebrow">New analysis</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-[1.75rem]">
              Describe the workflow to test
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
              Enter your application flow and any observed steps. BugMind will
              break it into modules, generate a test checklist, and produce
              ready-to-execute test cases.
            </p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label htmlFor="wf-workflow" className="mb-1.5 block text-[13px] font-medium text-ink">
              Application workflow
            </label>

            <textarea
              value={workflow}
              onChange={(event) => onWorkflowChange(event.target.value)}
              placeholder="E.g., User logs in → Navigates to Dashboard → Opens Messages → Sends a new message"
              id="wf-workflow"
              rows={3}
              className="field resize-none"
            />
          </div>

          <div>
            <p className="mb-3 text-[13px] font-medium text-ink">
              Test environment
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="wf-platform" className="mb-1.5 block text-[12px] text-muted">
                  Platform
                </label>

                <select
                  id="wf-platform"
                  value={testEnvironment.platform}
                  onChange={(e) =>
                    onTestEnvironmentChange({
                      ...testEnvironment,
                      platform: e.target.value,
                    })
                  }
                  className="field"
                >
                  <option value="">Select Platform</option>
                  <option value="Android">Android</option>
                  <option value="iOS">iOS</option>
                  <option value="Web">Web</option>
                  <option value="Desktop">Desktop</option>
                </select>
              </div>

              <div>
                <label htmlFor="wf-os" className="mb-1.5 block text-[12px] text-muted">
                  OS version
                </label>

                <input
                  type="text"
                  id="wf-os"
                  placeholder="Android 15"
                  value={testEnvironment.osVersion}
                  onChange={(e) =>
                    onTestEnvironmentChange({
                      ...testEnvironment,
                      osVersion: e.target.value,
                    })
                  }
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="wf-build" className="mb-1.5 block text-[12px] text-muted">
                  App build
                </label>

                <input
                  type="text"
                  id="wf-build"
                  placeholder="1.4.2 (145)"
                  value={testEnvironment.build}
                  onChange={(e) =>
                    onTestEnvironmentChange({
                      ...testEnvironment,
                      build: e.target.value,
                    })
                  }
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="wf-device" className="mb-1.5 block text-[12px] text-muted">
                  Device
                </label>

                <input
                  type="text"
                  id="wf-device"
                  placeholder="Pixel 8 Pro"
                  value={testEnvironment.device}
                  onChange={(e) =>
                    onTestEnvironmentChange({
                      ...testEnvironment,
                      device: e.target.value,
                    })
                  }
                  className="field"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="wf-observed" className="mb-1.5 block text-[13px] font-medium text-ink">
              Observed steps
              <span className="ml-1 font-normal text-muted">(optional)</span>
            </label>

            <textarea
              value={observedSteps}
              onChange={(event) => onObservedStepsChange(event.target.value)}
              placeholder={"1. Open App\n2. Tap Login\n3. Enter Email"}
              id="wf-observed"
              rows={4}
              className="field resize-none font-mono text-[13px]"
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <div className="flex flex-col-reverse items-stretch justify-end gap-2.5 border-t border-hairline pt-5 sm:flex-row sm:items-center">
            {hasResult && (
              <button
                type="button"
                onClick={onExpand}
                className="btn-secondary"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="btn-primary"
            >
              {isAnalyzing && (
                <Loader2 size={15} className="spin" aria-hidden="true" />
              )}

              {isAnalyzing
                ? "Analyzing workflow…"
                : analysisOutdated
                ? "Re-analyze workflow"
                : "Analyze workflow"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
