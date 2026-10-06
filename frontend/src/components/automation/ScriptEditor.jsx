import { useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Download, Info, Loader2, Plus, Trash2, Undo2,
} from 'lucide-react'
import Pill from '../shared/Pill'
import SkeletonBlock from '../shared/SkeletonBlock'
import ConfirmDialog from '../shared/ConfirmDialog'
import { apiErrorMessage, deleteScript, exportScript, getScript, updateScript } from '../../services/automationApi'

// Mirrors services/automation_actions.py (the server validates every step).
const ACTIONS = {
  goto: { label: 'Go to', value: 'Path or URL, e.g. /login' },
  click: { label: 'Click', target: true },
  hover: { label: 'Hover', target: true },
  check: { label: 'Check', target: true },
  uncheck: { label: 'Uncheck', target: true },
  fill: { label: 'Fill in', target: true, value: 'Text, or {{vars.NAME}}' },
  select: { label: 'Select option', target: true, value: 'Option' },
  press: { label: 'Press key', target: 'optional', value: 'Key, e.g. Enter' },
  wait: { label: 'Wait', value: 'Milliseconds (100 to 10000)' },
  expect_visible: { label: 'Expect visible', target: true },
  expect_hidden: { label: 'Expect hidden', target: true },
  expect_text: { label: 'Expect text', target: true, value: 'Text', match: true },
  expect_url: { label: 'Expect URL', value: 'URL or path', match: true },
  expect_title: { label: 'Expect page title', value: 'Title', match: true },
  screenshot: { label: 'Screenshot', value: 'Name (optional)', valueOptional: true },
}
const LOCATORS = [
  ['role', 'Role'], ['label', 'Label'], ['text', 'Text'], ['placeholder', 'Placeholder'], ['testid', 'Test id'], ['css', 'CSS'],
]
const STATUS = { draft: { tone: 'neutral', label: 'Draft' }, approved: { tone: 'verified', label: 'Approved' } }

// Keep only the fields the chosen action uses.
function cleanStep(step) {
  const spec = ACTIONS[step.action]
  const out = { action: step.action }
  if (spec.target && step.target?.value?.trim()) {
    out.target = { by: step.target.by || 'text', value: step.target.value.trim() }
    if (out.target.by === 'role' && step.target.name?.trim()) out.target.name = step.target.name.trim()
  }
  if (spec.value && step.value?.trim()) out.value = step.value.trim()
  if (spec.match) out.match = step.match || 'contains'
  if (step.description?.trim()) out.description = step.description.trim()
  return out
}

function StepRow({ step, index, count, onChange, onMove, onRemove }) {
  const spec = ACTIONS[step.action] ?? ACTIONS.click
  const id = (key) => `step-${index}-${key}`
  const setTarget = (patch) => onChange({ ...step, target: { by: 'text', value: '', ...step.target, ...patch } })

  return (
    <li className="rounded-xl border border-hairline bg-surface p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 w-6 shrink-0 text-right font-mono text-[12px] text-muted">{index + 1}</span>
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="grid gap-2 sm:grid-cols-[170px_1fr]">
            <select aria-label={`Step ${index + 1} action`} className="field" value={step.action}
                    onChange={(e) => onChange({ ...step, action: e.target.value })}>
              {Object.entries(ACTIONS).map(([key, a]) => <option key={key} value={key}>{a.label}</option>)}
            </select>
            <input aria-label={`Step ${index + 1} description`} className="field" maxLength={300}
                   placeholder="What this step does" value={step.description || ''}
                   onChange={(e) => onChange({ ...step, description: e.target.value })} />
          </div>
          {spec.target && (
            <div className={`grid gap-2 ${step.target?.by === 'role' ? 'sm:grid-cols-[130px_1fr_1fr]' : 'sm:grid-cols-[130px_1fr]'}`}>
              <select aria-label={`Step ${index + 1} find element by`} className="field" value={step.target?.by || 'text'}
                      onChange={(e) => setTarget({ by: e.target.value })}>
                {LOCATORS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <input aria-label={`Step ${index + 1} element`} className="field" id={id('target')}
                     maxLength={step.target?.by === 'css' ? 300 : 200}
                     placeholder={step.target?.by === 'role' ? 'Role, e.g. button' : spec.target === 'optional' ? 'Element (optional)' : 'Element'}
                     value={step.target?.value || ''} onChange={(e) => setTarget({ value: e.target.value })} />
              {step.target?.by === 'role' && (
                <input aria-label={`Step ${index + 1} accessible name`} className="field" maxLength={200}
                       placeholder="Name, e.g. Sign in" value={step.target?.name || ''}
                       onChange={(e) => setTarget({ name: e.target.value })} />
              )}
            </div>
          )}
          {spec.value && (
            <div className={`grid gap-2 ${spec.match ? 'sm:grid-cols-[1fr_130px]' : ''}`}>
              <input aria-label={`Step ${index + 1} value`} className="field" maxLength={500}
                     placeholder={spec.value} value={step.value || ''}
                     onChange={(e) => onChange({ ...step, value: e.target.value })} />
              {spec.match && (
                <select aria-label={`Step ${index + 1} match`} className="field" value={step.match || 'contains'}
                        onChange={(e) => onChange({ ...step, match: e.target.value })}>
                  <option value="contains">Contains</option>
                  <option value="equals">Equals</option>
                </select>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <button type="button" aria-label={`Move step ${index + 1} up`} disabled={index === 0}
                  className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" onClick={() => onMove(-1)}>
            <ArrowUp size={14} />
          </button>
          <button type="button" aria-label={`Move step ${index + 1} down`} disabled={index === count - 1}
                  className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" onClick={() => onMove(1)}>
            <ArrowDown size={14} />
          </button>
          <button type="button" aria-label={`Remove step ${index + 1}`}
                  className="rounded p-1 text-muted hover:text-flagged" onClick={onRemove}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </li>
  )
}

function NoteList({ icon: Icon, tone, title, items }) {
  if (!items?.length) return null
  return (
    <div className={`text-[12px] ${tone}`}>
      <p className="flex items-center gap-1 font-medium"><Icon size={12} aria-hidden="true" /> {title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  )
}

export default function ScriptEditor({ projectId, scriptId, environments, onBack, onSaved, onDeleted, showToast }) {
  const [script, setScript] = useState(null)
  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  useEffect(() => {
    let cancelled = false
    getScript(projectId, scriptId)
      .then((data) => {
        if (cancelled) return
        setScript(data)
        setForm({ name: data.name, environment_id: data.environmentId, steps: data.steps })
      })
      .catch((error) => { if (!cancelled) showToast(apiErrorMessage(error, 'Could not load the script.'), 'error') })
    return () => { cancelled = true }
  }, [projectId, scriptId, showToast])

  if (!script || !form) {
    return <SkeletonBlock className="h-64 w-full" />
  }

  const update = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true) }
  const setStep = (index, step) => update({ steps: form.steps.map((s, i) => (i === index ? step : s)) })
  const moveStep = (index, delta) => {
    const steps = [...form.steps]
    const [step] = steps.splice(index, 1)
    steps.splice(index + delta, 0, step)
    update({ steps })
  }

  async function save(extra = {}) {
    setSaving(true)
    try {
      const payload = dirty
        ? { name: form.name.trim(), environment_id: form.environment_id, steps: form.steps.map(cleanStep), ...extra }
        : extra
      const saved = await updateScript(projectId, scriptId, payload)
      setScript(saved)
      setForm({ name: saved.name, environment_id: saved.environmentId, steps: saved.steps })
      setDirty(false)
      onSaved(saved)
      showToast(extra.status === 'approved' ? 'Script approved.' : extra.status === 'draft' ? 'Script moved back to draft.' : 'Script saved.')
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not save the script.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    try {
      await deleteScript(projectId, scriptId)
      onDeleted(scriptId)
      showToast('Script deleted.')
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not delete the script.'), 'error')
      setConfirmDelete(false)
    }
  }

  const status = STATUS[script.status] ?? STATUS.draft
  const generation = script.generation

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => (dirty ? setConfirmLeave(true) : onBack())}
              className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted hover:bg-ink/[0.04] hover:text-ink">
        <ArrowLeft size={14} /> All scripts
      </button>

      <div className="glass-card grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="script-name" className="sr-only">Script name</label>
          <input id="script-name" className="field min-w-0 flex-1 text-[14px] font-semibold" maxLength={200}
                 value={form.name} onChange={(e) => update({ name: e.target.value })} />
          <Pill tone={status.tone}>{status.label}</Pill>
          <span className="font-mono text-[11px] text-muted">v{script.version}</span>
        </div>
        <div className="grid gap-1 sm:max-w-sm">
          <label htmlFor="script-env" className="text-[12px] text-muted">Environment</label>
          <select id="script-env" className="field" value={form.environment_id ?? ''}
                  onChange={(e) => update({ environment_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Choose an environment</option>
            {environments.map((env) => <option key={env.id} value={env.id}>{env.name} ({env.baseUrl})</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="glass-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink">Steps</h3>
            <span className="text-[12px] text-muted">{form.steps.length} / 50</span>
          </div>
          {form.steps.length === 0 ? (
            <p className="text-[13px] text-muted">No steps yet. Add the first one below.</p>
          ) : (
            <ol className="grid gap-2">
              {form.steps.map((step, i) => (
                <StepRow key={i} step={step} index={i} count={form.steps.length}
                         onChange={(s) => setStep(i, s)} onMove={(d) => moveStep(i, d)}
                         onRemove={() => update({ steps: form.steps.filter((_, j) => j !== i) })} />
              ))}
            </ol>
          )}
          <button type="button" className="btn-secondary mt-3" disabled={form.steps.length >= 50}
                  onClick={() => update({ steps: [...form.steps, { action: 'click', target: { by: 'role', value: 'button' } }] })}>
            <Plus size={13} /> Add step
          </button>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="glass-card grid gap-3 p-4">
            <h3 className="text-[14px] font-semibold text-ink">Review</h3>
            {dirty && <p className="text-[12px] text-muted">Unsaved changes. Checks update when you save.</p>}
            {script.warnings.length === 0 && !dirty ? (
              <p className="flex items-center gap-1 text-[12px] text-verified">
                <CheckCircle2 size={12} aria-hidden="true" /> No problems found.
              </p>
            ) : (
              <NoteList icon={AlertTriangle} tone="text-ochre" title="Fix before approving" items={script.warnings} />
            )}
            <NoteList icon={AlertTriangle} tone="text-ochre" title="AI hallucination checks" items={generation?.checks} />
            <NoteList icon={Info} tone="text-muted" title="AI notes (guesses to confirm)" items={generation?.notes} />
            <NoteList icon={Info} tone="text-muted" title="Steps the AI wrote that were dropped" items={generation?.dropped} />
          </div>

          {script.testCase && (
            <div className="glass-card grid gap-2 p-4 text-[12px]">
              <h3 className="text-[14px] font-semibold text-ink">
                Test case <span className="font-mono text-[12px] font-normal text-muted">{script.testCase.code}</span>
              </h3>
              <p className="text-ink">{script.testCase.description}</p>
              {script.testCase.preconditions && <p className="text-muted">Preconditions: {script.testCase.preconditions}</p>}
              {script.testCase.steps.length > 0 && (
                <ol className="list-decimal space-y-0.5 pl-5 text-ink">
                  {script.testCase.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              )}
              <p className="text-muted">Expected: <span className="text-ink">{script.testCase.expected_result}</span></p>
            </div>
          )}
        </aside>
      </div>

      <div className="glass-card flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <button type="button" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-flagged-soft hover:text-flagged"
                aria-label="Delete script" title="Delete script" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} />
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {script.status === 'approved' && !dirty && (
            <button type="button" className="btn-secondary" title="Download as a Playwright test file"
                    onClick={() => exportScript(projectId, scriptId).catch((error) =>
                      showToast(apiErrorMessage(error, 'Could not export the script.'), 'error'))}>
              <Download size={14} /> Export test
            </button>
          )}
          <button type="button" className="btn-secondary" disabled={!dirty || saving} onClick={() => save()}>
            Save
          </button>
          {script.status === 'approved' && !dirty ? (
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => save({ status: 'draft' })}>
              <Undo2 size={14} /> Back to draft
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={saving} onClick={() => save({ status: 'approved' })}>
              {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={14} />}
              {dirty ? 'Save and approve' : 'Approve'}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message="Your edits to this script haven't been saved."
        confirmText="Discard"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={onBack}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete script?"
        message={`"${script.name}" will be deleted.`}
        confirmText="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </div>
  )
}
