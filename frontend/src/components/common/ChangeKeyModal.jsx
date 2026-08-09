import { useEffect, useState } from "react";
import { Lock, X, Eye, EyeOff } from "lucide-react";

export default function ChangeKeyModal({
  open,
  onClose,
  onConfirm,
  busy = false,
  errorMsg = ""
}) {
  const [oldKey, setOldKey] = useState("");
  const [newKey, setNewKey] = useState("");
  const [confirmKey, setConfirmKey] = useState("");
  const [newKeyType, setNewKeyType] = useState("pin");
  const [showKeys, setShowKeys] = useState(false);
  const [localErr, setLocalErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setOldKey("");
    setNewKey("");
    setConfirmKey("");
    setNewKeyType("pin");
    setLocalErr("");
    setShowKeys(false);
  }, [open]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    setLocalErr("");

    if (!oldKey.trim() || !newKey.trim() || !confirmKey.trim()) {
      setLocalErr("All fields are required.");
      return;
    }

    if (newKeyType === "pin") {
      if (!/^[a-zA-Z0-9]{4,8}$/.test(newKey.trim())) {
        setLocalErr("PIN must be 4 to 8 alphanumeric characters.");
        return;
      }
    }

    if (newKey.trim() !== confirmKey.trim()) {
      setLocalErr("New keys do not match.");
      return;
    }

    onConfirm({
      oldKey: oldKey.trim(),
      newKey: newKey.trim(),
      newKeyType
    });
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close modal"
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <Lock size={18} className="text-violet-500" />
            ⚙️ Change Secret Key
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70dvh] overflow-y-auto">
          {/* Lock Type */}
          <div>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              New Unlock Method
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "pin", label: "PIN" },
                { id: "emoji", label: "Emoji" },
                { id: "pin_emoji", label: "PIN+Emoji" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setNewKeyType(opt.id)}
                  className={`rounded-xl border p-2 text-xs font-semibold transition ${
                    newKeyType === opt.id
                      ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Key fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Enter Current Key
              </label>
              <input
                type={showKeys ? "text" : "password"}
                value={oldKey}
                onChange={(e) => setOldKey(e.target.value)}
                required
                placeholder="Current key"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Enter New Key
              </label>
              <input
                type={showKeys ? "text" : "password"}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                required
                placeholder="New PIN or Emoji combo"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Confirm New Key
              </label>
              <input
                type={showKeys ? "text" : "password"}
                value={confirmKey}
                onChange={(e) => setConfirmKey(e.target.value)}
                required
                placeholder="Confirm new key"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowKeys(!showKeys)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              >
                {showKeys ? "Hide Keys" : "Show Keys"}
              </button>
            </div>
          </div>

          {(localErr || errorMsg) && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
              {localErr || errorMsg}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Change Key"}
          </button>
        </div>
      </form>
    </div>
  );
}
