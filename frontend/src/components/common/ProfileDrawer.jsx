import { useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, X, User, Mail, Phone, Info, Lock, Heart } from "lucide-react";
import { api } from "../../api/client";
import AvatarUploader from "../profile/AvatarUploader";

export default function ProfileDrawer({ open, me, onClose, onSaved, notify }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [about, setAbout] = useState("");
  const [password, setPassword] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("single");
  const [partnerUserId, setPartnerUserId] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showGeneratedPassword, setShowGeneratedPassword] = useState(false);

  const fetchPendingRequests = async () => {
    try {
      const { data } = await api.get("/users/relationship-request/pending");
      setPendingRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch pending requests:", e);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPendingRequests();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setName(me?.name || "");
    setEmail(me?.email || "");
    setMobile(me?.mobile || "");
    setAbout((me?.about_bio || "").slice(0, 500));
    setPassword("");
    setRelationshipStatus(me?.relationship_status || "single");
    setPartnerUserId(me?.partner_user_id != null ? String(me.partner_user_id) : "");
    setShowGeneratedPassword(false);
  }, [open, me]);

  const handleCopyOwnId = async () => {
    try {
      await navigator.clipboard.writeText(String(me?.id));
      notify?.({ type: "success", message: "User ID copied!" });
    } catch {
      notify?.({ type: "error", message: "Failed to copy User ID." });
    }
  };

  const handleSendRequest = async () => {
    const targetId = Number(partnerUserId.trim());
    if (isNaN(targetId)) return;
    setActionBusy(true);
    try {
      await api.post("/users/relationship-request", { partnerId: targetId });
      notify?.({ type: "success", title: "Request Sent", message: "Relationship request sent successfully!" });
      setPartnerUserId("");
    } catch (err) {
      notify?.({
        type: "error",
        title: "Request Failed",
        message: err.response?.data?.message || "Could not send partnership request."
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleAcceptRequest = async (requesterId) => {
    setActionBusy(true);
    try {
      await api.post("/users/relationship-request/accept", { requesterId });
      notify?.({ type: "success", title: "Accepted!", message: "Partnership linked successfully!" });
      await fetchPendingRequests();
      onSaved?.(null); 
    } catch (err) {
      notify?.({
        type: "error",
        title: "Failed",
        message: err.response?.data?.message || "Could not accept request."
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeclineRequest = async (requesterId) => {
    setActionBusy(true);
    try {
      await api.post("/users/relationship-request/decline", { requesterId });
      notify?.({ type: "info", message: "Request declined." });
      await fetchPendingRequests();
    } catch (err) {
      notify?.({
        type: "error",
        message: "Failed to decline request."
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleUnlinkPartner = async () => {
    setActionBusy(true);
    try {
      await api.post("/users/relationship-request/unlink");
      notify?.({ type: "info", message: "Partnership unlinked successfully." });
      onSaved?.(null); 
    } catch (err) {
      notify?.({
        type: "error",
        message: "Could not unlink partnership."
      });
    } finally {
      setActionBusy(false);
    }
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("email", email.trim());
      form.append("mobile", mobile.trim());
      form.append("about", about.trim());
      form.append("relationship_status", relationshipStatus);
      form.append("partner_user_id", partnerUserId.trim());
      if (password.trim()) form.append("password", password.trim());

      const { data } = await api.patch("/users/me", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      notify?.({ type: "success", title: "Profile updated", message: "Your details were saved." });
      onSaved?.(data);
    } catch (err) {
      notify?.({
        type: "error",
        title: "Update failed",
        message: err.response?.data?.message || "Unable to save profile."
      });
    } finally {
      setSaving(false);
    }
  }

  async function copyGeneratedPassword() {
    if (!me?.generated_password) return;
    try {
      await navigator.clipboard.writeText(me.generated_password);
      notify?.({ type: "success", message: "Generated password copied." });
    } catch {
      notify?.({ type: "error", message: "Unable to copy generated password." });
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-stretch justify-end">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm transition-opacity"
        aria-label="Close profile drawer"
      />

      {/* Premium Drawer Container */}
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200/50 dark:border-white/5 bg-gradient-to-b from-slate-50 via-slate-100/50 to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 text-[var(--panel-text)] shadow-2xl transition-transform duration-300">
        
        {/* Header */}
        <div className="flex h-[72px] items-center gap-4 border-b border-slate-200/40 dark:border-white/5 bg-white/70 dark:bg-slate-900/30 px-6 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-200/50 dark:hover:bg-[var(--accent-soft-18)] text-slate-500 dark:text-[var(--panel-muted)] transition-colors"
            aria-label="Close profile drawer"
          >
            <X size={20} />
          </button>
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Profile Info
          </span>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 flex flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto space-y-5 px-6 py-6 scrollbar-thin">
            
            {/* Avatar / Profile Picture Section */}
            <div className="bg-white/80 dark:bg-slate-900/30 backdrop-blur-md border border-slate-200/40 dark:border-white/5 rounded-2xl p-6 flex flex-col items-center shadow-sm">
              <AvatarUploader
                currentAvatarUrl={me?.avatar_url}
                userName={name}
                onUploadSuccess={(newUrl) => {
                  onSaved?.({ ...me, avatar_url: newUrl }, true);
                }}
                notify={notify}
              />
              <div 
                onClick={handleCopyOwnId}
                className="mt-3 cursor-pointer select-none rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/40 dark:border-white/5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-[var(--accent)] transition-all font-semibold"
                title="Click to copy your User ID"
              >
                Your ID: <span className="font-mono text-[var(--accent)] font-bold">{me?.id || "N/A"}</span> 📋
              </div>
            </div>

            {/* Inputs Card */}
            <div className="bg-white/80 dark:bg-slate-900/30 backdrop-blur-md border border-slate-200/40 dark:border-white/5 rounded-2xl p-5 space-y-4 shadow-sm">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 dark:text-[var(--panel-muted)] flex items-center gap-1.5 uppercase tracking-wider">
                  <User size={13} className="text-violet-500" /> Full name
                </label>
                <input
                  className="w-full rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 text-[var(--panel-text)] px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 dark:focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:focus:ring-violet-500/20"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  aria-label="Full name"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 dark:text-[var(--panel-muted)] flex items-center gap-1.5 uppercase tracking-wider">
                  <Mail size={13} className="text-violet-500" /> Email address
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 text-[var(--panel-text)] px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 dark:focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:focus:ring-violet-500/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-label="Email address"
                />
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 dark:text-[var(--panel-muted)] flex items-center gap-1.5 uppercase tracking-wider">
                  <Phone size={13} className="text-violet-500" /> Mobile number
                </label>
                <input
                  className="w-full rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 text-[var(--panel-text)] px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 dark:focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:focus:ring-violet-500/20"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  aria-label="Mobile number"
                />
              </div>

              {/* About / Bio */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-bold text-slate-500 dark:text-[var(--panel-muted)] flex items-center gap-1.5 uppercase tracking-wider">
                    <Info size={13} className="text-violet-500" /> About / Bio
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-[var(--panel-muted)] font-mono font-semibold">{about.length}/500</span>
                </div>
                <textarea
                  className="w-full rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 text-[var(--panel-text)] px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 dark:focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:focus:ring-violet-500/20 min-h-[92px] resize-none"
                  value={about}
                  onChange={(e) => setAbout(e.target.value.slice(0, 500))}
                  placeholder="Write something about yourself..."
                  aria-label="About or bio"
                />
              </div>
            </div>

            {/* Relationship Card */}
            <div className="bg-white/80 dark:bg-slate-900/30 backdrop-blur-md border border-slate-200/40 dark:border-white/5 rounded-2xl p-5 space-y-4 shadow-sm">
              <label className="text-[12px] font-bold text-slate-500 dark:text-[var(--panel-muted)] flex items-center gap-1.5 uppercase tracking-wider">
                <Heart size={13} className="text-rose-500 fill-rose-500 animate-pulse" /> Relationship Info
              </label>

              {/* Display current relationship status */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/40 p-3.5 border border-slate-100 dark:border-slate-850 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold">Your Status:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">
                    {me?.relationship_status || "Single"}
                  </span>
                </div>
                {me?.partner_user_id && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">Partner ID:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{me.partner_user_id}</span>
                  </div>
                )}
              </div>

              {/* Link relationship section */}
              {me?.partner_user_id ? (
                /* Already Linked: option to Unlink */
                <button
                  type="button"
                  onClick={handleUnlinkPartner}
                  disabled={actionBusy}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {actionBusy ? "Unlinking..." : "Unlink / Break Partnership 💔"}
                </button>
              ) : (
                /* Unlinked: option to send request */
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Send Partnership Request (Partner's ID)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="e.g. 1234"
                        value={partnerUserId}
                        onChange={(e) => setPartnerUserId(e.target.value)}
                        className="flex-1 min-w-0 rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 text-[var(--panel-text)] px-3 py-2 text-xs outline-none transition focus:border-violet-500 dark:focus:border-violet-500"
                        aria-label="Partner User ID"
                      />
                      <button
                        type="button"
                        onClick={handleSendRequest}
                        disabled={actionBusy || !partnerUserId.trim()}
                        className="py-2 px-3.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50"
                      >
                        {actionBusy ? "Sending..." : "Send ❤️"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Requests section */}
              {pendingRequests.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200/40 dark:border-white/5">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Pending Partnership Requests</p>
                  <div className="space-y-2">
                    {pendingRequests.map((req) => (
                      <div key={req.requester_id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{req.requester_name || "Someone"}</p>
                          <p className="text-[10px] text-slate-400">ID: {req.requester_id}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(req.requester_id)}
                            disabled={actionBusy}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] shadow transition"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineRequest(req.requester_id)}
                            disabled={actionBusy}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px] shadow transition"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Security / Password Card */}
            <div className="bg-white/80 dark:bg-slate-900/30 backdrop-blur-md border border-slate-200/40 dark:border-white/5 rounded-2xl p-5 space-y-4 shadow-sm">
              
              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 dark:text-[var(--panel-muted)] flex items-center gap-1.5 uppercase tracking-wider">
                  <Lock size={13} className="text-violet-500" /> New Password
                </label>
                <input
                  type="password"
                  placeholder="Enter new password to change"
                  className="w-full rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 text-[var(--panel-text)] px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 dark:focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:focus:ring-violet-500/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-label="New Password"
                />
              </div>

              {/* Generated Password (Fallback) */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 dark:text-[var(--panel-muted)] flex items-center gap-1.5 uppercase tracking-wider">
                  Generated password
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 min-w-0 rounded-xl bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 text-[var(--panel-text)] px-3.5 py-2.5 text-sm outline-none font-mono"
                    value={me?.generated_password || "Not available for this account"}
                    type={showGeneratedPassword || !me?.generated_password ? "text" : "password"}
                    readOnly
                    aria-label="Generated account password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeneratedPassword((prev) => !prev)}
                    className="rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-2.5 text-slate-500 dark:text-[var(--panel-muted)] hover:text-violet-500 dark:hover:text-white transition-colors"
                    aria-label={showGeneratedPassword ? "Hide generated password" : "Show generated password"}
                    title={showGeneratedPassword ? "Hide" : "Show"}
                  >
                    {showGeneratedPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={copyGeneratedPassword}
                    disabled={!me?.generated_password}
                    className="rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-2.5 text-slate-500 dark:text-[var(--panel-muted)] hover:text-violet-500 dark:hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Copy generated password"
                    title="Copy"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-[var(--panel-muted)] leading-relaxed">
                  Auto-generated for OAuth login fallback. Keep confidential.
                </p>
              </div>
            </div>

          </div>

          {/* Action button */}
          <div className="p-5 border-t border-slate-200/40 dark:border-white/5 bg-white/70 dark:bg-slate-900/30 backdrop-blur-md">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-500/10 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>

        </form>
      </aside>
    </div>
  );
}
