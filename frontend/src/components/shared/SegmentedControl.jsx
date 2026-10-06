// Segmented tab control. options: [{ value, label, count?, icon? }]
export default function SegmentedControl({ options, value, onChange, label, size = 'md' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]'
  return (
    <div
      role="tablist"
      aria-label={label}
      className="no-scrollbar inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-white/50 p-0.5 ring-1 ring-inset ring-ink/[0.06] backdrop-blur-md"
    >
      {options.map((option) => {
        const isActive = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md font-medium transition-all ${pad} ${
              isActive
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(9,10,15,0.08)] ring-1 ring-hairline'
                : 'text-muted hover:text-ink'
            }`}
          >
            {Icon && <Icon size={13} aria-hidden="true" className={isActive ? 'text-signal' : ''} />}
            {option.label}
            {typeof option.count === 'number' && (
              <span className={`font-mono text-[11px] ${isActive ? 'text-signal' : 'text-muted'}`}>{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
