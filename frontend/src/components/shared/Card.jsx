export default function Card({ icon, title, action, children, className = '' }) {
  return (
    <div className={`glass-card p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
