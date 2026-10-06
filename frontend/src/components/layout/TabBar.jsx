export default function TabBar({ tabs, activeTab, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Workspace sections"
      className="scroll-thin flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-paper p-1 ring-1 ring-inset ring-hairline"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-200 ${
              isActive
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(9,10,15,0.08)] ring-1 ring-hairline'
                : 'text-muted hover:text-ink'
            }`}
          >
            <span className="whitespace-nowrap">{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span className={`font-mono text-[11px] ${isActive ? 'text-signal' : 'text-muted'}`}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
