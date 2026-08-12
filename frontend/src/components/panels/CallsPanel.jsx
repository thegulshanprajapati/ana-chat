import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from "lucide-react";
import Avatar from "../common/Avatar";
import { clearCallLogs, getCallLogs } from "../../utils/callLogs";
import { formatDayLabel, formatTime } from "../../utils/time";
import CallDetailsSheet from "../chat/CallDetailsSheet";
import DetailedCallHistoryModal from "../chat/DetailedCallHistoryModal";

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
  const e = end   ? new Date(end).getTime()   : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return "";
  const total = Math.round((e - s) / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function callStatusLabel(item) {
  const status = (item?.status || "").toString();
  if (status === "missed")           return "Missed";
  if (status === "rejected")         return "Declined";
  if (status === "busy")             return "Busy";
  if (status === "no_answer")        return "No answer";
  if (status === "connection_lost")  return "Disconnected";
  if (status === "ended")            return "Ended";
  if (status === "active")           return "Active";
  if (status === "incoming")         return "Incoming";
  if (status === "outgoing")         return "Outgoing";
  return status ? status : "Call";
}

function statusColor(item) {
  const s = (item?.status || "").toString();
  if (s === "missed")  return "text-rose-500 dark:text-rose-400";
  if (s === "rejected") return "text-rose-400";
  return "text-slate-500 dark:text-slate-400";
}

function DirectionIcon({ item, size = 14 }) {
  const s = (item?.status || "").toString();
  if (s === "missed") return <PhoneMissed size={size} className="text-rose-500 dark:text-rose-400 shrink-0" />;
  if (item?.direction === "incoming") return <PhoneIncoming size={size} className="text-emerald-500 dark:text-emerald-400 shrink-0" />;
  return <PhoneOutgoing size={size} className="text-slate-400 shrink-0" />;
}

export default function CallsPanel({ me, userId, mobile = false, onBack, onStartCall }) {
  const resolvedUserId = userId || me?.id || null;
  const [callLogs, setCallLogs]   = useState(() => getCallLogs(resolvedUserId));
  const [selectedLog, setSelectedLog] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    function sync() {
      setCallLogs(getCallLogs(resolvedUserId));
    }
    window.addEventListener("storage", sync);
    window.addEventListener("anach_call_logs_updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("anach_call_logs_updated", sync);
    };
  }, [resolvedUserId]);

  const grouped = useMemo(() => groupByDay(callLogs), [callLogs]);

  // Handler: Call Again from details sheet
  const handleCallAgain = (callType) => {
    setSelectedLog(null);
    if (selectedLog && onStartCall) {
      onStartCall(selectedLog.peerUserId, callType, {
        peerName:   selectedLog.peerName,
        peerAvatar: selectedLog.peerAvatar,
        chatId:     selectedLog.chatId
      });
    }
  };

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
              clearCallLogs(resolvedUserId);
              setCallLogs(getCallLogs(resolvedUserId));
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
                  {items.map((item) => {
                    const dur = durationLabel(item.started_at, item.ended_at);
                    const isVideo = item.callType === "video";
                    return (
                      <button
                        key={item.id || `${item.started_at || item.created_at}-${item.peerUserId || ""}`}
                        type="button"
                        onClick={() => setSelectedLog(item)}
                        className="
                          w-full flex items-center gap-3 rounded-2xl
                          border border-slate-200/70 bg-white/60 p-3 shadow-sm
                          dark:border-white/10 dark:bg-slate-950/30
                          hover:bg-slate-50 dark:hover:bg-white/5
                          active:scale-[0.985] transition-all duration-150
                          text-left cursor-pointer
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                        "
                        aria-label={`Call details: ${item.peerName || "Unknown"}, ${callStatusLabel(item)}`}
                      >
                        {/* Avatar with call type badge */}
                        <div className="relative shrink-0">
                          <Avatar name={item.peerName || "User"} src={item.peerAvatar} size={44} />
                          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10">
                            {isVideo
                              ? <Video size={9} className="text-violet-500" />
                              : <PhoneCall size={9} className="text-emerald-500" />}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {item.peerName || "Unknown"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <DirectionIcon item={item} size={11} />
                            <p className={`truncate text-xs ${statusColor(item)}`}>
                              {callStatusLabel(item)}
                              {item.callType ? ` · ${item.callType}` : ""}
                              {dur ? ` · ${dur}` : ""}
                            </p>
                          </div>
                        </div>

                        {/* Time */}
                        <p className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                          {formatTime(item.started_at || item.created_at) || ""}
                        </p>
                      </button>
                    );
                  })}
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

      {/* Call Details Sheet */}
      <CallDetailsSheet
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        callLog={selectedLog}
        me={me}
        onCallAgain={handleCallAgain}
        onViewHistory={() => {
          setSelectedLog(null);
          setHistoryOpen(true);
        }}
        onViewProfile={() => {
          // Profile viewing is handled by the parent (ChatPage)
          // just close the sheet for now — parent can wire this up
          setSelectedLog(null);
        }}
      />

      {/* Detailed Call History Modal */}
      <DetailedCallHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        me={me}
        peerUserId={selectedLog?.peerUserId}
        peerName={selectedLog?.peerName}
        peerAvatar={selectedLog?.peerAvatar}
        onStartCall={(callType) => {
          setHistoryOpen(false);
          if (selectedLog && onStartCall) {
            onStartCall(selectedLog.peerUserId, callType, {
              peerName:   selectedLog.peerName,
              peerAvatar: selectedLog.peerAvatar,
              chatId:     selectedLog.chatId
            });
          }
        }}
      />
    </section>
  );
}
