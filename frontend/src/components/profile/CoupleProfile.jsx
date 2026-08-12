/**
 * CoupleProfile
 * ──────────────
 * Shows couple badge, together-since date, and couple effects toggle.
 * Intended for use inside the user's own profile/settings panel.
 *
 * Props
 * ─────
 * partnerName       string
 * partnerAvatar     string | null
 * togetherSince     ISO date string | null
 * coupleModeEnabled boolean
 * onToggle          () => void
 */
import { Heart, Calendar } from "lucide-react";
import Avatar from "../common/Avatar";

function togetherSinceLabel(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const now = new Date();
    const days = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Since today";
    if (days === 1) return "Since yesterday";
    if (days < 30) return `${days} days together`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? "s" : ""} together`;
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? "s" : ""} together`;
  } catch { return null; }
}

export default function CoupleProfile({
  myName,
  myAvatar,
  partnerName,
  partnerAvatar,
  togetherSince,
  coupleModeEnabled,
  onToggle,
}) {
  if (!partnerName) return null;

  const sinceLabel = togetherSinceLabel(togetherSince);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-rose-200 dark:border-rose-500/20 bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-rose-950/30 dark:via-slate-950 dark:to-pink-950/20 p-5 space-y-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-rose-300/20 dark:bg-rose-500/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-pink-300/20 dark:bg-pink-500/10 blur-3xl" />
      </div>

      {/* Avatars + heart */}
      <div className="relative flex items-center justify-center gap-4 py-2">
        <div className="flex flex-col items-center gap-1.5">
          <Avatar name={myName} src={myAvatar} size={56} />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[72px]">{myName || "You"}</p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <Heart size={22} className="text-rose-500 fill-rose-500 animate-pulse" />
          <span className="text-[10px] text-rose-400 font-bold">Couple</span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <Avatar name={partnerName} src={partnerAvatar} size={56} />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[72px]">{partnerName}</p>
        </div>
      </div>

      {/* Together since */}
      {sinceLabel && (
        <div className="flex items-center justify-center gap-2">
          <Calendar size={13} className="text-rose-400" />
          <p className="text-xs text-rose-500 dark:text-rose-300 font-semibold">{sinceLabel}</p>
        </div>
      )}

      {/* Couple Mode toggle */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Couple Mode</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Show badge & effects in calls</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`relative flex h-6 w-11 items-center rounded-full transition ${
            coupleModeEnabled ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-700"
          }`}
          aria-pressed={coupleModeEnabled}
          aria-label="Toggle couple mode"
        >
          <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
            coupleModeEnabled ? "translate-x-6" : "translate-x-1"
          }`} />
        </button>
      </div>
    </div>
  );
}
