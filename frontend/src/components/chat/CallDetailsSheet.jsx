/**
 * CallDetailsSheet
 * ─────────────────
 * Bottom sheet (mobile) / centered modal (desktop) that shows full
 * details for a single call history entry.
 *
 * Props
 * ─────
 * open         boolean
 * onClose      () => void
 * callLog      CallLogEntry | null
 * me           User object
 * onCallAgain  (callType: "voice"|"video") => void
 * onViewHistory () => void
 * onViewProfile () => void
 */
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Phone, Video, PhoneIncoming, PhoneOutgoing,
  PhoneMissed, Clock, Upload, Download, Wifi, Signal,
  Activity, Heart, User, History, RefreshCw
} from "lucide-react";
import Avatar from "../common/Avatar";
import { formatDataUsage } from "../../hooks/useCallStats";

/* ── helpers ── */
function fmtDuration(startedAt, endedAt) {
  const s = startedAt ? new Date(startedAt).getTime() : NaN;
  const e = endedAt   ? new Date(endedAt).getTime()   : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  const total = Math.round((e - s) / 1000);
  const mins  = Math.floor(total / 60);
  const secs  = total % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch { return "—"; }
}

function statusLabel(item) {
  const s = (item?.status || "").toString();
  if (s === "missed")           return { text: "Missed",       color: "text-rose-500" };
  if (s === "rejected")         return { text: "Declined",     color: "text-rose-400" };
  if (s === "busy")             return { text: "Busy",         color: "text-amber-400" };
  if (s === "no_answer")        return { text: "No Answer",    color: "text-amber-400" };
  if (s === "connection_lost")  return { text: "Disconnected", color: "text-slate-400" };
  if (s === "ended")            return { text: "Ended",        color: "text-emerald-400" };
  if (s === "active")           return { text: "Active",       color: "text-emerald-400" };
  return { text: s || "Call",   color: "text-slate-300" };
}

function qualityColor(q) {
  if (q === "excellent") return "text-emerald-400";
  if (q === "good")      return "text-green-400";
  if (q === "fair")      return "text-amber-400";
  if (q === "poor")      return "text-rose-400";
  return "text-slate-400";
}

function networkIcon(type) {
  if (type === "wifi")     return <Wifi size={14} className="text-sky-400" />;
  if (type === "cellular") return <Signal size={14} className="text-emerald-400" />;
  return null;
}

/* ── row helper ── */
function InfoRow({ label, value, valueClass = "" }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <span className={`text-xs font-semibold text-slate-200 text-right max-w-[60%] ${valueClass}`}>
        {value ?? "Unavailable"}
      </span>
    </div>
  );
}

/* ── main component ── */
export default function CallDetailsSheet({
  open, onClose, callLog, onCallAgain, onViewHistory, onViewProfile
}) {
  const backdropRef = useRef(null);

  // Keyboard: Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!callLog) return null;

  const status   = statusLabel(callLog);
  const duration = fmtDuration(callLog.started_at, callLog.ended_at);
  const isVideo  = callLog.callType === "video";
  const isIncoming = callLog.direction === "incoming";

  const totalBytes = (callLog.bytesSent != null && callLog.bytesReceived != null)
    ? callLog.bytesSent + callLog.bytesReceived
    : null;

  const DirectionIcon = callLog.status === "missed"
    ? PhoneMissed
    : isIncoming ? PhoneIncoming : PhoneOutgoing;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            ref={backdropRef}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Sheet / Modal */}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Call details with ${callLog.peerName || "Unknown"}`}
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className={`
              fixed z-[201] overflow-hidden
              /* mobile: bottom sheet */
              bottom-0 left-0 right-0 rounded-t-3xl
              /* desktop: center modal */
              sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2
              sm:-translate-x-1/2 sm:-translate-y-1/2
              sm:w-[480px] sm:rounded-3xl
              bg-slate-950 border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.7)]
              max-h-[90dvh] flex flex-col
            `}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* ── Header ── */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-white/8">
              <div className="relative">
                <Avatar name={callLog.peerName} src={callLog.peerAvatar} size={52} />
                <div className="absolute -bottom-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-slate-900 border border-white/10">
                  {isVideo
                    ? <Video size={11} className="text-violet-400" />
                    : <Phone size={11} className="text-emerald-400" />}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white truncate">
                  {callLog.peerName || "Unknown"}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <DirectionIcon size={12} className={status.color} />
                  <span className={`text-xs font-semibold ${status.color}`}>{status.text}</span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-400 capitalize">
                    {isIncoming ? "Incoming" : "Outgoing"} {isVideo ? "Video" : "Voice"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Scrollable Content ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Duration banner */}
              {duration && (
                <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white/5 border border-white/8">
                  <Clock size={18} className="text-violet-400 shrink-0" />
                  <div className="text-center">
                    <p className="text-xl font-bold text-white">{duration}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Call duration</p>
                  </div>
                </div>
              )}

              {/* ── Session Details ── */}
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/6 bg-white/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Call Session
                  </p>
                </div>
                <div className="px-4 py-1">
                  <InfoRow label="Call Type"  value={`${isVideo ? "Video" : "Voice"} Call`} />
                  <InfoRow label="Direction"  value={isIncoming ? "Incoming" : "Outgoing"} />
                  <InfoRow
                    label="Status"
                    value={status.text}
                    valueClass={status.color}
                  />
                  <InfoRow label="Started"    value={fmtDateTime(callLog.started_at)} />
                  <InfoRow label="Ended"      value={fmtDateTime(callLog.ended_at)} />
                  <InfoRow label="Duration"   value={duration || "—"} />
                </div>
              </div>

              {/* ── Data Usage ── */}
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/6 bg-white/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Data Usage
                  </p>
                </div>
                <div className="px-4 py-1">
                  <InfoRow
                    label={<span className="flex items-center gap-1.5"><Upload size={12} className="text-violet-400" />Uploaded</span>}
                    value={formatDataUsage(callLog.bytesSent)}
                  />
                  <InfoRow
                    label={<span className="flex items-center gap-1.5"><Download size={12} className="text-sky-400" />Downloaded</span>}
                    value={formatDataUsage(callLog.bytesReceived)}
                  />
                  {/* Progress bar */}
                  {totalBytes != null && callLog.bytesSent != null && (
                    <div className="py-2">
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden flex">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all"
                          style={{ width: `${Math.round((callLog.bytesSent / totalBytes) * 100)}%` }}
                        />
                        <div className="h-full flex-1 rounded-full bg-sky-500/60" />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] text-violet-400">↑ Upload</span>
                        <span className="text-[10px] text-sky-400">↓ Download</span>
                      </div>
                    </div>
                  )}
                  <InfoRow label="Total"      value={formatDataUsage(totalBytes)} valueClass="text-white" />
                </div>
              </div>

              {/* ── Connection ── */}
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/6 bg-white/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Connection
                  </p>
                </div>
                <div className="px-4 py-1">
                  <InfoRow
                    label={<span className="flex items-center gap-1.5">
                      {networkIcon(callLog.networkType)}&nbsp;Network
                    </span>}
                    value={
                      callLog.networkType === "wifi"     ? "Wi-Fi" :
                      callLog.networkType === "cellular" ? "Mobile Data" :
                      "Unavailable"
                    }
                  />
                  <InfoRow
                    label={<span className="flex items-center gap-1.5"><Activity size={12} className="text-emerald-400" />Quality</span>}
                    value={callLog.callQuality
                      ? callLog.callQuality.charAt(0).toUpperCase() + callLog.callQuality.slice(1)
                      : "Unavailable"}
                    valueClass={qualityColor(callLog.callQuality)}
                  />
                  <InfoRow
                    label="Reconnections"
                    value={callLog.reconnectCount != null ? String(callLog.reconnectCount) : "Unavailable"}
                  />
                  <InfoRow
                    label="Interruptions"
                    value={callLog.interruptionCount != null ? String(callLog.interruptionCount) : "Unavailable"}
                  />
                  <InfoRow
                    label="🔒 Encryption"
                    value="E2E Encrypted"
                    valueClass="text-emerald-400"
                  />
                </div>
              </div>

              {/* Call Moments */}
              {callLog.moments && callLog.moments.length > 0 && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mb-2">
                    Call Moments
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {callLog.moments.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
                        <span className="text-sm">{m.reaction || "❤️"}</span>
                        <span className="text-[10px] text-rose-300">{m.label || "Moment"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer Actions ── */}
            <div className="border-t border-white/8 px-5 py-4 grid grid-cols-3 gap-2 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => onCallAgain?.(callLog.callType || "voice")}
                className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white transition active:scale-95 font-semibold shadow-[0_4px_20px_rgba(139,92,246,0.3)]"
              >
                <RefreshCw size={18} />
                <span className="text-[10px] font-bold">Call Again</span>
              </button>

              <button
                type="button"
                onClick={() => { onClose(); onViewHistory?.(); }}
                className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-2xl bg-white/8 hover:bg-white/15 text-white/80 transition active:scale-95"
              >
                <History size={18} />
                <span className="text-[10px] font-bold">Call History</span>
              </button>

              <button
                type="button"
                onClick={() => { onClose(); onViewProfile?.(); }}
                className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-2xl bg-white/8 hover:bg-white/15 text-white/80 transition active:scale-95"
              >
                <User size={18} />
                <span className="text-[10px] font-bold">View Profile</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
