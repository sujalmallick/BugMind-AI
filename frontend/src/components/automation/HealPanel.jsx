import { useState } from 'react'
import { AlertTriangle, ArrowRight, Bug, Loader2, Wand2 } from 'lucide-react'
import { apiErrorMessage, healScript, updateScript } from '../../services/automationApi'

function describeTarget(target) {
  if (!target) return ''
  if (target.by === 'role') return target.name ? `${target.value} "${target.name}"` : target.value
  return `${target.by} "${target.value}"`
}

const VERDICT = {
  locator: { icon: Wand2, tone: 'text-signal', title: 'The test looked for the wrong element' },
  real_bug: { icon: Bug, tone: 'text-flagged', title: 'This looks like a real bug in the app' },
  unclear: { icon: AlertTriangle, tone: 'text-ochre', title: 'No safe fix found' },
}

// Self-healing for one failed result: ask for a fix, show the diff, apply it on request.
export default function HealPanel({ projectId, runId, result, onApplied, showToast }) {
  const [busy, setBusy] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [applied, setApplied] = useState(false)

  if (!result.page) {
    return (
      <p className="mt-2 text-[12px] text-muted">
        No page snapshot with this failure. Download the tests again: newer exports capture one, so BugMind can
        suggest a fix.
      </p>
    )
  }

  async function suggest() {
    setBusy(true)
    try {
      const data = await healScript(projectId, result.scriptId, runId)
      if (!data?.success) {
        showToast(data?.error || 'Could not suggest a fix.', 'error')
        return
      }
      setSuggestion(data)
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not suggest a fix.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    setBusy(true)
    try {
      await updateScript(projectId, result.scriptId, { steps: suggestion.steps })
      setApplied(true)
      showToast('Fix applied. The script is back in draft: review and approve it, then download the tests again.')
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not apply the fix.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!suggestion) {
    return (
      <button type="button" className="btn-secondary mt-3" disabled={busy} onClick={suggest}>
        {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Wand2 size={13} aria-hidden="true" />}
        {busy ? 'Reading the page…' : 'Suggest a fix'}
      </button>
    )
  }

  const verdict = VERDICT[suggestion.verdict] ?? VERDICT.unclear
  const Icon = verdict.icon
  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-hairline bg-surface p-3 text-[12.5px]">
      <p className={`flex items-center gap-1.5 font-medium ${verdict.tone}`}>
        <Icon size={14} aria-hidden="true" /> {verdict.title}
      </p>
      {suggestion.summary && <p className="text-muted">{suggestion.summary}</p>}

      {suggestion.changes.length > 0 && (
        <ul className="grid gap-1.5">
          {suggestion.changes.map((change) => (
            <li key={change.step} className="rounded-lg border border-hairline bg-paper/50 px-2.5 py-2">
              <p className="flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
                <span className="text-muted">Step {change.step}:</span>
                <span className="text-flagged line-through">{describeTarget(change.before)}</span>
                <ArrowRight size={12} aria-hidden="true" className="text-muted" />
                <span className="text-verified">{describeTarget(change.after)}</span>
              </p>
              {change.reason && <p className="mt-0.5 text-[12px] text-muted">{change.reason}</p>}
            </li>
          ))}
        </ul>
      )}
      {suggestion.rejected.length > 0 && (
        <details className="text-[12px] text-muted">
          <summary className="cursor-pointer">
            {suggestion.rejected.length} suggestion{suggestion.rejected.length > 1 ? 's' : ''} ignored (not found on the page)
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {suggestion.rejected.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </details>
      )}

      {suggestion.changes.length > 0 && (
        applied ? (
          <button type="button" className="btn-secondary w-fit" onClick={() => onApplied?.(result.scriptId)}>
            Open the script to approve it
          </button>
        ) : (
          <button type="button" className="btn-primary w-fit" disabled={busy} onClick={apply}>
            {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
            Apply to script
          </button>
        )
      )}
    </div>
  )
}
