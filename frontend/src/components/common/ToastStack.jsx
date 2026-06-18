import { AlertCircle, CheckCircle2, Info } from "lucide-react";

const styles = {
  info: {
    icon: Info,
    frame: "border-violet-300/70 bg-violet-50 text-violet-900 dark:border-violet-300/40 dark:bg-violet-500/15 dark:text-violet-100"
  },
  success: {
    icon: CheckCircle2,
    frame: "border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:border-emerald-300/40 dark:bg-emerald-500/15 dark:text-emerald-100"
  },
  error: {
    icon: AlertCircle,
    frame: "border-rose-300/70 bg-rose-50 text-rose-900 dark:border-rose-300/40 dark:bg-rose-500/15 dark:text-rose-100"
  }
};

export default function ToastStack({ toasts, onRemove }) {
  if (!toasts?.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((toast) => {
        const cfg = styles[toast.type] || styles.info;
        const Icon = cfg.icon;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-3 py-2 shadow-2xl ${cfg.frame}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              <Icon size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
                <p className="text-xs opacity-90">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(toast.id)}
                className="rounded-md px-1 text-xs text-slate-500 transition hover:bg-black/5 hover:text-slate-700 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Dismiss notification"
              >
                x
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
