// Content panel used on dashboards, organization and team pages: a titled
// card with an optional description and a right-aligned action slot.
export default function Panel({ title, description, action, children, className = "", bodyClassName = "p-5" }) {
  return (
    <section className={`glass-card flex flex-col ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[12px] text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
