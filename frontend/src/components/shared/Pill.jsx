const TONE_CLASSES = {
  neutral: 'bg-paper text-muted border-hairline',
  signal: 'bg-signal-soft text-signal border-signal/25',
  verified: 'bg-verified-soft text-verified border-verified/25',
  flagged: 'bg-flagged-soft text-flagged border-flagged/25',
  ochre: 'bg-ochre-soft text-ochre border-ochre/25',
}

// Compact status / role label.
export default function Pill({ tone = 'neutral', dashed = false, icon: Icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4 ${TONE_CLASSES[tone] ?? TONE_CLASSES.neutral} ${
        dashed ? 'border-dashed bg-transparent' : ''
      } ${className}`}
    >
      {Icon && <Icon size={11} aria-hidden="true" />}
      {children}
    </span>
  )
}
