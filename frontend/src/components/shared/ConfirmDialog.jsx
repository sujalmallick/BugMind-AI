import { useEffect, useId } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

/**
 * Reusable confirmation dialog.
 *
 * Props:
 *   open        - boolean, whether to show
 *   title       - heading text
 *   message     - body copy
 *   confirmText - button label (default "Delete")
 *   cancelText  - cancel label (default "Cancel")
 *   danger      - boolean, red confirm button (default true)
 *   onConfirm   - called when user clicks confirm
 *   onCancel    - called when user cancels / closes (also on Escape)
 *   loading     - disables buttons during async action
 */
export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
  loading = false,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && !loading && onCancel?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-[200] flex items-center justify-center bg-ink/25 backdrop-blur-[6px] p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass modal-pop-enter w-full max-w-sm overflow-hidden rounded-2xl"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? "bg-flagged-soft text-flagged" : "bg-signal-soft text-signal"}`}>
              <AlertTriangle size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 id={titleId} className="text-[15px] font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{message}</p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              aria-label="Close"
              className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`btn-primary ${danger ? "!border-flagged !bg-flagged hover:!border-red-700 hover:!bg-red-700" : ""}`}
            >
              {loading && <Loader2 size={14} className="spin" aria-hidden="true" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
