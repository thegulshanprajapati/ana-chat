/**
 * CallMomentButton
 * ─────────────────
 * Lets users manually mark a special moment during a call.
 * Stored in component state array — not persisted unless user saves.
 *
 * Props
 * ─────
 * onMoment  ({ timestamp, reaction, label }) => void
 * lastEmoji string | null  — last reaction sent (shown as moment emoji)
 */
import { useState } from "react";
import { Heart, CheckCircle } from "lucide-react";

export default function CallMomentButton({ onMoment, lastEmoji }) {
  const [pulse, setPulse] = useState(false);

  const handleMoment = () => {
    const moment = {
      timestamp: new Date().toISOString(),
      reaction:  lastEmoji || "❤️",
      label:     "Moment",
    };
    onMoment?.(moment);
    setPulse(true);
    setTimeout(() => setPulse(false), 1200);
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleMoment}
        className={`
          relative flex h-12 w-12 items-center justify-center rounded-full
          transition-all duration-150 hover:scale-105 active:scale-95
          ${pulse
            ? "bg-rose-600/80 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
            : "bg-white/15 text-white/80 hover:bg-white/25"}
        `}
        title="Mark moment"
        aria-label="Mark call moment"
      >
        {pulse
          ? <CheckCircle size={20} className="text-white" />
          : <Heart size={20} className={lastEmoji ? "fill-rose-400 text-rose-400" : ""} />}
        {pulse && (
          <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
        )}
      </button>
      <span className="text-[10px] text-white/50 leading-none">Moment</span>
    </div>
  );
}
