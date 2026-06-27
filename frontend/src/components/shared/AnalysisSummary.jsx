import {
  Boxes,
  ClipboardCheck,
  FileText,
  TriangleAlert,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

function SummaryCard({ icon, title, value }) {
  return (
    <div className="rounded-xl border border-hairline bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-muted">
          {icon}
        </span>

        <span className="text-3xl font-semibold leading-none text-ink">
          {value}
        </span>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
    </div>
  );
}

export default function AnalysisSummary({
  analysis,
  testCases,
  testEnvironment,
  onContinue,
}) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8">
      <div className="rounded-2xl border border-hairline bg-white p-6 shadow-sm md:p-8">

        <div className="hero-glow rounded-2xl border border-hairline bg-linear-to-r from-white via-sky-50 to-emerald-50 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck size={14} />
                Analysis Complete
              </p>

              <h1 className="mt-3 text-2xl font-semibold text-ink md:text-3xl">
                Your workflow is now execution ready.
              </h1>

              <p className="mt-2 text-sm text-muted">
                Review the generated QA artifacts below and continue into workspace execution.
              </p>
            </div>

            <button
              onClick={onContinue}
              className="btn-primary"
            >
              Open Workspace
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <SummaryCard
            icon={<Boxes size={20} />}
            title="Modules"
            value={analysis.confirmedModules.length}
          />

          <SummaryCard
            icon={<ClipboardCheck size={20} />}
            title="Checklist Items"
            value={analysis.checklist.length}
          />

          <SummaryCard
            icon={<FileText size={20} />}
            title="Test Cases"
            value={testCases.length}
          />

          <SummaryCard
            icon={<TriangleAlert size={20} />}
            title="High Risk Areas"
            value={analysis.highRiskAreas.length}
          />

        </div>
        <div className="mt-6 rounded-xl border border-hairline bg-paper p-5 md:p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Test Environment
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-hairline bg-white p-3">
              <p className="text-xs font-medium text-muted">Platform</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {testEnvironment.platform || "-"}
              </p>
            </div>

            <div className="rounded-lg border border-hairline bg-white p-3">
              <p className="text-xs font-medium text-muted">OS Version</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {testEnvironment.osVersion || "-"}
              </p>
            </div>

            <div className="rounded-lg border border-hairline bg-white p-3">
              <p className="text-xs font-medium text-muted">App Build</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {testEnvironment.build || "-"}
              </p>
            </div>

            <div className="rounded-lg border border-hairline bg-white p-3">
              <p className="text-xs font-medium text-muted">Device</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {testEnvironment.device || "-"}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
