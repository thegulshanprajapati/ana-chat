import { useEffect, useState } from "react";
import { Lock, ShieldAlert } from "lucide-react";

export default function BackupSetupModal({ open, onClose, onConfirm, busy }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) {
      setPin("");
      setConfirmPin("");
      setErrorMsg("");
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedPin = pin.trim();
    const trimmedConfirm = confirmPin.trim();

    if (!/^[0-9]{6,8}$/.test(trimmedPin)) {
      setErrorMsg("PIN must be between 6 and 8 digits.");
      return;
    }

    if (trimmedPin !== trimmedConfirm) {
      setErrorMsg("PINs do not match.");
      return;
    }

    onConfirm(trimmedPin);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/20 bg-slate-900 text-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4 flex items-center justify-center rounded-full bg-violet-500/10 p-3 text-violet-400 w-12 h-12 mx-auto">
            <Lock size={24} />
          </div>

          <h3 className="mb-2 text-center text-lg font-bold">🔐 Protect Your Backup</h3>
          <p className="mb-6 text-center text-xs text-slate-400 leading-relaxed">
            Create a Backup PIN (6-8 digits) to secure your cloud chats. You will need this PIN to restore your messages on a new device.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Backup PIN</label>
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="• • • • • •"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-center text-lg font-bold tracking-widest text-slate-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Confirm Backup PIN</label>
              <input
                type="password"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                placeholder="• • • • • •"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-center text-lg font-bold tracking-widest text-slate-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                autoComplete="new-password"
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !pin || !confirmPin}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enable Backup
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
