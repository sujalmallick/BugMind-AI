export default function EmptyState({ icon, title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline-strong/70 bg-paper/60 px-6 py-10 text-center ${className}`}>
      {icon && (
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-surface text-muted shadow-[var(--shadow-card)]">
          {icon}
        </div>
      )}
      {title && <p className="text-[14px] font-medium text-ink">{title}</p>}
      {description && <p className="max-w-xs text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
