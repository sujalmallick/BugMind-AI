import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileCode2, LineChart, Sparkles, XCircle } from 'lucide-react'
import EmptyState from '../shared/EmptyState'
import Pill from '../shared/Pill'
import SkeletonBlock from '../shared/SkeletonBlock'
import PassRateChart from './PassRateChart'
import { apiErrorMessage, getAutomationSummary } from '../../services/automationApi'
import { formatDate, percent } from '../../utils/automationFormat'

const STATUS = {
  passed: { tone: 'verified', label: 'Passed', icon: CheckCircle2 },
  flaky: { tone: 'ochre', label: 'Flaky', icon: AlertTriangle },
  failed: { tone: 'flagged', label: 'Failed', icon: XCircle },
  skipped: { tone: 'neutral', label: 'Skipped' },
}

function StatTile({ label, value, detail, children }) {
  return (
    <div className="glass-card flex flex-col gap-1 p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">{value}</p>
      {detail && <p className="text-[12px] text-muted">{detail}</p>}
      {children}
    </div>
  )
}

// A ratio against its whole: the unfilled track is a lighter step of the same hue.
function Meter({ value, label }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-signal-soft" role="meter" aria-label={label}
         aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full bg-signal" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

function ScriptList({ title, items, verb, onOpenScript, empty }) {
  return (
    <div className="glass-card p-4">
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {items.map((item) => {
            const status = STATUS[item.lastStatus] ?? STATUS.skipped
            return (
              <li key={item.scriptId}>
                <button type="button" onClick={() => onOpenScript(item.scriptId)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink/[0.03]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{item.name}</span>
                    <span className="text-[12px] text-muted tabular-nums">{verb} {item.count} of {item.runs} runs</span>
                  </span>
                  <Pill tone={status.tone} icon={status.icon}>Last: {status.label}</Pill>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function OverviewSection({ projectId, showToast, onOpenScript, onDraftFor, onGoTo }) {
  const [summary, setSummary] = useState(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAutomationSummary(projectId)
      .then((data) => { if (!cancelled) setSummary(data) })
      .catch((error) => { if (!cancelled) showToast(apiErrorMessage(error, 'Could not load the overview.'), 'error') })
    return () => { cancelled = true }
  }, [projectId, showToast])

  if (!summary) {
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-24 w-full" />)}
      </div>
    )
  }

  const { counts, lastRun, trend } = summary
  const coverage = counts.testCases ? counts.automatedTestCases / counts.testCases : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Last run pass rate" value={lastRun ? percent(lastRun.passRate) : '—'}
                  detail={lastRun ? `Run #${lastRun.id}${lastRun.at ? ` · ${formatDate(lastRun.at)}` : ''}` : 'No runs yet'} />
        <StatTile label="Runs in the last 30 days" value={counts.runs30d} />
        <StatTile label="Approved scripts" value={counts.approved}
                  detail={`of ${counts.scripts} script${counts.scripts === 1 ? '' : 's'}`} />
        <StatTile label="Test cases automated" value={`${Math.round(coverage * 100)}%`}
                  detail={`${counts.automatedTestCases} of ${counts.testCases} have an approved script`}>
          <Meter value={coverage} label="Share of test cases with an approved script" />
        </StatTile>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-ink">Pass rate per run</h3>
          {trend.length > 0 && (
            <button type="button" className="text-[12px] font-medium text-signal hover:underline"
                    onClick={() => setShowTable((v) => !v)}>
              {showTable ? 'Show chart' : 'Show as table'}
            </button>
          )}
        </div>
        {trend.length === 0 ? (
          <EmptyState icon={<LineChart size={18} />} title="No runs yet"
                      description="Download the tests, run them, and upload the results to see the trend."
                      action={<button type="button" className="btn-secondary" onClick={() => onGoTo('runs')}>Go to Runs</button>} />
        ) : showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wide text-muted">
                <tr><th className="py-1.5 font-medium">Run</th><th className="font-medium">Date</th>
                  <th className="text-right font-medium">Passed</th><th className="text-right font-medium">Failed</th>
                  <th className="text-right font-medium">Flaky</th><th className="text-right font-medium">Pass rate</th></tr>
              </thead>
              <tbody className="tabular-nums">
                {[...trend].reverse().map((t) => (
                  <tr key={t.runId} className="border-t border-hairline">
                    <td className="py-1.5 text-ink">#{t.runId}</td><td className="text-muted">{formatDate(t.at)}</td>
                    <td className="text-right">{t.passed}</td><td className="text-right">{t.failed}</td>
                    <td className="text-right">{t.flaky}</td><td className="text-right text-ink">{percent(t.passRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <PassRateChart trend={trend} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScriptList title="Failing most often" items={summary.failing} verb="Failed" onOpenScript={onOpenScript}
                    empty="No failures in the last 20 runs." />
        <ScriptList title="Flaky" items={summary.flaky} verb="Flaky in" onOpenScript={onOpenScript}
                    empty="No flaky results in the last 20 runs." />
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-ink">Not automated yet</h3>
          <span className="text-[12px] text-muted tabular-nums">{summary.notAutomatedCount} test case{summary.notAutomatedCount === 1 ? '' : 's'}</span>
        </div>
        {summary.notAutomated.length === 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-verified">
            <FileCode2 size={13} aria-hidden="true" /> Every test case has a script.
          </p>
        ) : (
          <ul className="mt-2 grid gap-1">
            {summary.notAutomated.map((tc) => (
              <li key={tc.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-[11.5px] text-muted">{tc.code}</span>{' '}
                  <span className="text-[13px] text-ink">{tc.description}</span>
                </span>
                {tc.priority && <Pill tone={tc.priority === 'High' ? 'flagged' : 'neutral'}>{tc.priority}</Pill>}
                <button type="button" className="btn-secondary shrink-0" onClick={() => onDraftFor(tc.id)}>
                  <Sparkles size={13} aria-hidden="true" /> Draft script
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
