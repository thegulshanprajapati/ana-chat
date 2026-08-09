import { useEffect, useState } from "react";
import { Lock, X, Eye, EyeOff } from "lucide-react";

export default function HideMessageModal({
  open,
  onClose,
  onConfirm,
  busy = false
}) {
  const [keyType, setKeyType] = useState("pin"); // 'pin', 'emoji', 'pin_emoji'
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [emoji, setEmoji] = useState("");
  const [confirmEmoji, setConfirmEmoji] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPin("");
    setConfirmPin("");
    setEmoji("");
    setConfirmEmoji("");
    setError("");
    setKeyType("pin");
    setShowPin(false);
  }, [open]);

  if (!open) return null;

  function validate() {
    setError("");

    if (keyType === "pin" || keyType === "pin_emoji") {
      const trimmedPin = pin.trim();
      if (!/^[a-zA-Z0-9]{4,8}$/.test(trimmedPin)) {
        return "PIN must be 4 to 8 alphanumeric characters.";
      }
      if (trimmedPin !== confirmPin.trim()) {
        return "PIN keys do not match.";
      }
    }

    if (keyType === "emoji" || keyType === "pin_emoji") {
      const trimmedEmoji = emoji.trim();
      if (!trimmedEmoji) {
        return "Emoji key cannot be empty.";
      }
      // Simple emoji match (contains at least one character)
      if (trimmedEmoji !== confirmEmoji.trim()) {
        return "Emoji keys do not match.";
      }
    }

    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    let finalKey = "";
    if (keyType === "pin") {
      finalKey = pin.trim();
    } else if (keyType === "emoji") {
      finalKey = emoji.trim();
    } else if (keyType === "pin_emoji") {
      finalKey = `${pin.trim()}+${emoji.trim()}`;
    }

    await onConfirm({
      keyType,
      key: finalKey
    });
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close modal"
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <Lock size={18} className="text-violet-500" />
            🔐 Hide Message
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

        {/* Body */}
        <div className="overflow-y-auto p-4 space-y-4">
          <div>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Choose Unlock Method
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "pin", label: "PIN / Text" },
                { id: "emoji", label: "Emoji Key" },
                { id: "pin_emoji", label: "PIN + Emoji" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setKeyType(opt.id);
                    setError("");
                  }}
                  className={`rounded-xl border p-2 text-xs font-semibold transition ${
                    keyType === opt.id
                      ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
              {error}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3">
            {(keyType === "pin" || keyType === "pin_emoji") && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Enter PIN Key (4-8 alphanumeric)
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                      placeholder="e.g. 4821"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Confirm PIN Key
                  </label>
                  <input
                    type={showPin ? "text" : "password"}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    required
                    placeholder="e.g. 4821"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </>
            )}

            {(keyType === "emoji" || keyType === "pin_emoji") && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Enter Emoji Key
                  </label>
                  <input
                    type="text"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    required
                    placeholder="e.g. ❤️🌙"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Confirm Emoji Key
                  </label>
                  <input
                    type="text"
                    value={confirmEmoji}
                    onChange={(e) => setConfirmEmoji(e.target.value)}
                    required
                    placeholder="e.g. ❤️🌙"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? "Hiding..." : "Hide Message"}
          </button>
        </div>
      </form>
    </div>
  );
}
