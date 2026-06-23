import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Copy, Eye, EyeOff, X, User, Mail, Phone, Info, Lock } from "lucide-react";
import { api } from "../../api/client";
import Avatar from "./Avatar";

export default function ProfileDrawer({ open, me, onClose, onSaved, notify }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [about, setAbout] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showGeneratedPassword, setShowGeneratedPassword] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(me?.name || "");
    setEmail(me?.email || "");
    setMobile(me?.mobile || "");
    setAbout((me?.about_bio || "").slice(0, 500));
    setAvatar(null);
    setPassword("");
    setShowGeneratedPassword(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [open, me]);

  const preview = useMemo(() => (avatar ? URL.createObjectURL(avatar) : me?.avatar_url || ""), [avatar, me?.avatar_url]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("email", email.trim());
      form.append("mobile", mobile.trim());
      form.append("about", about.trim());
      if (avatar) form.append("avatar", avatar);
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
        className="absolute inset-0 bg-slate-950/60 transition-opacity"
        aria-label="Close profile drawer"
      />

      {/* Drawer Container (Styled to match the premium dark charcoal look of the app) */}
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--panel-border)] bg-[var(--panel-bg)] text-slate-100 shadow-2xl transition-transform duration-300">
        
        {/* Header */}
        <div className="flex h-[64px] items-center gap-4 bg-[var(--panel-bg-2)] px-6 text-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-[var(--accent-soft-18)] transition-colors"
            aria-label="Close profile drawer"
          >
            <X size={20} className="text-[var(--panel-muted)]" />
          </button>
          <span className="text-base font-medium">Profile info</span>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 flex flex-col bg-[var(--body-bg-dark)]">
          <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pb-6">
            
            {/* Avatar / Profile Picture Section */}
            <div className="bg-[var(--panel-bg)] px-6 py-8 flex flex-col items-center border-b border-[var(--panel-border)]">
              <div 
                className="relative group cursor-pointer rounded-full overflow-hidden" 
                onClick={() => fileRef.current?.click()}
              >
                <Avatar name={name} src={preview} size={150} />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition duration-200 text-center p-2">
                  <Camera size={24} className="text-[#e9edef] mb-1" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#e9edef]">Change photo</span>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setAvatar(e.target.files?.[0] || null)}
              />
              <p className="mt-3 text-[11px] text-[var(--panel-muted)]">
                Click photo to upload custom avatar
              </p>
            </div>

            {/* Inputs Section */}
            <div className="px-6 py-4 bg-[var(--panel-bg)] space-y-5">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[13px] text-[var(--panel-muted)] flex items-center gap-1.5">
                  <User size={14} /> Full name
                </label>
                <input
                  className="w-full rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border)] text-[#e9edef] px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/25"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  aria-label="Full name"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-[13px] text-[var(--panel-muted)] flex items-center gap-1.5">
                  <Mail size={14} /> Email address
                </label>
                <input
                  type="email"
                  className="w-full rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border)] text-[#e9edef] px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/25"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-label="Email address"
                />
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-[13px] text-[var(--panel-muted)] flex items-center gap-1.5">
                  <Phone size={14} /> Mobile number
                </label>
                <input
                  className="w-full rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border)] text-[#e9edef] px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/25"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  aria-label="Mobile number"
                />
              </div>

              {/* About / Bio */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] text-[var(--panel-muted)] flex items-center gap-1.5">
                    <Info size={14} /> About / Bio
                  </label>
                  <span className="text-[10px] text-[var(--panel-muted)] font-mono">{about.length}/500</span>
                </div>
                <textarea
                  className="w-full rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border)] text-[#e9edef] px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/25 min-h-[92px] resize-none"
                  value={about}
                  onChange={(e) => setAbout(e.target.value.slice(0, 500))}
                  placeholder="Write something about yourself..."
                  aria-label="About or bio"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-[13px] text-[var(--panel-muted)] flex items-center gap-1.5">
                  <Lock size={14} /> New Password (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Enter new password to change"
                  className="w-full rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border)] text-[#e9edef] px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/25"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-label="New Password"
                />
              </div>

              {/* Generated Password (Fallback) */}
              <div className="space-y-1.5">
                <label className="text-[13px] text-[var(--panel-muted)]">Generated fallback password</label>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border)] text-[#e9edef] px-3.5 py-2.5 text-sm outline-none"
                    value={me?.generated_password || "Not available for this account"}
                    type={showGeneratedPassword || !me?.generated_password ? "text" : "password"}
                    readOnly
                    aria-label="Generated account password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeneratedPassword((prev) => !prev)}
                    className="rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border)] p-2.5 text-[var(--panel-muted)] hover:text-slate-200 transition-colors"
                    aria-label={showGeneratedPassword ? "Hide generated password" : "Show generated password"}
                    title={showGeneratedPassword ? "Hide" : "Show"}
                  >
                    {showGeneratedPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={copyGeneratedPassword}
                    disabled={!me?.generated_password}
                    className="rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border)] p-2.5 text-[var(--panel-muted)] hover:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Copy generated password"
                    title="Copy"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <p className="text-[11px] text-[var(--panel-muted)] leading-relaxed">
                  Auto-generated for OAuth login fallback. Keep confidential.
                </p>
              </div>

            </div>

          </div>

          {/* Action button */}
          <div className="p-6 bg-[var(--panel-bg)] border-t border-[var(--panel-border)]/30">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-[#e9edef] rounded-xl font-semibold text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>

        </form>
      </aside>
    </div>
  );
}
