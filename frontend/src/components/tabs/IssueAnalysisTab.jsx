import { Copy, Loader2 } from 'lucide-react'
import SegmentedControl from '../shared/SegmentedControl'
import { SeverityPill, PriorityPill } from '../shared/StatusPill'
import SkeletonBlock from '../shared/SkeletonBlock'

const MODE_OPTIONS = [
  { value: 'failed', label: 'Failed test' },
  { value: 'exploratory', label: 'Exploratory' },
]

function Field({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-md border border-hairline bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-signal"
      />
    </div>
  )
}

function ResultRow({ label, children }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline py-2.5 last:border-0">
      <span className="text-[13px] text-muted">{label}</span>
      {children}
    </div>
  )
}

export default function IssueAnalysisTab({ form, onFormChange, onGenerate, isGenerating, result, error, onCopy }) {
  return (
    <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Testing mode</label>
          <SegmentedControl
            options={MODE_OPTIONS}
            value={form.mode}
            onChange={(mode) => onFormChange({ ...form, mode })}
          />
        </div>

        <Field
          label="Observation"
          value={form.observation}
          onChange={(value) => onFormChange({ ...form, observation: value })}
          placeholder="What did you see happen?"
        />
        <Field
          label="Expected result"
          value={form.expected}
          onChange={(value) => onFormChange({ ...form, expected: value })}
          placeholder="What should have happened?"
          rows={2}
        />
        <Field
          label="Actual result"
          value={form.actual}
          onChange={(value) => onFormChange({ ...form, actual: value })}
          placeholder="What actually happened?"
          rows={2}
        />
{error && (
  <div className="rounded-lg border border-flagged/20 bg-flagged/5 p-3">
    <p className="text-sm font-medium text-flagged">
      Issue Analysis couldn't be completed
    </p>

    <p className="mt-1 text-[13px] text-muted">
      {error}
    </p>
  </div>
)}

        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="btn-primary"
        >
          {isGenerating && <Loader2 size={14} className="animate-spin" />}
          {isGenerating ? 'Classifying…' : 'Generate issue analysis'}
        </button>
      </div>

      <div className="rounded-lg border border-hairline bg-surface p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Classification</h3>
          {result && (
            <button
              type="button"
              onClick={onCopy}
              className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
            >
              <Copy size={13} /> Copy as Markdown
            </button>
          )}
        </div>

        {isGenerating && (
          <div className="flex flex-col gap-2 pt-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-7 w-full" />
            ))}
          </div>
        )}

        {!isGenerating && !result && (
          <p className="pt-2 text-[13px] text-muted">Classification will appear here.</p>
        )}

        {!isGenerating && result && form.mode === 'failed' && (
          <div>
            <ResultRow label="Bug type">
              <span className="text-[13px] text-ink">
  {result.bugType}
</span>
            </ResultRow>
            <ResultRow label="Severity">
              <SeverityPill severity={result.severity} />
            </ResultRow>
            <ResultRow label="Priority">
             <PriorityPill
  priority={result.priority?.toLowerCase()}
/> 
            </ResultRow>
            <ResultRow label="Title">
              <span className="max-w-[60%] text-right text-[13px] text-ink">{result.title}</span>
            </ResultRow>
          </div>
        )}

        {!isGenerating && result && form.mode === 'exploratory' && (
          <div>
            <ResultRow label="Observation type">
             <span className="text-[13px] text-ink">
  {result.observationType}
</span>
            </ResultRow>
            <ResultRow label="Severity">
              <SeverityPill severity={result.severity} />
            </ResultRow>
            <ResultRow label="Suggested next action">
              <span className="max-w-[60%] text-right text-[13px] text-ink">
  {result.suggestedAction}
</span>
            </ResultRow>
          </div>
        )}
      </div>
    </div>
  )
}
