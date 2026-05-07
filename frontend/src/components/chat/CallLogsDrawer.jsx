import { useEffect, useMemo, useState } from "react";
import { PhoneCall, PhoneIncoming, PhoneOutgoing, Trash2, Video, X } from "lucide-react";
import { clearCallLogs, getCallLogs } from "../../utils/callLogs";
import { formatDayLabel, formatTime } from "../../utils/time";

function groupByDay(items) {
  const groups = new Map();
  (items || []).forEach((item) => {
    const day = formatDayLabel(item.started_at || item.created_at) || "Unknown";
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(item);
  });
  return [...groups.entries()];
}

function durationLabel(start, end) {
  const s = start ? new Date(start).getTime() : NaN;
  const e = end ? new Date(end).getTime() : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return "";
  const total = Math.round((e - s) / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function statusText(item) {
  const status = (item?.status || "").toString();
  if (status === "missed") return "Missed";
  if (status === "rejected") return "Declined";
  if (status === "busy") return "Busy";
  if (status === "no_answer") return "No answer";
  if (status === "connection_lost") return "Disconnected";
  if (status === "ended") return "Ended";
  if (status === "active") return "Active";
  if (status === "incoming") return "Incoming";
  if (status === "outgoing") return "Outgoing";
  return status ? status : "Call";
}

export default function CallLogsDrawer({ open, onClose }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    setLogs(getCallLogs());

    function sync() {
      setLogs(getCallLogs());
    }

    window.addEventListener("storage", sync);
    window.addEventListener("anach_call_logs_updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("anach_call_logs_updated", sync);
    };
  }, [open]);

  const groups = useMemo(() => groupByDay(logs), [logs]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-[90] bg-slate-950/60"
        aria-label="Close call logs"
      />
      <section className="fixed inset-x-3 bottom-3 z-[95] max-h-[84vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:inset-x-0 sm:bottom-6 sm:mx-auto sm:max-w-[560px]">
        <header className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/70">
          <div className="flex min-w-0 items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
              <PhoneCall size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Call logs</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">Recent calls</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                clearCallLogs();
                setLogs([]);
              }}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Clear call logs"
              title="Clear"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Close"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="max-h-[calc(84vh-64px)] overflow-y-auto overscroll-contain px-4 py-3">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">No calls yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your recent calls will appear here.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map(([day, items]) => (
                <div key={day}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{day}</p>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const incoming = item.direction === "incoming";
                      const callType = item.callType === "video" ? "video" : "voice";
                      const when = formatTime(item.started_at || item.created_at) || "";
                      const dur = durationLabel(item.started_at, item.ended_at);
                      const status = statusText(item);
                      const statusTone = ["missed", "rejected", "busy", "no_answer"].includes(item.status)
                        ? "text-rose-600 dark:text-rose-300"
                        : "text-slate-600 dark:text-slate-300";

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-700 dark:bg-white/5 dark:text-slate-100">
                              {callType === "video" ? <Video size={18} /> : (incoming ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {item.peerName || "Unknown"}
                              </p>
                              <p className={`truncate text-xs ${statusTone}`}>
                                {incoming ? "Incoming" : "Outgoing"} {callType} • {status}{dur ? ` • ${dur}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                            {when}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
