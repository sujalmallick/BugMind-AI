import { useState } from 'react'
import { ArrowRight, Check, Copy, Info } from 'lucide-react'

// The whole automation loop in plain words: what to do, in order, and where.
const PARTS = [
  {
    title: 'Set up (once)',
    steps: [
      {
        title: 'Add your website',
        where: 'environments',
        button: 'Go to Environments',
        points: [
          'Click New environment and enter the website address to test, for example your staging site.',
          'If tests need to visit other sites (like a payment page), add them under "Other domains".',
          'Add test data as variables, for example USER_EMAIL, and USER_PASSWORD marked Secret. Secrets are encrypted and never sent to the AI.',
        ],
      },
      {
        title: 'Create test scripts',
        where: 'scripts',
        button: 'Go to Scripts',
        points: [
          'Click Draft from test case: the AI turns one of your test cases into browser steps.',
          'Or click Blank script and add the steps yourself.',
          'Tip: Overview → "Not automated yet" lists test cases without a script.',
        ],
      },
      {
        title: 'Check and approve',
        where: 'scripts',
        button: 'Review scripts',
        points: [
          'Open each script and read its steps. The AI can\'t see your website, so element names (button and field labels) are guesses: fix any that are wrong.',
          'Fix everything listed under "Fix before approving", then click Approve.',
          'Only approved scripts can be downloaded and run.',
        ],
      },
    ],
  },
  {
    title: 'Run the tests (pick one)',
    steps: [
      {
        title: 'On your computer',
        where: 'runs',
        button: 'Download the tests',
        points: [
          'Runs → Download (ZIP), then unzip it. You need Node.js 20 or newer.',
          'Copy .env.example to .env and fill in your test data.',
          'In the unzipped folder, run these commands:',
        ],
        commands: ['npm install', 'npx playwright install chromium', 'npx playwright test'],
        after: 'This writes bugmind-results.json, the results file for step 6.',
      },
      {
        title: 'On GitHub (free, runs by itself)',
        where: 'runs',
        button: 'Download the tests',
        points: [
          'Runs → Download (ZIP), unzip it and put the folder in a GitHub repository (private is fine).',
          'In the repository open Settings → Secrets and variables → Actions and add each test variable (like USER_PASSWORD) as a secret.',
          'Tests now run on every push to main, or any time from Actions → BugMind E2E tests → Run workflow.',
          'Your website must be reachable from the internet: GitHub can\'t open localhost or an office network.',
        ],
      },
    ],
  },
  {
    title: 'Get the results into BugMind (pick one)',
    steps: [
      {
        title: 'Automatically from GitHub',
        where: 'runs',
        button: 'Create an upload token',
        points: [
          'Runs → Send results automatically from GitHub → New token, then copy it. It is shown only once.',
          'Add it to your GitHub repository as a secret named BUGMIND_UPLOAD_TOKEN.',
          'Download the tests again and push them. After every run the results arrive by themselves ("sent by GitHub").',
          'The token can only upload results to this project. Revoke it any time.',
        ],
      },
      {
        title: 'By hand',
        where: 'runs',
        button: 'Upload results',
        points: [
          'Runs → Upload results, and choose bugmind-results.json.',
          'From GitHub: open the finished run in the Actions tab and download the "bugmind-results" file first.',
        ],
      },
    ],
  },
  {
    title: 'Use the results',
    steps: [
      {
        title: 'See what passed and failed',
        where: 'overview',
        button: 'Open Overview',
        points: [
          'Linked test cases are marked Passed or Failed with an "Automated" badge, and their assignees are notified.',
          'Overview shows the pass rate over time, the scripts failing most often, and what isn\'t automated yet.',
        ],
      },
      {
        title: 'When a test fails',
        where: 'runs',
        button: 'Open Runs',
        points: [
          'Open the run. Suggest a fix: if the website just renamed a button or field, the AI proposes the new name it saw on the page. Click Apply, approve the script again, then download and run again.',
          'Create bug report: if the app is really broken, this files an issue with the steps, the error and expected vs actual.',
        ],
      },
    ],
  },
]

// Steps are numbered straight through all parts (1, 2, 3, ...).
let counter = 0
const NUMBERED = PARTS.map((part) => ({ ...part, steps: part.steps.map((step) => ({ ...step, number: ++counter })) }))

const GOOD_TO_KNOW = [
  'Changed a script? Download the tests again. Results from an older version are recorded but don\'t change test cases.',
  'Changing a script, or the website address of its environment, sends it back to draft: approve it again.',
  'Tests can only visit the website and the domains you allowed. Anything else is blocked and the run says so.',
  'An upload token leaked or someone left the team? Revoke the token in Runs and create a new one.',
]

function CommandBlock({ commands }) {
  const [copied, setCopied] = useState(false)
  const text = commands.join('\n')
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked: the commands are selectable
    }
  }
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-hairline bg-paper/70 p-2.5">
      <pre className="min-w-0 flex-1 select-all overflow-x-auto font-mono text-[12px] leading-relaxed text-ink">{text}</pre>
      <button type="button" className="btn-secondary shrink-0" onClick={copy} aria-label="Copy the commands">
        {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function GuideSection({ onGoTo }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="glass-card p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold text-ink">How automation works</h2>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted">
          You describe tests in BugMind, run them on your own computer or GitHub for free, and the results come back
          to your test cases. Follow these steps in order. Each step has a button that takes you to the right place.
        </p>
      </div>

      {NUMBERED.map((part) => (
        <section key={part.title} aria-label={part.title}>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">{part.title}</h3>
          <ol className={`grid gap-3 ${part.steps.length > 2 ? 'lg:grid-cols-3' : part.steps.length === 2 ? 'md:grid-cols-2' : ''}`}>
            {part.steps.map((step) => (

                <li key={step.title} className="glass-card flex flex-col p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-signal text-[12px] font-semibold text-white">
                      {step.number}
                    </span>
                    <h4 className="text-[14px] font-semibold text-ink">{step.title}</h4>
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-muted">
                    {step.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                  {step.commands && <CommandBlock commands={step.commands} />}
                  {step.after && <p className="mt-2 text-[12.5px] text-muted">{step.after}</p>}
                  <div className="mt-auto pt-3">
                    <button type="button" className="btn-secondary" onClick={() => onGoTo(step.where)}>
                      {step.button} <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  </div>
                </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="glass-card p-4 sm:p-5" aria-labelledby="guide-good-to-know">
        <h3 id="guide-good-to-know" className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
          <Info size={14} aria-hidden="true" className="text-signal" /> Good to know
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-muted">
          {GOOD_TO_KNOW.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </section>
    </div>
  )
}
