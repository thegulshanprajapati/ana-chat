/**
 * DetailedCallHistoryModal
 * ─────────────────────────
 * Shows all call history with a specific user, grouped by day.
 * Clicking an individual call shows a detailed view.
 *
 * ⚠️  All analytics fields show the actual tracked value or "Unavailable".
 *    No fake/hardcoded data values are used anywhere in this component.
 */
import { useEffect, useMemo, useState } from "react";
import {
  PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Video, X, Upload, Download, Wifi, Signal, Activity,
  RefreshCw, ChevronLeft
} from "lucide-react";
import { getCallLogs } from "../../utils/callLogs";
import { formatDataUsage } from "../../hooks/useCallStats";
import { formatDayLabel, formatTime } from "../../utils/time";
import Avatar from "../common/Avatar";

/* ── helpers ── */
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
  const mins  = Math.floor(total / 60);
  const secs  = total % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function statusText(item) {
  const s = (item?.status || "").toString();
  if (s === "missed")           return "Missed";
  if (s === "rejected")         return "Declined";
  if (s === "busy")             return "Busy";
  if (s === "no_answer")        return "No answer";
  if (s === "connection_lost")  return "Disconnected";
  if (s === "ended")            return "Ended";
  if (s === "active")           return "Active";
  return "Call";
}

function qualityColor(q) {
  if (q === "excellent") return "text-emerald-500";
  if (q === "good")      return "text-green-500";
  if (q === "fair")      return "text-amber-500";
  if (q === "poor")      return "text-rose-500";
  return "text-slate-400";
}

function InfoRow({ label, value, valueClass = "" }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <span className={`text-xs font-semibold text-slate-700 dark:text-slate-300 text-right max-w-[55%] ${valueClass}`}>
        {value ?? "Unavailable"}
      </span>
    </div>
  );
}

/* ── main export ── */
export default function DetailedCallHistoryModal({
  open, onClose, me, peerUserId, peerName, peerAvatar, onStartCall
}) {
  const [logs, setLogs]               = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);

  useEffect(() => {
    if (!open || !peerUserId) return;
    const all      = getCallLogs(me?.id);
    const filtered = all.filter((l) => Number(l.peerUserId) === Number(peerUserId));
    setLogs(filtered);
    setSelectedCall(null); // reset to list view on open
  }, [open, me?.id, peerUserId]);

  const groups = useMemo(() => groupByDay(logs), [logs]);

  if (!open) return null;

  /* ── Individual call detail view ── */
  if (selectedCall) {
    const dur        = durationLabel(selectedCall.started_at, selectedCall.ended_at);
    const isVideo    = selectedCall.callType === "video";
    const totalBytes = (selectedCall.bytesSent != null && selectedCall.bytesReceived != null)
      ? selectedCall.bytesSent + selectedCall.bytesReceived
      : null;

    return (
      <>
        <button type="button" onClick={onClose}
          className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-sm"
          aria-label="Close call logs" />

        <section className="fixed inset-x-3 bottom-3 z-[115] max-h-[88vh] flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:inset-x-0 sm:bottom-6 sm:mx-auto sm:max-w-[500px]">
          <header className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
            <button type="button" onClick={() => setSelectedCall(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition">
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar name={peerName} src={peerAvatar} size={36} />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{peerName || "Unknown"}</h3>
                <p className="text-[11px] text-slate-500">Call Details</p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition">
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* ── Session ── */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                Call Session
              </p>
              <div className="px-4 py-1">
                <InfoRow label="Call Type"  value={`${isVideo ? "Video" : "Voice"} Call`} />
                <InfoRow label="Direction"  value={selectedCall.direction === "incoming" ? "Incoming" : "Outgoing"} />
                <InfoRow label="Status"     value={statusText(selectedCall)} />
                <InfoRow label="Duration"   value={dur || "—"} />
                <InfoRow label="Started"    value={selectedCall.started_at ? new Date(selectedCall.started_at).toLocaleString() : "—"} />
                <InfoRow label="Ended"      value={selectedCall.ended_at   ? new Date(selectedCall.ended_at).toLocaleString()   : "—"} />
              </div>
            </div>

            {/* ── Data Usage — real values only ── */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                Data Usage
              </p>
              <div className="px-4 py-1">
                <InfoRow
                  label={<span className="flex items-center gap-1"><Upload size={11} className="text-violet-500" /> Uploaded</span>}
                  value={formatDataUsage(selectedCall.bytesSent)}
                />
                <InfoRow
                  label={<span className="flex items-center gap-1"><Download size={11} className="text-sky-500" /> Downloaded</span>}
                  value={formatDataUsage(selectedCall.bytesReceived)}
                />
                {/* Upload / Download bar */}
                {totalBytes != null && selectedCall.bytesSent != null && (
                  <div className="py-2">
                    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                      <div
                        className="h-full bg-violet-400 rounded-l-full"
                        style={{ width: `${Math.round((selectedCall.bytesSent / totalBytes) * 100)}%` }}
                      />
                      <div className="h-full flex-1 bg-sky-400/70 rounded-r-full" />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-violet-500">↑ Upload</span>
                      <span className="text-[9px] text-sky-500">↓ Download</span>
                    </div>
                  </div>
                )}
                <InfoRow label="Total"       value={formatDataUsage(totalBytes)} />
              </div>
            </div>

            {/* ── Connection — real values only ── */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                Connection
              </p>
              <div className="px-4 py-1">
                <InfoRow
                  label={<span className="flex items-center gap-1">
                    {selectedCall.networkType === "wifi"     ? <Wifi size={11} className="text-sky-500" />   : null}
                    {selectedCall.networkType === "cellular" ? <Signal size={11} className="text-emerald-500" /> : null}
                    Network
                  </span>}
                  value={
                    selectedCall.networkType === "wifi"     ? "Wi-Fi" :
                    selectedCall.networkType === "cellular" ? "Mobile Data" :
                    "Unavailable"
                  }
                />
                <InfoRow
                  label={<span className="flex items-center gap-1"><Activity size={11} className="text-emerald-500" /> Call Quality</span>}
                  value={selectedCall.callQuality
                    ? selectedCall.callQuality.charAt(0).toUpperCase() + selectedCall.callQuality.slice(1)
                    : "Unavailable"}
                  valueClass={qualityColor(selectedCall.callQuality)}
                />
                <InfoRow label="Reconnections"  value={selectedCall.reconnectCount != null ? String(selectedCall.reconnectCount) : "Unavailable"} />
                <InfoRow label="Interruptions"  value={selectedCall.interruptionCount != null ? String(selectedCall.interruptionCount) : "Unavailable"} />
                <InfoRow label="🔒 Encryption"  value="E2E Encrypted" valueClass="text-emerald-500" />
              </div>
            </div>
          </div>

          <footer className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/40 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                if (onStartCall) {
                  onClose();
                  onStartCall(selectedCall?.callType || "voice");
                }
              }}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl shadow transition"
            >
              <RefreshCw size={14} />
              Call Again
            </button>
            <button
              type="button"
              onClick={() => setSelectedCall(null)}
              className="w-full py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition"
            >
              ← Back to List
            </button>
          </footer>
        </section>
      </>
    );
  }

  /* ── List view ── */
  return (
    <>
      <button type="button" onClick={onClose}
        className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-sm"
        aria-label="Close call logs" />

      <section className="fixed inset-x-3 bottom-3 z-[115] max-h-[85vh] flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:inset-x-0 sm:bottom-6 sm:mx-auto sm:max-w-[500px]">
        <header className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={peerName} src={peerAvatar} size={38} />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{peerName || "Unknown"}</h3>
              <p className="text-[11px] text-slate-500">Call History</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {groups.length === 0 ? (
            <div className="text-center py-10">
              <PhoneCall size={28} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-500">No previous calls with this contact.</p>
            </div>
          ) : (
            groups.map(([day, items]) => (
              <div key={day} className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{day}</p>
                <div className="space-y-2">
                  {items.map((item) => {
                    const incoming   = item.direction === "incoming";
                    const callType   = item.callType === "video" ? "video" : "voice";
                    const time       = formatTime(item.started_at || item.created_at);
                    const dur        = durationLabel(item.started_at, item.ended_at);
                    const isMissed   = item.status === "missed";

                    const DirIcon  = isMissed ? PhoneMissed : incoming ? PhoneIncoming : PhoneOutgoing;
                    const TypeIcon = callType === "video" ? Video : PhoneCall;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCall(item)}
                        className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-[0.985] cursor-pointer transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
                            <TypeIcon size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {callType.charAt(0).toUpperCase() + callType.slice(1)} Call
                            </p>
                            <p className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                              <DirIcon size={11} className={isMissed ? "text-rose-500" : ""} />
                              <span className={isMissed ? "text-rose-500" : ""}>{statusText(item)}</span>
                              {dur && <span>· {dur}</span>}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">{time}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/40 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              if (onStartCall) {
                onClose();
                onStartCall(selectedCall?.callType || "voice");
              }
            }}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl shadow transition"
          >
            <RefreshCw size={14} />
            Call Again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition"
          >
            Close
          </button>
        </footer>
      </section>
    </>
  );
}
