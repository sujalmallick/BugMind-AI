export default function TabBar({ tabs, activeTab, onChange }) {
  return (
    <div className="scroll-thin flex gap-2 overflow-x-auto px-4 py-3 sm:px-5">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              isActive
                ? 'border-signal bg-signal text-white'
                : 'border-hairline bg-white text-muted hover:border-signal hover:text-ink'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={`text-[11px] ${isActive ? 'text-white/90' : 'text-muted'}`}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
