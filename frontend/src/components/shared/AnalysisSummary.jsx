import {
  Boxes,
  ClipboardCheck,
  FileText,
  TriangleAlert,
  ArrowRight,
} from "lucide-react";

function SummaryCard({ icon, title, value }) {
  return (
    <div className="rounded-xl border border-hairline bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-muted">
          {icon}
        </span>

        <span className="text-3xl font-semibold text-ink">
          {value}
        </span>
      </div>

      <p className="text-sm font-medium text-muted">
        {title}
      </p>
    </div>
  );
}

export default function AnalysisSummary({
  analysis,
  testCases,
  onContinue,
}) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="rounded-2xl border border-hairline bg-white p-8 shadow-sm">

        {/* Heading */}

        <div className="mb-8 border-b border-hairline pb-6">
          <h1 className="text-3xl font-semibold text-ink">
            Analysis Complete
          </h1>

          <p className="mt-2 text-sm text-muted">
            Your workflow has been analyzed successfully. 
          </p>
        </div>

        {/* Metrics */}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">

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

        {/* Footer */}

        <div className="mt-8 flex items-center justify-between border-t border-hairline pt-6">

          <p className="text-sm text-muted">
            Everything is ready for execution.
          </p>

          <button
            onClick={onContinue}
            className="flex items-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Open Workspace
            <ArrowRight size={16} />
          </button>

        </div>

      </div>
    </div>
  );
}