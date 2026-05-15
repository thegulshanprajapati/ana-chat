import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PhoneCall } from "lucide-react";
import Avatar from "../common/Avatar";
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

function callStatusLabel(item) {
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

export default function CallsPanel({ mobile = false, onBack }) {
  const [callLogs, setCallLogs] = useState(() => getCallLogs());

  useEffect(() => {
    function sync() {
      setCallLogs(getCallLogs());
    }
    window.addEventListener("storage", sync);
    window.addEventListener("anach_call_logs_updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("anach_call_logs_updated", sync);
    };
  }, []);

  const grouped = useMemo(() => groupByDay(callLogs), [callLogs]);

  return (
    <section className="glass-bar flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-none shadow-[0_22px_70px_rgb(0_0_0_/_0.28)] sm:rounded-lg">
      <header className="sticky top-0 z-30 glass-bar rounded-none border-x-0 border-t-0 border-b border-slate-200/60 px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.10)] dark:border-white/10 sm:px-5 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {mobile && (
              <button
                type="button"
                onClick={onBack}
                className="glass-icon-btn"
                aria-label="Back to chats"
                title="Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <PhoneCall size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">Calls</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Recent call history</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              clearCallLogs();
              setCallLogs(getCallLogs());
            }}
            className="rounded-xl border border-rose-300/70 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
          >
            Clear
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        {callLogs.length ? (
          <div className="space-y-4">
            {grouped.map(([day, items]) => (
              <section key={day}>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {day}
                </p>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id || `${item.started_at || item.created_at}-${item.peerUserId || ""}`}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/30"
                    >
                      <Avatar name={item.peerName || "User"} src={item.peerAvatar} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.peerName || "Unknown"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {callStatusLabel(item)}{item.callType ? ` • ${item.callType}` : ""}{durationLabel(item.started_at, item.ended_at) ? ` • ${durationLabel(item.started_at, item.ended_at)}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                        {formatTime(item.started_at || item.created_at) || ""}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center text-slate-500 dark:text-slate-400">
            <PhoneCall size={22} className="opacity-60" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No calls yet</p>
            <p className="text-xs">Your call history will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
