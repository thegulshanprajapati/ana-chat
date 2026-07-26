import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";

const OPTIONS = [
  { id: "dots", label: "Dots" },
  { id: "grid", label: "Grid" },
  { id: "hatch", label: "Hatch" },
  { id: "bubbles", label: "Bubbles" },
  { id: "icons", label: "Icons" },
  { id: "confetti", label: "Confetti" }
];

export default function ThemeDoodleModal({ open, onClose, doodleStyle, onSetDoodleStyle }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/60"
        onClick={onClose}
        aria-label="Close chat doodles"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chat doodles"
        className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Sparkles size={16} />
            Chat doodles
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Choose a style
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {OPTIONS.map((option) => {
                const active = (doodleStyle || "dots") === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onSetDoodleStyle?.(option.id);
                      onClose?.();
                    }}
                    className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              Doodles show behind messages (and stay subtle). They follow your selected app color.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Preview
            </p>
            <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="thread-surface h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
