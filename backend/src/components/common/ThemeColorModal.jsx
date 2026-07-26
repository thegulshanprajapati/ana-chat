import { useEffect } from "react";
import { Palette, X } from "lucide-react";

export default function ThemeColorModal({
  open,
  onClose,
  accentColor,
  onSetAccentColor,
  onSetSidebarColor,
  onSetChatPaneColor
}) {
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
        aria-label="Close theme color"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="App theme color"
        className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Palette size={16} />
            App theme color
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
            <label className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="font-medium text-slate-900 dark:text-slate-100">Primary color</span>
              <input
                type="color"
                value={accentColor || "#a855f7"}
                onChange={(event) => {
                  const value = event.target.value;
                  onSetAccentColor?.(value);
                  onSetSidebarColor?.("");
                  onSetChatPaneColor?.("");
                }}
                className="h-12 w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-0 dark:border-slate-700 dark:bg-slate-900"
              />
              <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                Applies to the overall app color combination. Text contrast adjusts automatically.
              </p>
            </label>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  onSetAccentColor?.("#a855f7");
                  onSetSidebarColor?.("");
                  onSetChatPaneColor?.("");
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Reset theme color
              </button>

              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span
                  className="h-4 w-4 rounded-full border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: "var(--accent)" }}
                  aria-hidden
                />
                <span className="font-mono">{(accentColor || "#a855f7").toLowerCase()}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Preview
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold shadow-accent">
                  Accent button
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  Messages, highlights, and gradients follow this color.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="h-14 rounded-2xl border border-slate-200 bg-accent-soft dark:border-slate-700" />
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  Soft accents keep the UI readable in both modes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

