import { Download, Table2, Plus } from "lucide-react";
import { useState } from "react";
import EmptyState from '../shared/EmptyState'
import TestCaseTable from '../shared/TestCaseTable'
import CreateTestCaseModal from '../workspace/CreateTestCaseModal'
import { exportTestCasesCSV } from "../../lib/exportCSV";


export default function TestCasesTab({
  testCases,
  projectId,
  isLoading,
  onStatusChange,
  onAssigneeChange,
  onJumpToIssue,
  showToast,
  onManualCreate,
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const total = testCases?.length || 0;


  if (!testCases || testCases.length === 0) {
    return (
      <div className="base-card p-5 md:p-6">
        <EmptyState
          icon={<Table2 size={22} />}
          title="No test cases yet"
          description="Analyze a workflow above to generate execution-ready test cases, or create one manually."
          action={
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              <Plus size={16} />
              Create Test Case
            </button>
          }
        />
        {showCreateModal && (
          <CreateTestCaseModal
            projectId={projectId}
            onClose={() => setShowCreateModal(false)}
            onSuccess={(newTc) => onManualCreate?.(newTc)}
          />
        )}
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

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <Plus size={14} />
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              exportTestCasesCSV(testCases, "BugMind_TestCases");
            }}
            className="btn-secondary"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {showCreateModal && (
        <CreateTestCaseModal
          projectId={projectId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newTc) => onManualCreate?.(newTc)}
        />
      )}

      <TestCaseTable
        testCases={testCases}
        projectId={projectId}
        onStatusChange={onStatusChange}
        onAssigneeChange={onAssigneeChange}
        onJumpToIssue={onJumpToIssue}
      />
    </div>
  )
}
