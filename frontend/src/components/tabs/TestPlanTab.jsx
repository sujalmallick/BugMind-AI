import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, ClipboardList, Loader2, Pencil, RotateCcw, Sparkles, Trash2, Undo2,
} from 'lucide-react'
import EmptyState from '../shared/EmptyState'
import Pill from '../shared/Pill'
import SkeletonBlock from '../shared/SkeletonBlock'
import ConfirmDialog from '../shared/ConfirmDialog'
import KnowledgeSourcesNote from '../shared/KnowledgeSourcesNote'
import {
  createTestPlan,
  deleteTestPlan,
  generatePhaseTestCases,
  listTestPlans,
  updateTestPlanPhase,
} from '../../services/testPlanApi'

const STATUS = {
  proposed: { tone: 'neutral', label: 'Proposed' },
  approved: { tone: 'signal', label: 'Approved' },
  skipped: { tone: 'neutral', label: 'Skipped' },
  generating: { tone: 'signal', label: 'Generating' },
  generated: { tone: 'verified', label: 'Test cases ready' },
}
const PRIORITY_TONE = { High: 'flagged', Medium: 'ochre', Low: 'neutral' }

function errorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  return error?.response?.data?.error || fallback
}

function splitList(text) {
  return text.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8)
}

function PhaseEditor({ phase, saving, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: phase.title,
    objective: phase.objective,
    scope: phase.scope,
    entry_criteria: phase.entryCriteria,
    exit_criteria: phase.exitCriteria,
    priority: phase.priority,
    modules: phase.modules.join(', '),
    risks: phase.risks.join(', '),
  })
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const id = (key) => `phase-${phase.id}-${key}`

  return (
    <form
      className="mt-3 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, modules: splitList(form.modules), risks: splitList(form.risks) })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <label htmlFor={id('title')} className="mb-1 block text-[12px] text-muted">Title</label>
          <input id={id('title')} className="field" value={form.title} onChange={set('title')} maxLength={200} required />
        </div>
        <div>
          <label htmlFor={id('priority')} className="mb-1 block text-[12px] text-muted">Priority</label>
          <select id={id('priority')} className="field" value={form.priority} onChange={set('priority')}>
            <option>High</option><option>Medium</option><option>Low</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={id('objective')} className="mb-1 block text-[12px] text-muted">Objective</label>
        <input id={id('objective')} className="field" value={form.objective} onChange={set('objective')} maxLength={1500} />
      </div>
      <div>
        <label htmlFor={id('scope')} className="mb-1 block text-[12px] text-muted">What this phase tests (used to generate its test cases)</label>
        <textarea id={id('scope')} className="field resize-y" rows={3} value={form.scope} onChange={set('scope')} maxLength={3000} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={id('modules')} className="mb-1 block text-[12px] text-muted">Modules (comma separated)</label>
          <input id={id('modules')} className="field" value={form.modules} onChange={set('modules')} />
        </div>
        <div>
          <label htmlFor={id('risks')} className="mb-1 block text-[12px] text-muted">Risks (comma separated)</label>
          <input id={id('risks')} className="field" value={form.risks} onChange={set('risks')} />
        </div>
        <div>
          <label htmlFor={id('entry')} className="mb-1 block text-[12px] text-muted">Entry criteria</label>
          <input id={id('entry')} className="field" value={form.entry_criteria} onChange={set('entry_criteria')} maxLength={1500} />
        </div>
        <div>
          <label htmlFor={id('exit')} className="mb-1 block text-[12px] text-muted">Exit criteria</label>
          <input id={id('exit')} className="field" value={form.exit_criteria} onChange={set('exit_criteria')} maxLength={1500} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          Save phase
        </button>
      </div>
    </form>
  )
}

function PhaseCard({ phase, busy, generating, onUpdate, onGenerate, onViewCases }) {
  const [editing, setEditing] = useState(false)
  const status = STATUS[phase.status] ?? STATUS.proposed
  const grounding = phase.grounding
  const isGenerating = generating || phase.status === 'generating'
  const skipped = phase.status === 'skipped'

  return (
    <li className={`glass-card p-4 sm:p-5 ${skipped ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-[12px] font-semibold text-signal">
          {phase.ordinal}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-ink">{phase.title}</h3>
          {phase.objective && <p className="mt-0.5 text-[13px] text-muted">{phase.objective}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={PRIORITY_TONE[phase.priority] ?? 'neutral'}>{phase.priority}</Pill>
          {grounding?.status === 'grounded' && <Pill tone="verified" icon={CheckCircle2}>Grounded</Pill>}
          {grounding?.status === 'assumed' && <Pill tone="ochre" icon={AlertTriangle}>Check this</Pill>}
          <Pill tone={status.tone}>
            {isGenerating && <Loader2 size={11} className="animate-spin" aria-hidden="true" />}
            {isGenerating ? 'Generating' : status.label}
          </Pill>
        </div>
      </div>

      {editing ? (
        <PhaseEditor
          phase={phase}
          saving={busy}
          onCancel={() => setEditing(false)}
          onSave={async (patch) => { if (await onUpdate(patch)) setEditing(false) }}
        />
      ) : (
        <>
          <p className="mt-3 whitespace-pre-wrap rounded-lg border border-hairline bg-paper/60 px-3 py-2 text-[13px] leading-relaxed text-ink">
            {phase.scope}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2">
            {phase.modules.length > 0 && (
              <div><dt className="text-muted">Modules</dt><dd className="text-ink">{phase.modules.join(', ')}</dd></div>
            )}
            {phase.risks.length > 0 && (
              <div><dt className="text-muted">Risks</dt><dd className="text-ink">{phase.risks.join(', ')}</dd></div>
            )}
            {phase.entryCriteria && (
              <div><dt className="text-muted">Entry criteria</dt><dd className="text-ink">{phase.entryCriteria}</dd></div>
            )}
            {phase.exitCriteria && (
              <div><dt className="text-muted">Exit criteria</dt><dd className="text-ink">{phase.exitCriteria}</dd></div>
            )}
          </dl>
          {grounding?.status === 'assumed' && grounding.notes?.length > 0 && (
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[12px] text-ochre">
              {grounding.notes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          )}
          {phase.generation && (
            <p className="mt-3 text-[12px] text-muted">
              {phase.testCaseCount} test case{phase.testCaseCount === 1 ? '' : 's'}
              {typeof phase.generation.coverage === 'number' && ` · coverage ${Math.round(phase.generation.coverage * 100)}%`}
              {phase.generation.assumed > 0 && ` · ${phase.generation.assumed} to double-check`}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
            {phase.status === 'proposed' && (
              <>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => onUpdate({ status: 'approved' })}>
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => onUpdate({ status: 'skipped' })}>
                  Skip
                </button>
              </>
            )}
            {phase.status === 'approved' && !isGenerating && (
              <>
                <button type="button" className="btn-primary" onClick={onGenerate}>
                  <Sparkles size={14} /> Generate test cases
                </button>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => onUpdate({ status: 'proposed' })}>
                  <Undo2 size={14} /> Unapprove
                </button>
              </>
            )}
            {phase.status === 'skipped' && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => onUpdate({ status: 'proposed' })}>
                <RotateCcw size={14} /> Restore
              </button>
            )}
            {phase.status === 'generated' && !isGenerating && (
              <>
                <button type="button" className="btn-secondary" onClick={onViewCases}>
                  <ClipboardList size={14} /> View test cases
                </button>
                <button type="button" className="btn-secondary" onClick={onGenerate}>
                  <Sparkles size={14} /> Generate more
                </button>
              </>
            )}
            {isGenerating && (
              <span className="flex items-center gap-1.5 text-[12px] text-muted">
                <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Writing test cases for this phase…
              </span>
            )}
            {!skipped && !isGenerating && (
              <button type="button" className="btn-secondary ml-auto" disabled={busy} onClick={() => setEditing(true)}>
                <Pencil size={13} /> Edit
              </button>
            )}
          </div>
        </>
      )}
    </li>
  )
}

export default function TestPlanTab({ projectId, workflow, showToast, onCasesGenerated, onViewTestCases }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [scope, setScope] = useState(workflow || '')
  const [creating, setCreating] = useState(false)
  const [busyPhase, setBusyPhase] = useState(null)
  const [generatingIds, setGeneratingIds] = useState([])
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Responses for a project this tab no longer shows are ignored.
  const projectRef = useRef(projectId)
  useEffect(() => {
    projectRef.current = projectId
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    listTestPlans(projectId)
      .then((data) => { if (!cancelled) setPlans(data) })
      .catch((error) => { if (!cancelled) showToast(errorMessage(error, 'Could not load test plans.'), 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId, showToast])

  const plan = plans.find((p) => p.id === selectedId) ?? plans[0] ?? null

  function replacePhase(updated) {
    setPlans((prev) => prev.map((p) => (p.id !== updated.planId ? p : {
      ...p, phases: p.phases.map((ph) => (ph.id === updated.id ? updated : ph)),
    })))
  }

  async function handleCreate() {
    if (scope.trim().length < 5) {
      showToast('Describe the feature or workflow to plan for.', 'error')
      return
    }
    const requestedFor = projectId
    setCreating(true)
    try {
      const result = await createTestPlan(projectId, scope.trim())
      if (projectRef.current !== requestedFor) return
      if (!result?.success) {
        showToast(result?.error || 'Could not create a test plan.', 'error')
        return
      }
      setPlans((prev) => [result.plan, ...prev])
      setSelectedId(result.plan.id)
      showToast(`Test plan ready: ${result.plan.phases.length} phases to review.`)
    } catch (error) {
      if (projectRef.current === requestedFor) showToast(errorMessage(error, 'Could not create a test plan.'), 'error')
    } finally {
      if (projectRef.current === requestedFor) setCreating(false)
    }
  }

  async function handleUpdate(phase, patch) {
    setBusyPhase(phase.id)
    try {
      replacePhase(await updateTestPlanPhase(projectId, phase.planId, phase.id, patch))
      return true
    } catch (error) {
      showToast(errorMessage(error, 'Could not update the phase.'), 'error')
      return false
    } finally {
      setBusyPhase(null)
    }
  }

  async function handleApproveAll() {
    for (const phase of plan.phases.filter((p) => p.status === 'proposed')) {
      if (!(await handleUpdate(phase, { status: 'approved' }))) break
    }
  }

  async function handleGenerate(phase) {
    const requestedFor = projectId
    setGeneratingIds((ids) => [...ids, phase.id])
    try {
      const result = await generatePhaseTestCases(projectId, phase.planId, phase.id)
      if (projectRef.current !== requestedFor) return
      if (!result?.success) {
        showToast(result?.error || 'Could not generate test cases.', 'error')
        return
      }
      replacePhase(result.phase)
      onCasesGenerated(result.testCases)
      const n = result.testCases.length
      showToast(n ? `${n} test case${n > 1 ? 's' : ''} added to Test Cases.` : 'No new test cases: everything was already covered.')
    } catch (error) {
      if (projectRef.current === requestedFor) showToast(errorMessage(error, 'Could not generate test cases.'), 'error')
    } finally {
      setGeneratingIds((ids) => ids.filter((id) => id !== phase.id))
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteTestPlan(projectId, pendingDelete.id)
      setPlans((prev) => prev.filter((p) => p.id !== pendingDelete.id))
      setSelectedId(null)
      showToast('Test plan deleted. Its test cases were kept.')
    } catch (error) {
      showToast(errorMessage(error, 'Could not delete the test plan.'), 'error')
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  const counts = plan ? {
    approved: plan.phases.filter((p) => ['approved', 'generating', 'generated'].includes(p.status)).length,
    generated: plan.phases.filter((p) => p.status === 'generated').length,
    proposed: plan.phases.filter((p) => p.status === 'proposed').length,
    cases: plan.phases.reduce((sum, p) => sum + (p.testCaseCount || 0), 0),
  } : null

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="glass-card p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold text-ink">AI test plan</h2>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
          Split a feature into test phases. Review and approve each phase, then generate its test cases.
          Nothing is generated until you approve.
        </p>
        <label htmlFor="plan-scope" className="mb-1.5 mt-4 block text-[13px] font-medium text-ink">
          Feature or workflow to plan for
        </label>
        <textarea
          id="plan-scope"
          className="field resize-y"
          rows={4}
          maxLength={20000}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="E.g., Shopper adds items to the cart → applies a coupon → pays by card (OTP above 10,000 INR) → sees the order confirmation"
        />
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {workflow && workflow !== scope && (
            <button type="button" className="btn-secondary" onClick={() => setScope(workflow)}>
              Use the current workflow
            </button>
          )}
          <button type="button" className="btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
            {creating ? 'Planning…' : 'Create test plan'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => <SkeletonBlock key={i} className="h-32 w-full" />)}
        </div>
      ) : !plan ? (
        <EmptyState
          icon={<ClipboardList size={18} />}
          title="No test plan yet"
          description="Create one above. Uploaded documents marked “Use in AI” are used as extra context."
        />
      ) : (
        <>
          <div className="glass-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {plans.length > 1 ? (
                  <>
                    <label htmlFor="plan-select" className="sr-only">Test plan</label>
                    <select
                      id="plan-select"
                      className="field max-w-full text-[14px] font-semibold"
                      value={plan.id}
                      onChange={(e) => setSelectedId(Number(e.target.value))}
                    >
                      {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </>
                ) : (
                  <h2 className="text-[15px] font-semibold text-ink">{plan.title}</h2>
                )}
                {plan.summary && <p className="mt-1 text-[13px] leading-relaxed text-muted">{plan.summary}</p>}
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-flagged-soft hover:text-flagged"
                onClick={() => setPendingDelete(plan)}
                aria-label="Delete test plan"
                title="Delete test plan"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted">
              <span>{plan.phases.length} phases</span>
              <span>{counts.approved} approved</span>
              <span>{counts.generated} with test cases</span>
              <span>{counts.cases} test cases</span>
              {counts.proposed > 0 && (
                <button type="button" className="btn-secondary ml-auto" onClick={handleApproveAll} disabled={busyPhase !== null}>
                  <CheckCircle2 size={14} /> Approve all {counts.proposed}
                </button>
              )}
            </div>

            <KnowledgeSourcesNote sources={plan.knowledgeSources} className="mt-3" />
            {plan.gaps.length > 0 && (
              <div className="mt-3 text-[12px] text-muted">
                <p className="text-ink">Not covered by your description (worth clarifying):</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {plan.gaps.map((gap, i) => <li key={i}>{gap}</li>)}
                </ul>
              </div>
            )}
          </div>

          <ol className="flex flex-col gap-3">
            {plan.phases.map((phase) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                busy={busyPhase === phase.id}
                generating={generatingIds.includes(phase.id)}
                onUpdate={(patch) => handleUpdate(phase, patch)}
                onGenerate={() => handleGenerate(phase)}
                onViewCases={onViewTestCases}
              />
            ))}
          </ol>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete test plan?"
        message={pendingDelete ? `"${pendingDelete.title}" and its phases will be deleted. Test cases it generated are kept.` : ''}
        confirmText="Delete"
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
