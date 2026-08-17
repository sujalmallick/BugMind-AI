import { AlertTriangle, X } from "lucide-react";

/**
 * Reusable confirmation dialog.
 *
 * Props:
 *   open        - boolean, whether to show
 *   title       - heading text
 *   message     - body copy
 *   confirmText - button label (default "Delete")
 *   danger      - boolean, red confirm button (default true)
 *   onConfirm   - called when user clicks confirm
 *   onCancel    - called when user cancels / closes
 *   loading     - disables buttons during async action
 */
export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Delete",
  danger = true,
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 overflow-hidden">
        {/* Top accent */}
        <div className={`h-1 w-full ${danger ? "bg-flagged" : "bg-signal"}`} />

        <div className="p-6">
          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-red-50" : "bg-signal-soft"}`}>
              <AlertTriangle size={20} className={danger ? "text-flagged" : "text-signal"} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-ink">{title}</h3>
              <p className="mt-1 text-sm text-muted leading-relaxed">{message}</p>
            </div>
            <button
              onClick={onCancel}
              disabled={loading}
              className="shrink-0 rounded-md p-1 text-muted hover:bg-paper hover:text-ink transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-hairline bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-paper transition"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`rounded-xl px-5 py-2 text-sm font-bold text-white transition shadow-md disabled:opacity-50 flex items-center gap-2
                ${danger
                  ? "bg-flagged hover:bg-red-600 shadow-red-200"
                  : "bg-signal hover:bg-signal/90 shadow-signal/20"
                }`}
            >
              {loading && (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
