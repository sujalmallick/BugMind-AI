import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bug, Loader2 } from 'lucide-react'
import { apiErrorMessage, createIssueFromResult } from '../../services/automationApi'

// Failed result → bug report (built from the steps, the expected result and the error: nothing invented).
export default function BugReportButton({ projectId, runId, result, showToast }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [issue, setIssue] = useState(result.issueId ? { issueId: result.issueId } : null)

  const openTracker = () => navigate(`/project/${projectId}/workspace`, { state: { tab: 'bug_tracker' } })

  async function create() {
    setBusy(true)
    try {
      const data = await createIssueFromResult(projectId, runId, result.scriptId)
      setIssue(data)
      showToast(data.created ? `Bug report ${data.bugId} created.` : `Already reported as ${data.bugId}.`)
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not create the bug report.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (issue) {
    return (
      <button type="button" className="btn-secondary" onClick={openTracker}>
        <Bug size={13} aria-hidden="true" /> {issue.bugId ? `Bug ${issue.bugId}` : 'Bug reported'} · open Issues Tracker
      </button>
    )
  }
  return (
    <button type="button" className="btn-secondary" disabled={busy} onClick={create}>
      {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Bug size={13} aria-hidden="true" />}
      Create bug report
    </button>
  )
}
