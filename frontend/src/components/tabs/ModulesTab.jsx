import { ShieldCheck, HelpCircle, AlertTriangle, Flag } from 'lucide-react'
import Card from '../shared/Card'
import ConfidenceChip from '../shared/ConfidenceChip'
import EmptyState from '../shared/EmptyState'
import SkeletonBlock from '../shared/SkeletonBlock'
import AIThinking from "../shared/AIThinking";

function ChipRow({ items, tone, confidence }) {
  if (!items.length) {
    return <p className="text-[13px] text-muted">None identified for this workflow.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <ConfidenceChip key={item} label={item} tone={tone} confidence={confidence} />
      ))}
    </div>
  )
}

function ModuleCardSkeleton() {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <SkeletonBlock className="mb-3 h-4 w-32" />
      <div className="flex gap-2">
        <SkeletonBlock className="h-6 w-16" />
        <SkeletonBlock className="h-6 w-20" />
        <SkeletonBlock className="h-6 w-14" />
      </div>
    </div>
  )
}

export default function ModulesTab({ analysis, isLoading }) {


  if (!analysis) {
    return (
      <div className="p-5">
        <EmptyState
          icon={<ShieldCheck size={22} />}
          title="No analysis yet"
          description="Describe a workflow above and analyze it to see confirmed and assumed modules here."
        />
      </div>
    )
  }
  

  return (
    
    <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
      <Card icon={<ShieldCheck size={18} className="text-verified" />} title="Confirmed modules">
        <ChipRow items={analysis.confirmedModules} tone="verified" confidence="confirmed" />
      </Card>

      <Card icon={<HelpCircle size={18} className="text-ochre" />} title="Assumed modules">
        <ChipRow items={analysis.assumedModules} tone="ochre" confidence="assumed" />
      </Card>

      <Card icon={<AlertTriangle size={18} className="text-flagged" />} title="High risk areas">
        <ChipRow items={analysis.highRiskAreas} tone="flagged" confidence="confirmed" />
      </Card>

      <Card icon={<Flag size={18} className="text-signal" />} title="Critical workflows">
        <ChipRow items={analysis.criticalWorkflows} tone="signal" confidence="confirmed" />
      </Card>
    </div>
  )
}
