import { useEffect, useState } from "react";
import { Lock, X, Search, CheckCircle, RefreshCw, Key, Trash, EyeOff, LayoutGrid } from "lucide-react";
import { api } from "../../api/client";

export default function HiddenVaultDrawer({
  open,
  onClose,
  onOpenChangeKey, // callback when user changes key for a message
  onRemoveProtection, // callback when user removes protection
  onUnlockSuccess, // callback to notify parent page of unlocked message IDs
  unlockedList = [] // list of currently unlocked message details
}) {
  const [loading, setLoading] = useState(false);
  const [vaultEntries, setVaultEntries] = useState([]);
  const [unlockKey, setUnlockKey] = useState("");
  const [unlockedMsgIds, setUnlockedMsgIds] = useState(new Set());
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [filterType, setFilterType] = useState("all"); // 'all', 'text', 'media'

  // Fetch protected message metadata list (without original content)
  const fetchVaultList = async () => {
    if (!open) return;
    setLoading(true);
    try {
      const { data } = await api.get("/hidden-messages");
      setVaultEntries(data || []);
    } catch (err) {
      console.error("Failed to fetch hidden messages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaultList();
    setUnlockKey("");
    setErrorMsg("");
    setSuccessMsg("");
    setUnlockedMsgIds(new Set());
  }, [open]);

  if (!open) return null;

  const handleUnlock = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!unlockKey.trim()) return;

    setLoading(true);
    try {
      const { data } = await api.post("/hidden-messages/unlock", { key: unlockKey.trim() });
      const ids = data.unlockedIds || [];
      if (ids.length === 0) {
        setErrorMsg("No hidden messages found matching this key.");
      } else {
        const nextSet = new Set(unlockedMsgIds);
        ids.forEach(id => nextSet.add(id));
        setUnlockedMsgIds(nextSet);
        onUnlockSuccess?.(ids);
        setSuccessMsg(`✓ ${ids.length} messages unlocked successfully!`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "❌ Incorrect unlock key");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (msgId, chatId) => {
    try {
      await api.post(`/messages/${msgId}/unhide`, { chatId });
      onRemoveProtection?.(msgId);
      // Remove from lists
      setVaultEntries(prev => prev.filter(e => e.message_id !== msgId));
      const nextSet = new Set(unlockedMsgIds);
      nextSet.delete(msgId);
      setUnlockedMsgIds(nextSet);
    } catch (err) {
      console.error("Failed to remove protection:", err);
    }
  };

  const filteredEntries = vaultEntries.filter(entry => {
    if (filterType === "all") return true;
    const isMedia = entry.key_type === "emoji" || entry.key_type === "pin_emoji"; // fallback categorization helper
    if (filterType === "media") return isMedia;
    return !isMedia;
  });

  return (
    <div className="fixed inset-y-0 right-0 z-[100] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-right duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-violet-500" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            🔐 Hidden Messages Vault
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Close settings"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Search / Unlock Form */}
        <form onSubmit={handleUnlock} className="space-y-3">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Search / Enter Secret Key
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={unlockKey}
              onChange={(e) => setUnlockKey(e.target.value)}
              placeholder="Enter PIN or Emoji Key"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Search size={14} />
              Unlock
            </button>
          </div>

          {errorMsg && (
            <p className="text-xs font-semibold text-rose-500">{errorMsg}</p>
          )}
          {successMsg && (
            <p className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
              <CheckCircle size={12} />
              {successMsg}
            </p>
          )}
        </form>

        {/* Filters */}
        <div className="flex gap-2 border-b border-slate-100 pb-2 dark:border-slate-850">
          {["all", "text", "media"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                filterType === type
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-350"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Vault List */}
        <div className="space-y-3">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Protected Messages ({filteredEntries.length})
          </span>

          {loading && !vaultEntries.length && (
            <div className="py-10 text-center text-slate-400 text-sm flex justify-center items-center gap-2">
              <RefreshCw className="animate-spin text-violet-500" size={16} />
              Loading protected list...
            </div>
          )}

          {!loading && filteredEntries.length === 0 && (
            <p className="py-10 text-center text-xs text-slate-400">
              No hidden messages found.
            </p>
          )}

          {filteredEntries.map((entry) => {
            const isUnlocked = unlockedMsgIds.has(entry.message_id);

            return (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5 transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950/20"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                        💬 Chat:
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {entry.conversation_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                        👤 Sender:
                      </span>
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {entry.sender_name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      📅 Hidden: {new Date(entry.hidden_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {isUnlocked ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        🔓 Unlocked
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        🔒 Hidden
                      </span>
                    )}
                  </div>
                </div>

                {/* Vault Management Actions */}
                {isUnlocked && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50">
                    <button
                      type="button"
                      onClick={() => onOpenChangeKey?.(entry.message_id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Key size={10} />
                      Change Key
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(entry.message_id, entry.chat_id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-350 dark:hover:bg-rose-900/40"
                    >
                      <Trash size={10} />
                      Remove Protection
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextSet = new Set(unlockedMsgIds);
                        nextSet.delete(entry.message_id);
                        setUnlockedMsgIds(nextSet);
                        // Notify parent to re-hide
                        onRemoveProtection?.(null); // Triggers re-fetch/re-hide trigger
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                    >
                      <EyeOff size={10} />
                      Hide Again
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
