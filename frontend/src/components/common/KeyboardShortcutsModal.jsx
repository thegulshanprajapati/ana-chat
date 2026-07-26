import { useEffect } from "react";
import { Keyboard, X } from "lucide-react";

export default function KeyboardShortcutsModal({ open, onClose }) {
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
        aria-label="Close shortcuts modal"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        className="relative w-full max-w-[560px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 shrink-0">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Keyboard size={16} />
            Keyboard Shortcuts
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

        <div className="space-y-4 px-5 py-5 overflow-y-auto min-h-0 flex-1">
          {/* Section 1: Navigation & Actions */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-850 dark:bg-slate-900/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              App Actions & Navigation
            </p>
            <div className="space-y-2">
              <ShortcutRow keys={["Ctrl", "Alt", "S"]} description="Toggle Settings drawer" />
              <ShortcutRow keys={["Ctrl", "Alt", "P"]} description="Toggle Profile drawer" />
              <ShortcutRow keys={["Ctrl", "Alt", "N"]} description="Toggle New Group modal" />
              <ShortcutRow keys={["Ctrl", "Alt", "A"]} description="Toggle Dark/Light theme" />
              <ShortcutRow keys={["Esc"]} description="Cancel active reply or close active overlay/drawer" />
            </div>
          </div>

          {/* Section 2: Input & Formatting */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-850 dark:bg-slate-900/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Message Input Formatting
            </p>
            <div className="space-y-2">
              <ShortcutRow keys={["Ctrl", "B"]} description="Wrap selection with Bold (**)" />
              <ShortcutRow keys={["Ctrl", "I"]} description="Wrap selection with Italic (*)" />
              <ShortcutRow keys={["Ctrl", "U"]} description="Wrap selection with Underline (__)" />
              <ShortcutRow keys={["Ctrl", "E"]} description="Toggle Emoji Picker panel" />
            </div>
          </div>

          {/* Section 3: Emoji Shortcuts */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-850 dark:bg-slate-900/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Emoji Hotkeys & Shortcodes
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Quick Emoji Insert:</p>
                <div className="grid grid-cols-2 gap-2">
                  <ShortcutRow keys={["Alt", "1"]} description="Insert 😊" />
                  <ShortcutRow keys={["Alt", "2"]} description="Insert ❤️" />
                  <ShortcutRow keys={["Alt", "3"]} description="Insert 👍" />
                  <ShortcutRow keys={["Alt", "4"]} description="Insert 😂" />
                  <ShortcutRow keys={["Alt", "5"]} description="Insert 🔥" />
                  <ShortcutRow keys={["Alt", "6"]} description="Insert 😍" />
                  <ShortcutRow keys={["Alt", "7"]} description="Insert 🎉" />
                  <ShortcutRow keys={["Alt", "8"]} description="Insert 👏" />
                  <ShortcutRow keys={["Alt", "9"]} description="Insert ✨" />
                </div>
              </div>
              <div className="border-t border-slate-200/50 dark:border-slate-850/50 pt-2">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Text Auto-replacements:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div><code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-semibold font-mono">: )</code> or <code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-semibold font-mono">:- )</code> &rarr; 😊</div>
                  <div><code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-semibold font-mono">: (</code> or <code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-semibold font-mono">:- (</code> &rarr; ☹️</div>
                  <div><code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-semibold font-mono">&lt;3</code> &rarr; ❤️</div>
                  <div><code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-semibold font-mono">:D</code> &rarr; 😀</div>
                  <div><code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-semibold font-mono">:P</code> &rarr; 😛</div>
                  <div><code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-semibold font-mono">;)</code> &rarr; 😉</div>
                  <div><code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-semibold font-mono">B)</code> &rarr; 😎</div>
                  <div><code className="bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded font-semibold font-mono">(y)</code> &rarr; 👍</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Deactivated Browser Defaults */}
          <div className="rounded-2xl border border-slate-200 bg-rose-500/5 p-4 dark:border-rose-500/15">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-500 dark:text-rose-400 mb-1.5">
              Deactivated Browser Actions
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
              System keys like <kbd className="font-mono bg-slate-100 dark:bg-slate-950 px-1 rounded">Ctrl+P</kbd> (Print), <kbd className="font-mono bg-slate-100 dark:bg-slate-950 px-1 rounded">Ctrl+S</kbd> (Save), <kbd className="font-mono bg-slate-100 dark:bg-slate-950 px-1 rounded">Ctrl+F</kbd> (Find), and <kbd className="font-mono bg-slate-100 dark:bg-slate-950 px-1 rounded">Ctrl+D</kbd> (Bookmark) have been deactivated on this page to prevent system dialogs from interrupting your chat workflow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, description }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-slate-600 dark:text-slate-350">{description}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={k}>
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold font-mono text-slate-800 bg-white border border-slate-250 rounded shadow-sm dark:text-slate-200 dark:bg-slate-950 dark:border-slate-800">
              {k}
            </kbd>
            {i < keys.length - 1 && <span className="text-slate-400 font-semibold">+</span>}
          </span>
        ))}
      </span>
    </div>
  );
}
