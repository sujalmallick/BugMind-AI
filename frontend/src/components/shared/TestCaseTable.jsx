import { ArrowRight } from 'lucide-react'
import StatusPill, { PriorityPill } from './StatusPill'
import AssigneeSelector from '../common/AssigneeSelector'

export default function TestCaseTable({
  testCases,
  projectId,
  onStatusChange,
  onAssigneeChange,
  onJumpToIssue,
 
}) {
  const safeTestCases = Array.isArray(testCases) ? testCases : []

  return (
    <div className="scroll-thin overflow-x-auto rounded-xl border border-hairline bg-white">
      <table className="w-full min-w-225 text-left text-[13px]">
        <thead>
          <tr className="border-b border-hairline bg-paper text-[11px] uppercase tracking-wide text-muted">
    
            <th className="px-3 py-2.5 font-medium">ID</th>
            <th className="px-3 py-2.5 font-medium">Description</th>
            <th className="px-3 py-2.5 font-medium">Module</th>
            <th className="px-3 py-2.5 font-medium">Category</th>
            <th className="px-3 py-2.5 font-medium">Priority</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Assignee</th>
            <th className="px-3 py-2.5 text-center font-medium">
              Issue
            </th>
          </tr>
        </thead>

        <tbody>
          {safeTestCases.map((testCase) => (
            <tr
  key={testCase.id}
  className="group border-b border-hairline last:border-0 hover:bg-[#f4f7ff] transition-colors duration-200"
>

              <td className="px-3 py-3 font-mono text-[12px] text-muted">
                {testCase.id}
              </td>

              <td className="max-w-sm px-3 py-3 text-ink">
                {testCase.description || "-"}
              </td>

              <td className="px-3 py-3 text-muted">
                {testCase.module || "-"}
              </td>

              <td className="px-3 py-3 text-muted">
                {testCase.category || "-"}
              </td>

              <td className="px-3 py-3">
                <PriorityPill
                  priority={testCase.priority}
                />
              </td>

              <td className="px-3 py-3">
                <StatusPill
                  status={testCase.status}
                  onChange={(status) =>
                    onStatusChange(testCase.id, status)
                  }
                />
              </td>

              <td className="px-3 py-3">
                <AssigneeSelector
                  type="test_case"
                  itemId={testCase.id}
                  projectId={projectId}
                  currentAssigneeId={testCase.assignee_id}
                  onAssigneeChange={(userId) => onAssigneeChange?.(testCase.id, userId)}
                />
              </td>

              <td className="px-3 py-3 text-center">
                {["fail", "failed"].includes(
  testCase.status?.toLowerCase()
) ? (
                  <button
                    type="button"
                    onClick={() => onJumpToIssue?.(testCase)}
                    className="inline-flex items-center gap-1 rounded-md border border-signal px-2 py-1 text-[12px] text-signal transition-colors hover:bg-signal hover:text-white"
                  >
                    Issue
                    <ArrowRight size={12} />
                  </button>
                ) : (
                  <span className="text-[12px] text-muted">
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}