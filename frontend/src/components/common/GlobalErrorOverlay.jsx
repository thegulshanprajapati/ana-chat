import { useEffect, useState } from "react";

function formatReason(reason) {
  if (!reason) return "";
  if (reason instanceof Error) return reason.message || String(reason);
  if (typeof reason === "string") return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

export default function GlobalErrorOverlay() {
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    function onError(event) {
      const error = event?.error;
      const message = (error?.message || event?.message || "Unknown error").toString();
      const stack = (error?.stack || "").toString();
      setEntry({ kind: "error", message, stack });
    }

    function onRejection(event) {
      const message = formatReason(event?.reason) || "Unhandled promise rejection";
      const stack = (event?.reason?.stack || "").toString();
      setEntry({ kind: "rejection", message, stack });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-end justify-center bg-slate-950/70 p-3 sm:items-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-rose-400/40 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-200">Runtime error</p>
            <p className="mt-1 break-words text-xs text-slate-200">{entry.message}</p>
          </div>
          <div className="shrink-0 flex gap-2">
            <button
              type="button"
              onClick={() => setEntry(null)}
              className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800/60"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
            >
              Reload
            </button>
          </div>
        </div>
        {entry.stack && (
          <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words px-4 py-3 text-[11px] leading-relaxed text-slate-300">
            {entry.stack}
          </pre>
        )}
      </div>
    </div>
  );
}

