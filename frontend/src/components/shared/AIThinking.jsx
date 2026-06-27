import { useEffect, useState } from "react";

const DEFAULT_STEPS = [
  "Understanding workflow",
  "Identifying application modules",
  "Generating exploratory checklist",
  "Creating manual test cases",
  "Analyzing high-risk areas",
];

export default function AIThinking({
  title = "Analyzing Workflow",
  steps = DEFAULT_STEPS,
}) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((previous) =>
        previous === steps.length - 1 ? 0 : previous + 1
      );
    }, 1800);

    return () => clearInterval(interval);
  }, [steps]);

  return (
    <div className="flex h-[420px] items-center justify-center px-6">
      <div className="signal-card w-full max-w-xl rounded-2xl p-8">

        <div className="flex items-center gap-3">
          {/* Pulsing dots instead of spinner — consistent with hero */}
          <div className="flex items-center gap-1.5">
            <span className="workflow-dot h-2 w-2 rounded-full bg-signal" />
            <span className="workflow-dot h-2 w-2 rounded-full bg-signal" />
            <span className="workflow-dot h-2 w-2 rounded-full bg-signal" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink">
              {title}
            </h2>

            <p className="mt-1 text-sm text-muted">
              Please wait while BugMind prepares your testing artifacts.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {steps.map((step, index) => (
            <div
              key={step}
              className="flex items-center gap-3"
            >
              <div
                className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? "bg-signal"
                    : index < currentStep
                    ? "bg-verified"
                    : "bg-border"
                }`}
              />

              <span
                className={`text-sm transition-colors duration-300 ${
                  index <= currentStep
                    ? "text-ink"
                    : "text-muted"
                }`}
              >
                {step}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}