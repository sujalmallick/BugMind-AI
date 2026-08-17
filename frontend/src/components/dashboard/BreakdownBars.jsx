export default function BreakdownBars({
  items = [],
  emptyText = "No data yet.",
  barTone = "bg-signal",
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-hairline bg-surface px-4 py-6 text-center text-sm text-muted">
        {emptyText}
      </div>
    );
  }

  const max = Math.max(...items.map((item) => item.count || 0), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = Math.max(8, Math.round(((item.count || 0) / max) * 100));

        return (
          <div key={item.key || item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink capitalize">
                {item.label?.replace(/-/g, " ")}
              </span>
              <span className="font-mono text-xs text-muted">{item.count}</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-paper">
              <div
                className={`h-full rounded-full ${barTone}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}