import { useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { readFlag, writeFlag } from '../../utils/automationOnboarding'

// First-time checklist for the automation loop. Every step is checked off from real data
// (environments, scripts, runs), except "downloaded", which only this browser can know.
export default function GettingStarted({ projectId, environments, scripts, hasRuns, downloaded, onGoTo }) {
  const hiddenKey = `bugmind.automation.checklistHidden.${projectId}`
  const [hidden, setHidden] = useState(() => readFlag(hiddenKey))

  const steps = [
    { title: 'Add the website to test', detail: 'An environment: its URL, the domains tests may visit, and test data such as a login.',
      done: environments.length > 0, section: 'environments', action: 'Add environment' },
    { title: 'Create a script', detail: 'Draft one from a test case with AI, or start from a blank script.',
      done: scripts.length > 0, section: 'scripts', action: 'Go to scripts' },
    { title: 'Review and approve it', detail: 'Check every step. Only approved scripts can be downloaded and run.',
      done: scripts.some((s) => s.status === 'approved'), section: 'scripts', action: 'Review scripts' },
    { title: 'Download the tests', detail: 'A ready-to-run Playwright project (ZIP) with every approved script.',
      done: downloaded || hasRuns, section: 'runs', action: 'Download' },
    { title: 'Run them', detail: 'On your computer (npx playwright test) or free on GitHub Actions. The README in the ZIP explains both.',
      done: hasRuns, section: 'runs', action: 'How to run' },
    { title: 'Upload the results', detail: 'Choose bugmind-results.json: test cases update, and failures get fix suggestions.',
      done: hasRuns, section: 'runs', action: 'Upload results' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const next = steps.findIndex((s) => !s.done)

  if (hidden || next === -1) return null

  return (
    <section className="glass-card mb-4 p-4 sm:p-5" aria-labelledby="getting-started-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="getting-started-title" className="text-[15px] font-semibold text-ink">Get started with automation</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Six steps from a test case to automated results. Tests run on your computer or your own CI, for free.
          </p>
        </div>
        <button type="button" aria-label="Hide the getting started checklist" title="Hide"
                className="rounded-md p-1 text-muted hover:bg-ink/[0.04] hover:text-ink"
                onClick={() => { writeFlag(hiddenKey); setHidden(true) }}>
          <X size={15} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-signal-soft" role="progressbar"
             aria-label="Checklist progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
          <div className="h-full rounded-full bg-signal transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <span className="shrink-0 text-[12px] text-muted tabular-nums">{doneCount} of {steps.length} done</span>
      </div>

      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, i) => {
          const isNext = i === next
          return (
            <li key={step.title}
                className={`flex gap-2.5 rounded-xl border p-3 ${isNext ? 'border-signal/40 bg-signal-soft/60' : 'border-hairline bg-paper/40'}`}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                step.done ? 'bg-verified text-white' : isNext ? 'bg-signal text-white' : 'bg-surface text-muted ring-1 ring-hairline'
              }`}>
                {step.done ? <Check size={12} aria-hidden="true" /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-[13px] font-medium ${step.done ? 'text-muted line-through' : 'text-ink'}`}>
                  {step.title}
                  {step.done && <span className="sr-only"> (done)</span>}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{step.detail}</p>
                {isNext && (
                  <button type="button" className="btn-primary mt-2" onClick={() => onGoTo(step.section)}>
                    {step.action} <ArrowRight size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
