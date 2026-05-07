import { useEffect, useMemo, useState } from "react";
import { Flag, ShieldAlert, UserCheck, UserMinus, X } from "lucide-react";
import Avatar from "../common/Avatar";
import { formatDayLabel, formatTime } from "../../utils/time";

const REPORT_REASONS = [
  { id: "spam", label: "Spam" },
  { id: "abuse", label: "Abuse" },
  { id: "harassment", label: "Harassment" },
  { id: "fake_profile", label: "Fake profile" },
  { id: "scam", label: "Scam" },
  { id: "other", label: "Other" }
];

function deriveUsername(partner) {
  const explicit = (partner?.username || "").toString().trim();
  if (explicit) return explicit.startsWith("@") ? explicit : `@${explicit}`;

  const email = (partner?.email || "").toString().trim();
  if (email && email.includes("@")) return `@${email.split("@")[0]}`;

  const mobile = (partner?.mobile || "").toString().replace(/\D/g, "");
  if (mobile) return `@user${mobile.slice(-6)}`;

  if (partner?.id) return `@user${partner.id}`;
  return "@user";
}

function lastActiveText(partner, nowMs, isGroup = false, memberCount = 0) {
  if (isGroup) return memberCount ? `${memberCount} members` : "Group chat";

  const statusUpdatedAtMs = (() => {
    const raw = partner?.status_updated_at;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw) {
      const parsed = new Date(raw).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  })();
  const onlineFresh = statusUpdatedAtMs ? (Number(nowMs) - statusUpdatedAtMs < 2 * 60 * 1000) : false;
  if (partner?.status === "online" && onlineFresh) return "Online now";
  if (!partner?.last_seen) return "Last active unavailable";

  const day = formatDayLabel(partner.last_seen);
  const time = formatTime(partner.last_seen);
  if (!day || !time) return "Last active unavailable";
  if (day === "Today") return `Last active today at ${time}`;
  if (day === "Yesterday") return `Last active yesterday at ${time}`;
  return `Last active ${day}, ${time}`;
}

export default function PartnerProfileSheet({
  open,
  onClose,
  partner,
  isGroup = false,
  memberCount = 0,
  blockedByMe = false,
  blockedMe = false,
  blockActionBusy = false,
  onBlockUser,
  onUnblockUser,
  onReportUser,
  reportBusy = false
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const username = useMemo(() => deriveUsername(partner), [partner]);
  const statusLine = useMemo(() => lastActiveText(partner, nowMs, isGroup, memberCount), [isGroup, memberCount, nowMs, partner]);
  const online = useMemo(() => statusLine === "Online now", [statusLine]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-stretch justify-end">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55"
        aria-label="Close profile panel"
      />

      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-slate-800/80">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Profile</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Contact details</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <Avatar name={partner?.name} src={partner?.avatar_url} size={64} />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{partner?.name || "Unknown"}</p>
                <p className="truncate text-sm text-violet-700 dark:text-violet-300">{username}</p>
                <p className={`mt-1 text-xs ${online ? "text-emerald-500" : "text-slate-500 dark:text-slate-400"}`}>
                  {statusLine}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <InfoRow label="Email" value={partner?.email || "Not shared"} />
              <InfoRow label="Mobile" value={partner?.mobile || "Not shared"} />
              <InfoRow label="Status" value={online ? "Online" : "Offline"} />
            </div>

            {!isGroup && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  About
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700 dark:text-slate-200">
                  {(partner?.about || "").toString().trim() || "No bio added yet."}
                </p>
              </div>
            )}
          </div>

          {!isGroup && (
            <div className="mt-4 space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-700/80 dark:bg-slate-900/70">
              {blockedByMe ? (
                <button
                  type="button"
                  onClick={onUnblockUser}
                  disabled={blockActionBusy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
                >
                  <UserCheck size={15} />
                  {blockActionBusy ? "Unblocking..." : "Unblock user"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = window.confirm("Block this user? You will not be able to send messages or calls until you unblock.");
                    if (!ok) return;
                    await onBlockUser?.();
                  }}
                  disabled={blockActionBusy || blockedMe}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
                >
                  <UserMinus size={15} />
                  {blockActionBusy ? "Blocking..." : "Block user"}
                </button>
              )}

              {blockedByMe && (
                <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  This contact is currently blocked by you.
                </p>
              )}
              {!blockedByMe && blockedMe && (
                <p className="rounded-lg border border-rose-300/70 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                  This user has blocked you.
                </p>
              )}
            </div>
          )}

          {!isGroup && (
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-700/80 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={() => setReportOpen((prev) => !prev)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/15"
              >
                <Flag size={15} />
                {reportOpen ? "Close report form" : "Report user"}
              </button>

              {reportOpen && (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await onReportUser?.({ reason, details: details.trim() });
                    setReportOpen(false);
                    setReason("spam");
                    setDetails("");
                  }}
                >
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Reason</span>
                    <select
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-500"
                    >
                      {REPORT_REASONS.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Details (optional)</span>
                    <textarea
                      value={details}
                      onChange={(event) => setDetails(event.target.value.slice(0, 1000))}
                      rows={4}
                      className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-500"
                      placeholder="Describe what happened..."
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={reportBusy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ShieldAlert size={15} />
                    {reportBusy ? "Submitting..." : "Submit report"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <p className="flex items-start justify-between gap-2 rounded-lg border border-slate-200/70 bg-white/70 px-2.5 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200">
      <span className="shrink-0 font-semibold uppercase tracking-[0.1em] text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="min-w-0 break-all text-right">{value}</span>
    </p>
  );
}
