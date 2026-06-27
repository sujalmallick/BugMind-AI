import { Download, Table2 } from "lucide-react";
import EmptyState from '../shared/EmptyState'
import TestCaseTable from '../shared/TestCaseTable'
import { exportTestCasesCSV } from "../../lib/exportCSV";


export default function TestCasesTab({
  testCases,
  isLoading,
  onStatusChange,
  onJumpToIssue,
  showToast,
}) {

  const total = testCases?.length || 0;


  if (!testCases || testCases.length === 0) {
    return (
      <div className="base-card p-5 md:p-6">
        <EmptyState
          icon={<Table2 size={22} />}
          title="No test cases yet"
          description="Analyze a workflow above to generate execution-ready test cases."
        />
      </div>
    )
  }

  return (
    <div className="base-card p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">Test Cases</h3>
          <p className="mt-1 text-xs text-muted">
            {total} generated cases. Click a status pill to cycle pending → pass → fail.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            exportTestCasesCSV(testCases, "BugMind_TestCases");
          }}
          className="btn-secondary"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <TestCaseTable
        testCases={testCases}
        onStatusChange={onStatusChange}
        onJumpToIssue={onJumpToIssue}
      />
    </div>
  )
}
