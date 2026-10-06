import { BookOpen } from 'lucide-react'

// Which project documents informed an analysis (RAG). Renders nothing when none did.
export default function KnowledgeSourcesNote({ sources, className = '' }) {
  if (!sources?.length) return null
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-hairline bg-paper/60 px-3 py-2 text-[12px] text-muted ${className}`}>
      <BookOpen size={14} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
      <p>
        <span className="font-medium text-ink">Informed by project knowledge: </span>
        {sources.map((source, i) => (
          <span key={source.documentId}>
            {i > 0 && ' · '}
            {source.filename}
            {source.sections?.length ? ` (${source.sections.join(', ')})` : ''}
          </span>
        ))}
      </p>
    </div>
  )
}
