import { useEffect, useRef } from "react";

export default function CustomConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  type = "confirm", // "confirm" or "alert"
  onConfirm,
  onCancel
}) {
  const okButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      okButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-200 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {message && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-2">
          {type !== "alert" && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={okButtonRef}
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white transition active:scale-[0.98]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
