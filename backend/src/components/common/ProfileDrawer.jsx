import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Copy, Eye, EyeOff, X } from "lucide-react";
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

  return (
    <div className={`fixed inset-0 z-[70] transition-all duration-300 ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`absolute right-0 top-0 flex h-[100dvh] w-full max-w-[420px] flex-col border-l border-slate-200/50 bg-white/90 p-6 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out sm:p-7 dark:border-slate-800/50 dark:bg-slate-950/90 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Profile drawer"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-indigo-400">
              Edit Profile
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize how others see you in chat</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-200"
            aria-label="Close profile drawer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            
            {/* Avatar Section */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50/50 border border-slate-100 dark:bg-slate-900/40 dark:border-slate-800/40 transition">
              <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                <Avatar name={name} src={preview} size={90} className="ring-4 ring-violet-500/20 shadow-md group-hover:scale-[1.02] transition" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 rounded-full opacity-0 group-hover:opacity-100 transition duration-200">
                  <Camera size={20} className="text-white" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900"
              >
                <Camera size={13} /> Change photo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setAvatar(e.target.files?.[0] || null)}
              />
            </div>

            {/* Form Fields */}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</span>
              <input
                className="input w-full rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5 text-sm transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-800 dark:bg-slate-950/70"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                aria-label="Full name"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Email</span>
              <input
                type="email"
                className="input w-full rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5 text-sm transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-800 dark:bg-slate-950/70"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email address"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mobile</span>
              <input
                className="input w-full rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5 text-sm transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-800 dark:bg-slate-950/70"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                aria-label="Mobile number"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">About / Bio</span>
              <textarea
                className="input w-full rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5 text-sm transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-800 dark:bg-slate-950/70 min-h-[92px] resize-none py-2.5"
                value={about}
                onChange={(e) => setAbout(e.target.value.slice(0, 500))}
                placeholder="Write something about yourself..."
                aria-label="About or bio"
              />
              <p className="mt-1.5 text-right text-[10px] font-semibold text-slate-400 dark:text-slate-500">{about.length}/500</p>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">New Password (Optional)</span>
              <input
                type="password"
                placeholder="Enter new password to change"
                className="input w-full rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5 text-sm transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-800 dark:bg-slate-950/70"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="New Password"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Generated password</span>
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1 rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5 text-sm transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-800 dark:bg-slate-950/70"
                  value={me?.generated_password || "Not available for this account"}
                  type={showGeneratedPassword || !me?.generated_password ? "text" : "password"}
                  readOnly
                  aria-label="Generated account password"
                />
                <button
                  type="button"
                  onClick={() => setShowGeneratedPassword((prev) => !prev)}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-900"
                  aria-label={showGeneratedPassword ? "Hide generated password" : "Show generated password"}
                  title={showGeneratedPassword ? "Hide" : "Show"}
                >
                  {showGeneratedPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  onClick={copyGeneratedPassword}
                  disabled={!me?.generated_password}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-900"
                  aria-label="Copy generated password"
                  title="Copy"
                >
                  <Copy size={16} />
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                Auto-generated for OAuth login fallback. Please keep it confidential.
              </p>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-900 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:from-violet-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 active:scale-[0.98] transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
