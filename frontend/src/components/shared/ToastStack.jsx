import { CheckCircle2, AlertCircle, Info } from "lucide-react";

const TOAST_META = {
  success: { icon: CheckCircle2, iconClass: "text-verified" },
  error: { icon: AlertCircle, iconClass: "text-flagged" },
  info: { icon: Info, iconClass: "text-signal" },
};

// Fixed to the viewport's bottom-right. Polite live region so screen readers
// announce saves and errors without stealing focus.
export default function ToastStack({ toasts }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[300] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:bottom-5 sm:right-5"
    >
      {toasts.map((toast) => {
        const meta = TOAST_META[toast.type] ?? TOAST_META.success;
        const Icon = meta.icon;
        return (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className="glass glass-menu toast-item pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium text-ink"
          >
            <Icon size={16} className={`shrink-0 ${meta.iconClass}`} aria-hidden="true" />
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
