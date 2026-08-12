import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle, Send } from "lucide-react";

const styles = {
  info: {
    icon: Info,
    colorClass: "text-[var(--accent)]",
    progressClass: "bg-[var(--accent)]",
    borderClass: "border-[var(--accent)]/20",
    bgClass: "bg-white/80 dark:bg-slate-900/80"
  },
  success: {
    icon: CheckCircle2,
    colorClass: "text-emerald-500 dark:text-emerald-400",
    progressClass: "bg-emerald-500 dark:bg-emerald-400",
    borderClass: "border-emerald-500/20 dark:border-emerald-400/20",
    bgClass: "bg-white/80 dark:bg-slate-900/80"
  },
  error: {
    icon: AlertCircle,
    colorClass: "text-rose-500 dark:text-rose-400",
    progressClass: "bg-rose-500 dark:bg-rose-400",
    borderClass: "border-rose-500/20 dark:border-rose-400/20",
    bgClass: "bg-white/80 dark:bg-slate-900/80"
  },
  warning: {
    icon: AlertTriangle,
    colorClass: "text-amber-500 dark:text-amber-400",
    progressClass: "bg-amber-500 dark:bg-amber-400",
    borderClass: "border-amber-500/20 dark:border-amber-400/20",
    bgClass: "bg-white/80 dark:bg-slate-900/80"
  }
};

function ToastItem({ toast, onRemove, onReply, onPause }) {
  const cfg = styles[toast.type] || styles.info;
  const Icon = cfg.icon;
  const [progress, setProgress] = useState(100);
  const [replyText, setReplyText] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isFocused) {
      setProgress(0);
      return;
    }
    if (!toast.duration || toast.duration <= 0) return;
    const intervalTime = 50;
    const steps = toast.duration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = Math.max(0, 100 - (currentStep / steps) * 100);
      setProgress(newProgress);
      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [toast.duration, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    if (onPause) {
      onPause(toast.id);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text) return;
    if (onReply && toast.chatId) {
      await onReply(toast.chatId, text);
    }
    setReplyText("");
    onRemove(toast.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-xl transition-all duration-300 ${cfg.bgClass} ${cfg.borderClass}`}
      style={{
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.08)"
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-4">
        {/* Glow behind icon */}
        <div className="relative flex shrink-0 items-center justify-center mt-0.5">
          <div className={`absolute -inset-1 rounded-full opacity-20 blur-sm ${cfg.progressClass}`} />
          <Icon className={`relative z-10 h-5 w-5 ${cfg.colorClass}`} />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-0.5">
            {toast.title ? (
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{toast.title}</p>
            ) : (
              <p className="text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">{toast.type || "Notification"}</p>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{toast.message}</p>
          </div>

          {/* Quick Reply Form */}
          {toast.chatId && (
            <form onSubmit={handleSend} className="flex items-center gap-1.5 mt-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={handleFocus}
                placeholder="Type a reply..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-800 focus:border-[var(--accent)] focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100 dark:focus:border-[var(--accent)] dark:focus:bg-slate-950 transition-all"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                aria-label="Send reply"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRemove(toast.id)}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors mt-0.5"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Slim progress bar indicator */}
      {!isFocused && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100/50 dark:bg-slate-800/50">
          <motion.div
            className={`h-full ${cfg.progressClass}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: "linear" }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default function ToastStack({ toasts, onRemove, onReply, onPause }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[999] flex w-[min(92vw,380px)] flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {toasts?.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} onReply={onReply} onPause={onPause} />
        ))}
      </AnimatePresence>
    </div>
  );
}
