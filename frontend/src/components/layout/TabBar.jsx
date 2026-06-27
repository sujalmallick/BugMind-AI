export default function TabBar({ tabs, activeTab, onChange }) {
  return (
    <div className="scroll-thin flex gap-1.5 overflow-x-auto rounded-xl border border-hairline/60 bg-surface/50 p-1.5 backdrop-blur-md">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
              isActive
                ? 'bg-white text-ink shadow-sm ring-1 ring-ink/5'
                : 'text-muted hover:bg-white/40 hover:text-ink'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${isActive ? 'bg-signal-soft/50 text-signal' : 'bg-paper text-muted'}`}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
