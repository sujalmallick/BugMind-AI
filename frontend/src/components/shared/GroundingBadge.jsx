import { CheckCircle2, AlertTriangle } from 'lucide-react'
import Pill from './Pill'

// Source / hallucination-check badge for an AI-generated test case.
// Renders nothing for manual or older cases (no grounding result).
export default function GroundingBadge({ data }) {
  const grounding = data?.grounding
  if (!grounding) return null
  if (grounding.status === 'grounded') {
    const sources = grounding.sources ?? []
    const first = sources[0]
    const extra = sources.length > 1 ? ` +${sources.length - 1}` : ''
    return (
      <Pill tone="verified" icon={CheckCircle2}>
        {first?.type === 'document' ? 'Docs' : 'Workflow'}{extra}
      </Pill>
    )
  }
  return (
    <Pill tone="ochre" icon={AlertTriangle}>
      Assumed
    </Pill>
  )
}
