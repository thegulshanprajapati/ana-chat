/**
 * RelationshipSection
 * ────────────────────
 * Shows and edits the user's relationship status, partner link,
 * couple mode toggle, and visibility settings.
 *
 * Props
 * ─────
 * me         User object
 * onUpdate   () => void   — called after any successful update
 */
import { useCallback, useEffect, useState } from "react";
import { Heart, Unlink, Send, Check, X, RefreshCw, Lock, Globe, Users } from "lucide-react";
import { api } from "../../api/client";
import Avatar from "../common/Avatar";

const STATUS_OPTIONS = [
  { value: "single",          label: "Single",            emoji: "😊" },
  { value: "in_relationship", label: "In a relationship", emoji: "❤️" },
  { value: "engaged",         label: "Engaged",           emoji: "💍" },
  { value: "married",         label: "Married",           emoji: "💑" },
  { value: "prefer_not_say",  label: "Prefer not to say", emoji: "🤐" },
];

const VIS_OPTIONS = [
  { value: "everyone",  label: "Everyone",        Icon: Globe },
  { value: "contacts",  label: "Contacts only",   Icon: Users },
  { value: "nobody",    label: "Nobody",           Icon: Lock },
];

export default function RelationshipSection({ me }) {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [partnerInput, setPartnerInput] = useState("");
  const [sendingReq, setSendingReq] = useState(false);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get("/users/relationship/status");
      setData(d);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (patch) => {
    setSaving(true);
    try {
      await api.post("/users/relationship/status", patch);
      setData((prev) => ({ ...prev, ...patch }));
      showToast("Saved!", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save", "error");
    } finally { setSaving(false); }
  };

  const sendPartnerRequest = async () => {
    const id = parseInt(partnerInput.trim(), 10);
    if (!id) return showToast("Enter a valid User ID", "error");
    setSendingReq(true);
    try {
      await api.post("/users/relationship-request", { partnerId: id });
      setPartnerInput("");
      showToast("Partner request sent!", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to send request", "error");
    } finally { setSendingReq(false); }
  };

  const acceptRequest = async (requesterId) => {
    try {
      await api.post("/users/relationship-request/accept", { requesterId });
      showToast("Partner linked! 💑", "success");
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to accept", "error");
    }
  };

  const declineRequest = async (requesterId) => {
    try {
      await api.post("/users/relationship-request/decline", { requesterId });
      showToast("Request declined", "info");
      load();
    } catch { showToast("Failed to decline", "error"); }
  };

  const unlink = async () => {
    if (!window.confirm("Remove partner link? Both users will be unlinked.")) return;
    try {
      await api.post("/users/relationship-request/unlink");
      showToast("Partner unlinked", "info");
      load();
    } catch { showToast("Failed to unlink", "error"); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw size={20} className="text-violet-400 animate-spin" />
      </div>
    );
  }

  const pendingReceived = (data?.pendingRequests || []).filter((r) => r.recipient_id === me?.id);
  const pendingSent     = (data?.pendingRequests || []).filter((r) => r.requester_id === me?.id);

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`rounded-2xl px-4 py-2.5 text-sm font-medium text-center ${
          toast.type === "success" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
          toast.type === "error"   ? "bg-rose-500/15 text-rose-400 border border-rose-500/20" :
          "bg-violet-500/15 text-violet-300 border border-violet-500/20"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Relationship Status ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/8 bg-slate-50 dark:bg-white/[0.02]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Relationship Status</p>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {STATUS_OPTIONS.map((opt) => {
            const selected = data?.relationshipStatus === opt.value
              || (opt.value === "in_relationship" && data?.relationshipStatus === "relationship");
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => save({ relationshipStatus: opt.value })}
                disabled={saving}
                className={`
                  flex items-center gap-2 p-3 rounded-xl text-sm font-semibold transition active:scale-95
                  ${selected
                    ? "bg-violet-600 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
                    : "border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20"}
                `}
              >
                <span className="text-lg leading-none">{opt.emoji}</span>
                <span className="text-xs leading-tight text-left">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Visibility ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/8 bg-slate-50 dark:bg-white/[0.02]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Status Visibility</p>
        </div>
        <div className="p-4 flex gap-2">
          {VIS_OPTIONS.map(({ value, label, Icon }) => {
            const selected = (data?.relationshipVisibility || "contacts") === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => save({ relationshipVisibility: value })}
                disabled={saving}
                className={`
                  flex flex-1 flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-semibold transition active:scale-95
                  ${selected
                    ? "bg-violet-600 text-white"
                    : "border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"}
                `}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Partner Link ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/8 bg-slate-50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Heart size={14} className="text-rose-500" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Partner Link</p>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {data?.partner ? (
            /* Linked partner */
            <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/8 border border-rose-200 dark:border-rose-500/20">
              <Avatar name={data.partner.name} src={data.partner.avatar_url} size={44} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{data.partner.name}</p>
                <p className="text-xs text-rose-500 font-medium">💑 Linked Partner</p>
              </div>
              <button
                type="button"
                onClick={unlink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 text-xs font-bold hover:bg-rose-200 dark:hover:bg-rose-500/25 transition"
              >
                <Unlink size={13} />
                Unlink
              </button>
            </div>
          ) : (
            /* Send partner request */
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter your partner's User ID to send a link request. Both users must accept.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={partnerInput}
                  onChange={(e) => setPartnerInput(e.target.value)}
                  placeholder="Partner's User ID"
                  className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-violet-500/60"
                />
                <button
                  type="button"
                  onClick={sendPartnerRequest}
                  disabled={sendingReq || !partnerInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold disabled:opacity-40 transition"
                >
                  {sendingReq ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  Send
                </button>
              </div>

              {/* Sent requests */}
              {pendingSent.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sent Requests</p>
                  {pendingSent.map((r) => (
                    <div key={r.requester_id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-white/8 bg-slate-50 dark:bg-white/[0.02]">
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        To User #{r.recipient_id}
                      </p>
                      <span className="text-[10px] text-amber-500 font-bold">Pending</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Incoming requests */}
          {pendingReceived.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Incoming Requests</p>
              {pendingReceived.map((r) => (
                <div key={r.requester_id} className="flex items-center justify-between p-3 rounded-xl border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/5">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {r.requester_name || `User #${r.requester_id}`}
                    </p>
                    <p className="text-[10px] text-slate-500">wants to link as partner</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => acceptRequest(r.requester_id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition"
                      aria-label="Accept"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => declineRequest(r.requester_id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600 text-white transition"
                      aria-label="Decline"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Couple Mode (only if linked) ── */}
      {data?.partner && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/5 overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">💑</span>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Couple Mode</p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Show couple badge & effects during calls with your partner
              </p>
            </div>
            <button
              type="button"
              onClick={() => save({ coupleModeEnabled: !data?.coupleModeEnabled })}
              disabled={saving}
              className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                data?.coupleModeEnabled
                  ? "bg-rose-500"
                  : "bg-slate-300 dark:bg-slate-700"
              }`}
              aria-pressed={data?.coupleModeEnabled}
            >
              <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                data?.coupleModeEnabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
