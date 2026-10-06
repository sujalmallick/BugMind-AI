import React from "react";

// Dashboard stat tile: tinted icon chip, label, large tabular number and an
// optional hint line. `colorClass`/`bgClass` tint the icon chip only.
export default function StatCard({ title, value, icon: Icon, colorClass = "text-signal", bgClass = "bg-signal-soft", hint }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-hairline bg-surface p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-px hover:border-hairline-strong hover:shadow-[var(--shadow-raised)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{title}</p>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bgClass} ${colorClass}`}>
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink sm:text-[2rem]">
        {value}
      </p>
      {hint && <p className="mt-2 truncate text-[12px] text-muted">{hint}</p>}
    </div>
  );
}
