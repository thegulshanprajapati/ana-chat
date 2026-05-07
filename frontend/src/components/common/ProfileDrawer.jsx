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
    <div className={`fixed inset-0 z-[70] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-slate-900/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`absolute right-0 top-0 flex h-[100dvh] w-full max-w-[420px] flex-col border-l border-slate-200 bg-white p-4 shadow-xl transition-transform sm:p-5 dark:border-slate-800 dark:bg-slate-950 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Profile drawer"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close profile drawer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="flex items-center gap-3">
              <Avatar name={name} src={preview} size={58} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
              >
                <Camera size={14} /> Change
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setAvatar(e.target.files?.[0] || null)}
              />
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Name</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                aria-label="Full name"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</span>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email address"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Mobile</span>
              <input
                className="input"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                aria-label="Mobile number"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">About / Bio</span>
              <textarea
                className="input min-h-[92px] resize-none py-2.5"
                value={about}
                onChange={(e) => setAbout(e.target.value.slice(0, 500))}
                placeholder="Write something about yourself"
                aria-label="About or bio"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{about.length}/500</p>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Generated password</span>
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  value={me?.generated_password || "Not available for this account"}
                  type={showGeneratedPassword || !me?.generated_password ? "text" : "password"}
                  readOnly
                  aria-label="Generated account password"
                />
                <button
                  type="button"
                  onClick={() => setShowGeneratedPassword((prev) => !prev)}
                  className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label={showGeneratedPassword ? "Hide generated password" : "Show generated password"}
                  title={showGeneratedPassword ? "Hide" : "Show"}
                >
                  {showGeneratedPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  type="button"
                  onClick={copyGeneratedPassword}
                  disabled={!me?.generated_password}
                  className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Copy generated password"
                  title="Copy"
                >
                  <Copy size={15} />
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Auto-generated for OAuth users. Keep it private.
              </p>
            </label>
          </div>

          <div className="pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
