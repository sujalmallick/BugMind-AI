import { CheckCircle2, AlertCircle, Info } from "lucide-react";

function toastMeta(type) {
  if (type === "error")
    return {
      icon: <AlertCircle size={15} className="shrink-0 text-flagged" />,
      classes:
        "border-flagged/25 bg-white text-flagged shadow-[0_4px_16px_rgba(196,67,43,0.12)]",
    };
  if (type === "info")
    return {
      icon: <Info size={15} className="shrink-0 text-signal" />,
      classes:
        "border-signal/25 bg-white text-signal shadow-[0_4px_16px_rgba(52,84,209,0.10)]",
    };
  // default / success
  return {
    icon: <CheckCircle2 size={15} className="shrink-0 text-verified" />,
    classes:
      "border-verified/25 bg-white text-ink shadow-[0_4px_16px_rgba(26,127,90,0.10)]",
  };
}

export default function ToastStack({ toasts }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const { icon, classes } = toastMeta(toast.type);
        return (
          <div
            key={toast.id}
            className={`toast-item flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] font-medium ${classes}`}
          >
            {icon}
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
