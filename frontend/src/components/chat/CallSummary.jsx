/**
 * CallSummary
 * ─────────────
 * Polished post-call summary screen shown after a call ends.
 * Slides up over the call background, auto-dismisses after 15 seconds.
 *
 * Props
 * ─────
 * open          boolean
 * callSnapshot  { peerName, peerAvatar, callType, duration, bytesSent,
 *                 bytesReceived, networkType, callQuality, moments }
 * onCallAgain   (callType: "voice"|"video") => void
 * onMessage     () => void
 * onViewDetails () => void
 * onViewProfile () => void
 * onClose       () => void
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Video, MessageSquare, User, RefreshCw,
  Clock, Upload, Download, Wifi, Signal, Activity,
  Heart, Star
} from "lucide-react";
import Avatar from "../common/Avatar";
import { formatDataUsage } from "../../hooks/useCallStats";

const AUTO_DISMISS_MS = 15000;

function qualityColor(q) {
  if (q === "excellent") return "text-emerald-400";
  if (q === "good")      return "text-green-400";
  if (q === "fair")      return "text-amber-400";
  if (q === "poor")      return "text-rose-400";
  return "text-slate-400";
}

export default function CallSummary({
  open,
  callSnapshot,
  onCallAgain,
  onMessage,
  onViewDetails,
  onViewProfile,
  onClose,
}) {
  const timerRef = useRef(null);
  const [remaining, setRemaining] = useState(AUTO_DISMISS_MS / 1000);

  useEffect(() => {
    if (!open) { setRemaining(AUTO_DISMISS_MS / 1000); return; }

    let secs = AUTO_DISMISS_MS / 1000;
    setRemaining(secs);

    const countdown = setInterval(() => {
      secs -= 1;
      setRemaining(secs);
      if (secs <= 0) {
        clearInterval(countdown);
        onClose?.();
      }
    }, 1000);
    timerRef.current = countdown;

    return () => clearInterval(countdown);
  }, [open, onClose]);

  if (!callSnapshot) return null;

  const {
    peerName, peerAvatar, callType, duration,
    bytesSent, bytesReceived, networkType, callQuality,
    moments = []
  } = callSnapshot;

  const totalBytes = (bytesSent != null && bytesReceived != null)
    ? bytesSent + bytesReceived : null;
  const isVideo = callType === "video";
  const momentCount = Array.isArray(moments) ? moments.length : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="call-summary"
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 280 }}
          className="fixed inset-0 z-[95] flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden"
          aria-label="Call summary"
        >
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-violet-500/5 blur-[120px]" />
            <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-rose-500/5 blur-[120px]" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-start flex-1 overflow-y-auto px-6 pt-16 pb-8 gap-6">

            {/* Avatar + name */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-white/5 blur-xl" />
                <Avatar name={peerName} src={peerAvatar} size={100} />
                {/* call type badge */}
                <div className="absolute bottom-0 right-0 h-8 w-8 flex items-center justify-center rounded-full bg-slate-900 border-2 border-white/10 shadow-lg">
                  {isVideo ? <Video size={16} className="text-violet-400" /> : <Phone size={16} className="text-emerald-400" />}
                </div>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-white">{peerName || "Unknown"}</p>
                <p className="text-sm text-slate-400 mt-0.5">{isVideo ? "Video call" : "Voice call"} ended</p>
              </div>
            </motion.div>

            {/* Duration hero */}
            {duration && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-2xl px-6 py-4 w-full max-w-xs"
              >
                <Clock size={24} className="text-violet-400 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-white tabular-nums">{duration}</p>
                  <p className="text-xs text-slate-400">Call duration</p>
                </div>
              </motion.div>
            )}

            {/* Stats grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full max-w-md grid grid-cols-2 gap-3"
            >
              {/* Data used */}
              <div className="flex flex-col gap-1.5 bg-white/5 border border-white/8 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Data Used</p>
                <p className="text-lg font-bold text-white">{formatDataUsage(totalBytes)}</p>
                {totalBytes != null && (
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-violet-400 flex items-center gap-1">
                      <Upload size={9} /> {formatDataUsage(bytesSent)}
                    </span>
                    <span className="text-[10px] text-sky-400 flex items-center gap-1">
                      <Download size={9} /> {formatDataUsage(bytesReceived)}
                    </span>
                  </div>
                )}
              </div>

              {/* Quality */}
              <div className="flex flex-col gap-1.5 bg-white/5 border border-white/8 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quality</p>
                <p className={`text-lg font-bold ${qualityColor(callQuality)}`}>
                  {callQuality
                    ? callQuality.charAt(0).toUpperCase() + callQuality.slice(1)
                    : "Unavailable"}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {networkType === "wifi"     ? <Wifi size={11} className="text-sky-400" />   : null}
                  {networkType === "cellular" ? <Signal size={11} className="text-emerald-400" /> : null}
                  <span className="text-[10px] text-slate-500">
                    {networkType === "wifi" ? "Wi-Fi" : networkType === "cellular" ? "Mobile" : "—"}
                  </span>
                </div>
              </div>

              {/* Moments */}
              {momentCount > 0 && (
                <div className="flex flex-col gap-1.5 bg-rose-500/5 border border-rose-500/15 rounded-2xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Moments</p>
                  <p className="text-lg font-bold text-white">{momentCount}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {moments.slice(0, 4).map((m, i) => (
                      <span key={i} className="text-sm">{m.reaction || "❤️"}</span>
                    ))}
                    {momentCount > 4 && <span className="text-[10px] text-rose-300">+{momentCount - 4}</span>}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="w-full max-w-md grid grid-cols-2 gap-3"
            >
              <button
                type="button"
                onClick={() => { onClose(); onCallAgain?.(callType || "voice"); }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition active:scale-95 shadow-[0_4px_24px_rgba(139,92,246,0.35)]"
              >
                <RefreshCw size={16} />
                Call Again
              </button>

              <button
                type="button"
                onClick={() => { onClose(); onMessage?.(); }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition active:scale-95 border border-white/10"
              >
                <MessageSquare size={16} />
                Message
              </button>

              <button
                type="button"
                onClick={() => { onClose(); onViewDetails?.(); }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/8 hover:bg-white/12 text-white/80 font-semibold text-sm transition active:scale-95 border border-white/8"
              >
                <Activity size={16} />
                View Details
              </button>

              <button
                type="button"
                onClick={() => { onClose(); onViewProfile?.(); }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/8 hover:bg-white/12 text-white/80 font-semibold text-sm transition active:scale-95 border border-white/8"
              >
                <User size={16} />
                View Profile
              </button>
            </motion.div>
          </div>

          {/* Auto-dismiss countdown */}
          <div className="relative z-10 pb-8 flex flex-col items-center gap-2">
            <p className="text-xs text-slate-500">Closing in {remaining}s</p>
            <div className="w-32 h-0.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-white/30 rounded-full"
                initial={{ width: "100%" }}
                animate={{ width: `${(remaining / (AUTO_DISMISS_MS / 1000)) * 100}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-300 transition mt-1 underline"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
