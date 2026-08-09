import { useEffect, useState } from "react";
import { Cloud, ShieldAlert, Loader2 } from "lucide-react";

export default function RestoreBackupModal({ open, onClose, onConfirm, busy, lastBackupInfo }) {
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (open) {
      setPin("");
      setErrorMsg("");
    }
  }, [open]);

  // Handle countdown cooldown timer for attempts limit
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cooldown > 0) return;
    setErrorMsg("");

    const trimmedPin = pin.trim();
    if (!trimmedPin) return;

    try {
      await onConfirm(trimmedPin);
    } catch (err) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);

      if (nextAttempts >= 5) {
        setCooldown(60);
        setAttempts(0);
        setErrorMsg("Too many incorrect attempts. Please wait 60 seconds.");
      } else {
        setErrorMsg(`Incorrect backup PIN. (${5 - nextAttempts} attempts remaining)`);
      }
    }
  };

  if (!open) return null;

  const dateLabel = lastBackupInfo?.lastBackupAt 
    ? new Date(lastBackupInfo.lastBackupAt).toLocaleString() 
    : "Unknown Date";

  const sizeLabel = lastBackupInfo?.lastBackupSize 
    ? `${(lastBackupInfo.lastBackupSize / 1024).toFixed(2)} KB` 
    : "N/A";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/20 bg-slate-900 text-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4 flex items-center justify-center rounded-full bg-violet-500/10 p-3 text-violet-400 w-12 h-12 mx-auto animate-bounce">
            <Cloud size={24} />
          </div>

          <h3 className="mb-2 text-center text-lg font-bold">☁️ Backup Found</h3>
          <p className="mb-4 text-center text-xs text-slate-400 leading-relaxed">
            We found an encrypted chat backup for your account. You can restore your chats, media, and settings below.
          </p>

          <div className="mb-6 rounded-2xl bg-slate-800/50 border border-slate-700/30 p-4 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Last Backup:</span>
              <span className="font-semibold text-slate-200">{dateLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Size:</span>
              <span className="font-semibold text-slate-200">{sizeLabel}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Enter Backup PIN</label>
              <input
                type="password"
                maxLength={8}
                disabled={busy || cooldown > 0}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="• • • • • •"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-center text-lg font-bold tracking-widest text-slate-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                autoComplete="off"
                required
              />
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-medium text-rose-400 border border-rose-500/20">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={busy || !pin || cooldown > 0}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Restoring...
                </>
              ) : cooldown > 0 ? (
                `Cooldown (${cooldown}s)`
              ) : (
                "Restore Backup"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
