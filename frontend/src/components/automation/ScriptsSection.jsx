import { useEffect, useState } from 'react'
import { AlertTriangle, FileCode2, Loader2, Plus, Sparkles } from 'lucide-react'
import EmptyState from '../shared/EmptyState'
import Pill from '../shared/Pill'
import { apiErrorMessage, createScript, generateScript } from '../../services/automationApi'
import { getTestCases } from '../../services/testCaseApi'

const STATUS = { draft: { tone: 'neutral', label: 'Draft' }, approved: { tone: 'verified', label: 'Approved' } }

function DraftPanel({ projectId, environments, onCreated, onCancel, showToast }) {
  const [testCases, setTestCases] = useState(null)
  const [testCaseId, setTestCaseId] = useState('')
  const [environmentId, setEnvironmentId] = useState(environments[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getTestCases(projectId)
      .then((cases) => {
        if (!cancelled) setTestCases((cases || []).filter((tc) => tc.test_case_id !== 'IMPORT-DEFAULT'))
      })
      .catch((error) => {
        if (cancelled) return
        setTestCases([])
        showToast(apiErrorMessage(error, 'Could not load test cases.'), 'error')
      })
    return () => { cancelled = true }
  }, [projectId, showToast])

  async function draft() {
    setBusy(true)
    try {
      const result = await generateScript(projectId, Number(testCaseId), Number(environmentId))
      if (!result?.success) {
        showToast(result?.error || 'Could not draft a script.', 'error')
        return
      }
      onCreated(result.script)
      showToast('Script drafted. Review every step before approving.')
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not draft a script.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-card grid gap-3 p-4 sm:p-5">
      <h3 className="text-[14px] font-semibold text-ink">Draft a script from a test case</h3>
      <p className="text-[12px] text-muted">
        The AI turns the test case into browser steps. It can't see your website, so element names are guesses:
        review them before approving. Secret values are never sent to the AI.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="draft-case" className="mb-1 block text-[12px] text-muted">Test case</label>
          <select id="draft-case" className="field" value={testCaseId} onChange={(e) => setTestCaseId(e.target.value)}
                  disabled={!testCases}>
            <option value="">{testCases ? 'Choose a test case' : 'Loading…'}</option>
            {(testCases || []).map((tc) => (
              <option key={tc.id} value={tc.id}>{tc.test_case_id} · {tc.description.slice(0, 80)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="draft-env" className="mb-1 block text-[12px] text-muted">Environment</label>
          <select id="draft-env" className="field" value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)}>
            {environments.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" onClick={draft} disabled={busy || !testCaseId || !environmentId}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} />}
          {busy ? 'Drafting…' : 'Draft with AI'}
        </button>
      </div>
    </div>
  )
}

export default function ScriptsSection({ projectId, scripts, environments, onCreated, onOpen, showToast }) {
  const [drafting, setDrafting] = useState(false)
  const [creating, setCreating] = useState(false)

  async function createBlank() {
    setCreating(true)
    try {
      const script = await createScript(projectId, {
        name: 'Untitled script', steps: [], environment_id: environments[0]?.id ?? null,
      })
      onCreated(script)
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not create a script.'), 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-muted">
          End-to-end tests as reviewable browser steps (never code). Only approved scripts can run.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={createBlank} disabled={creating}>
            <Plus size={14} /> Blank script
          </button>
          <button type="button" className="btn-primary" disabled={!environments.length || drafting}
                  title={environments.length ? undefined : 'Add an environment first'}
                  onClick={() => setDrafting(true)}>
            <Sparkles size={14} /> Draft from test case
          </button>
        </div>
      </div>
      {!environments.length && (
        <p className="text-[12px] text-ochre">Add an environment (the website to test) before drafting scripts.</p>
      )}

      {drafting && (
        <DraftPanel projectId={projectId} environments={environments} showToast={showToast}
                    onCancel={() => setDrafting(false)}
                    onCreated={(script) => { setDrafting(false); onCreated(script) }} />
      )}

      {scripts.length === 0 ? (
        <EmptyState
          icon={<FileCode2 size={18} />}
          title="No scripts yet"
          description="Draft one from a test case, or start from a blank script."
        />
      ) : (
        <ul className="grid gap-2">
          {scripts.map((script) => {
            const status = STATUS[script.status] ?? STATUS.draft
            return (
              <li key={script.id}>
                <button type="button" onClick={() => onOpen(script.id)}
                        className="glass-card flex w-full flex-col gap-2 p-4 text-left transition-shadow hover:shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{script.name}</p>
                    <p className="text-[12px] text-muted">
                      {script.stepCount} step{script.stepCount === 1 ? '' : 's'}
                      {script.testCaseCode && ` · ${script.testCaseCode}`}
                      {` · ${script.environmentName ?? 'no environment'}`}
                      {script.origin === 'ai' && ' · AI draft'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {script.warnings.length > 0 && (
                      <Pill tone="ochre" icon={AlertTriangle}>
                        {script.warnings.length} to fix
                      </Pill>
                    )}
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
