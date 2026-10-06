import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, History, Loader2, Upload, XCircle } from 'lucide-react'
import EmptyState from '../shared/EmptyState'
import Pill from '../shared/Pill'
import SkeletonBlock from '../shared/SkeletonBlock'
import { apiErrorMessage, exportProject, getRun, importResults, listRuns } from '../../services/automationApi'

const MAX_REPORT_BYTES = 4 * 1024 * 1024
const RESULT = {
  passed: { tone: 'verified', label: 'Passed' },
  flaky: { tone: 'ochre', label: 'Flaky' },
  failed: { tone: 'flagged', label: 'Failed' },
  skipped: { tone: 'neutral', label: 'Skipped' },
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleString()
}

function Totals({ totals }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {['passed', 'failed', 'flaky', 'skipped'].map((key) => (
        totals?.[key] > 0 && <Pill key={key} tone={RESULT[key].tone}>{totals[key]} {RESULT[key].label.toLowerCase()}</Pill>
      ))}
    </span>
  )
}

function RunDetail({ projectId, runId, onBack, showToast }) {
  const [run, setRun] = useState(null)

  useEffect(() => {
    let cancelled = false
    getRun(projectId, runId)
      .then((data) => { if (!cancelled) setRun(data) })
      .catch((error) => { if (!cancelled) showToast(apiErrorMessage(error, 'Could not load the run.'), 'error') })
    return () => { cancelled = true }
  }, [projectId, runId, showToast])

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack}
              className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted hover:bg-ink/[0.04] hover:text-ink">
        <ArrowLeft size={14} /> All runs
      </button>
      {!run ? <SkeletonBlock className="h-40 w-full" /> : (
        <>
          <div className="glass-card flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <p className="text-[14px] font-semibold text-ink">Run #{run.id}</p>
              <p className="text-[12px] text-muted">{formatDate(run.startedAt || run.createdAt)}</p>
            </div>
            <Totals totals={run.totals} />
          </div>
          {run.totals?.unknown > 0 && (
            <p className="text-[12px] text-muted">
              {run.totals.unknown} test{run.totals.unknown > 1 ? 's' : ''} in the file didn't match a script in this project and were ignored.
            </p>
          )}
          <ul className="grid gap-2">
            {run.results.map((result) => {
              const status = RESULT[result.status] ?? RESULT.skipped
              const outdated = result.exportedVersion !== result.currentVersion
              return (
                <li key={result.scriptId} className="glass-card p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink">{result.scriptName}</p>
                      <p className="text-[12px] text-muted">
                        {result.testCaseCode ? `${result.testCaseCode} · ` : ''}
                        {(result.durationMs / 1000).toFixed(1)}s
                        {result.applied && ' · test case updated'}
                        {outdated && ` · script changed since export (v${result.exportedVersion} → v${result.currentVersion}), test case not updated`}
                      </p>
                    </div>
                    <Pill tone={status.tone} icon={result.status === 'failed' ? XCircle : CheckCircle2}>{status.label}</Pill>
                  </div>
                  {result.error && (
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-hairline bg-paper/60 p-2 font-mono text-[11.5px] text-flagged">
                      {result.error}
                    </pre>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

export default function RunsSection({ projectId, environments, showToast, onImported }) {
  const [runs, setRuns] = useState(null)
  const [openRunId, setOpenRunId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [envId, setEnvId] = useState(environments[0]?.id ?? '')
  const [downloading, setDownloading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    listRuns(projectId)
      .then((data) => { if (!cancelled) setRuns(data) })
      .catch((error) => {
        if (cancelled) return
        setRuns([])
        showToast(apiErrorMessage(error, 'Could not load runs.'), 'error')
      })
    return () => { cancelled = true }
  }, [projectId, showToast])

  async function upload(file) {
    if (!file) return
    if (file.size > MAX_REPORT_BYTES) {
      showToast('The results file is larger than 4 MB.', 'error')
      return
    }
    setUploading(true)
    try {
      const run = await importResults(projectId, file)
      setRuns((prev) => [run, ...(prev || [])])
      setOpenRunId(run.id)
      const applied = run.results.filter((r) => r.applied).length
      showToast(`Run #${run.id} recorded. ${applied} test case${applied === 1 ? '' : 's'} updated.`)
      onImported?.()
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not read the results file.'), 'error')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function downloadProject() {
    setDownloading(true)
    try {
      await exportProject(projectId, envId)
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not export the tests.'), 'error')
    } finally {
      setDownloading(false)
    }
  }

  if (openRunId) {
    return <RunDetail projectId={projectId} runId={openRunId} onBack={() => setOpenRunId(null)} showToast={showToast} />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card grid gap-4 p-4 sm:p-5">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Run your tests for free</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Tests run on your computer or on GitHub Actions in your own repository. BugMind never needs access to your
            website, and secrets stay with you.
          </p>
        </div>
        <ol className="grid gap-3 text-[12.5px] sm:grid-cols-3">
          <li className="rounded-xl border border-hairline bg-paper/50 p-3">
            <p className="font-medium text-ink">1. Download the tests</p>
            <p className="mt-0.5 text-muted">A ready-to-run Playwright project with every approved script.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {environments.length > 1 && (
                <select aria-label="Environment to export" className="field py-1 text-[12px]" value={envId}
                        onChange={(e) => setEnvId(Number(e.target.value))}>
                  {environments.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
                </select>
              )}
              <button type="button" className="btn-secondary" disabled={!envId || downloading} onClick={downloadProject}>
                {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download (ZIP)
              </button>
            </div>
          </li>
          <li className="rounded-xl border border-hairline bg-paper/50 p-3">
            <p className="font-medium text-ink">2. Run them</p>
            <p className="mt-0.5 text-muted">
              <code className="font-mono">npx playwright test</code> on your computer, or the included GitHub workflow.
              The README in the ZIP explains both.
            </p>
          </li>
          <li className="rounded-xl border border-hairline bg-paper/50 p-3">
            <p className="font-medium text-ink">3. Upload the results</p>
            <p className="mt-0.5 text-muted">Choose <code className="font-mono">bugmind-results.json</code>. Linked test cases update and assignees are notified.</p>
            <button type="button" className="btn-primary mt-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? 'Uploading…' : 'Upload results'}
            </button>
            <input ref={inputRef} type="file" accept=".json,application/json" className="hidden"
                   onChange={(e) => upload(e.target.files?.[0])} />
          </li>
        </ol>
      </div>

      {runs === null ? (
        <SkeletonBlock className="h-24 w-full" />
      ) : runs.length === 0 ? (
        <EmptyState icon={<History size={18} />} title="No runs yet"
                    description="Upload a results file to see pass/fail history here." />
      ) : (
        <ul className="grid gap-2">
          {runs.map((run) => (
            <li key={run.id}>
              <button type="button" onClick={() => setOpenRunId(run.id)}
                      className="glass-card flex w-full flex-col gap-2 p-4 text-left transition-shadow hover:shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink">Run #{run.id}</p>
                  <p className="text-[12px] text-muted">{formatDate(run.startedAt || run.createdAt)}</p>
                </div>
                <Totals totals={run.totals} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
