import { useEffect, useMemo, useState, useRef } from "react";
import { ArrowLeft, CircleDot, Camera, Image, Trash2, Plus, Send } from "lucide-react";
import Avatar from "../common/Avatar";
import { formatDayLabel, formatTime } from "../../utils/time";
import StatusViewerModal from "../sidebar/StatusViewerModal";

const STATUS_STORAGE_PREFIX = "anach_status_v1";
const STATUS_FEED_STORAGE_PREFIX = "anach_status_feed_v1";

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readMyStatus(meId) {
  const key = `${STATUS_STORAGE_PREFIX}_${meId || "guest"}`;
  const parsed = readJson(key, null);
  if (!parsed || typeof parsed !== "object") return { text: "", updatedAt: "" };
  return {
    text: (parsed.text || "").toString().slice(0, 140),
    updatedAt: (parsed.updatedAt || "").toString()
  };
}

function readStatusFeed(meId) {
  const key = `${STATUS_FEED_STORAGE_PREFIX}_${meId || "guest"}`;
  const parsed = readJson(key, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: (item.id || "").toString(),
      created_at: (item.created_at || "").toString(),
      text: (item.text || "").toString().slice(0, 600),
      mediaType: item.mediaType === "image" ? "image" : "",
      mediaDataUrl: (item.mediaDataUrl || "").toString()
    }))
    .filter((item) => item.id && item.created_at);
}

export default function StatusPanel({ me, mobile = false, onBack }) {
  const meId = me?.id || "guest";
  const [tick, setTick] = useState(0);
  const [text, setText] = useState("");
  const [mediaDataUrl, setMediaDataUrl] = useState("");
  const fileInputRef = useRef(null);

  // Status viewer modal state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    function sync() {
      setTick((v) => v + 1);
    }
    window.addEventListener("storage", sync);
    window.addEventListener("anach_status_updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("anach_status_updated", sync);
    };
  }, []);

  const myStatus = useMemo(() => readMyStatus(meId), [meId, tick]);
  const updates = useMemo(() => readStatusFeed(meId), [meId, tick]);
  const recent = useMemo(() => {
    return [...updates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12);
  }, [updates]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePostStatus = () => {
    if (!text.trim() && !mediaDataUrl) return;

    const newUpdate = {
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      text: text.trim(),
      mediaType: mediaDataUrl ? "image" : "",
      mediaDataUrl: mediaDataUrl
    };

    const key = `${STATUS_FEED_STORAGE_PREFIX}_${meId}`;
    const feed = readStatusFeed(meId);
    window.localStorage.setItem(key, JSON.stringify([newUpdate, ...feed]));

    const myStatusKey = `${STATUS_STORAGE_PREFIX}_${meId}`;
    window.localStorage.setItem(myStatusKey, JSON.stringify({
      text: text.trim() || "Shared an image update",
      updatedAt: new Date().toISOString()
    }));

    setText("");
    setMediaDataUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    // Sync state local storage
    window.dispatchEvent(new Event("anach_status_updated"));
  };

  const clearMyStatus = () => {
    const key = `${STATUS_STORAGE_PREFIX}_${meId}`;
    window.localStorage.removeItem(key);
    
    // Also remove user's feed
    const feedKey = `${STATUS_FEED_STORAGE_PREFIX}_${meId}`;
    window.localStorage.removeItem(feedKey);

    window.dispatchEvent(new Event("anach_status_updated"));
  };

  const openViewer = (idx) => {
    setViewerIndex(idx);
    setViewerOpen(true);
  };

  return (
    <section className="glass-bar flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-none shadow-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-800/40">
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md rounded-none border-b border-slate-200/50 px-4 py-3 dark:border-slate-800/40">
        <div className="flex items-center gap-3">
          {mobile && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
              aria-label="Back to chats"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <CircleDot size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Updates</h2>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">WhatsApp-style status</p>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-5">
        
        {/* WhatsApp-Style My Status Row */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 border border-slate-100 dark:bg-slate-900/35 dark:border-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="relative cursor-pointer group" onClick={() => updates.length ? openViewer(0) : fileInputRef.current?.click()}>
              <div className={`rounded-full p-[2.5px] transition ${updates.length ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-950" : ""}`}>
                <Avatar name={me?.name || "Me"} src={me?.avatar_url} size={48} className="shadow-sm" />
              </div>
              {!updates.length && (
                <span className="absolute bottom-0 right-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white ring-2 ring-white dark:ring-slate-950 group-hover:scale-110 transition">
                  <Plus size={12} />
                </span>
              )}
            </div>
            <div className="min-w-0" onClick={() => updates.length ? openViewer(0) : null}>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">My status</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {myStatus.text ? myStatus.text : "Tap to add status update"}
              </p>
              {myStatus.updatedAt && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Updated {formatDayLabel(myStatus.updatedAt)} {formatTime(myStatus.updatedAt) ? `• ${formatTime(myStatus.updatedAt)}` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition dark:text-slate-400 dark:hover:bg-slate-800"
              title="Add media status"
            >
              <Camera size={18} />
            </button>
            {myStatus.text && (
              <button
                type="button"
                onClick={clearMyStatus}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition dark:hover:bg-rose-950/30"
                title="Delete status"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Status Composer Card */}
        <div className="p-4 rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-950/40">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Share your update</p>
          <div className="space-y-3">
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 min-h-[70px] resize-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind? Share an update..."
            />

            {mediaDataUrl && (
              <div className="relative inline-block mt-1">
                <img src={mediaDataUrl} alt="Status Attachment" className="h-24 w-24 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shadow-sm" />
                <button
                  type="button"
                  onClick={() => {
                    setMediaDataUrl("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-500 text-white shadow hover:bg-rose-600 transition"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-sm transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-900"
              >
                <Image size={14} className="text-violet-500" />
                Add Image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              <button
                type="button"
                onClick={handlePostStatus}
                disabled={!text.trim() && !mediaDataUrl}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow hover:from-violet-700 hover:to-indigo-700 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={12} />
                Post
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal scroll of Recent Updates (Contacts style) */}
        <div className="space-y-2.5">
          <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Recent Updates
          </p>
          {recent.length ? (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {recent.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => openViewer(idx)}
                  className="flex flex-col items-center text-center shrink-0 w-[72px] cursor-pointer group"
                >
                  <div className="relative">
                    <div className="rounded-full p-[2.5px] border-2 border-emerald-500 ring-offset-2 dark:ring-offset-slate-950 shadow-sm group-hover:scale-[1.03] transition duration-200">
                      <Avatar name={item.text || "Update"} src={item.mediaDataUrl || ""} size={44} />
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1.5 truncate w-full">
                    {item.text || "Status"}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 truncate w-full">
                    {formatTime(item.created_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center rounded-2xl border border-slate-100 bg-slate-50/50 dark:border-slate-800/40 dark:bg-slate-900/20">
              <p className="text-xs text-slate-400 dark:text-slate-500">No updates yet. Post your first status update above.</p>
            </div>
          )}
        </div>

        {/* Status Feed List */}
        <div className="space-y-2.5">
          <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Status Feed
          </p>
          <div className="space-y-3">
            {updates.length ? (
              [...updates]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 20)
                .map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => openViewer(idx)}
                    className="flex items-start gap-3 p-3 rounded-2xl border border-slate-150 bg-white/70 shadow-sm dark:border-slate-800/50 dark:bg-slate-950/35 hover:bg-slate-50 dark:hover:bg-slate-900/30 cursor-pointer transition duration-200"
                  >
                    <div className="rounded-full p-[2px] border border-emerald-500">
                      <Avatar name={item.text || "Update"} src={item.mediaDataUrl || ""} size={36} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Status Update</p>
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                          {formatDayLabel(item.created_at)} {formatTime(item.created_at) ? `• ${formatTime(item.created_at)}` : ""}
                        </p>
                      </div>
                      {item.text && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">{item.text}</p>}
                    </div>
                  </div>
                ))
            ) : (
              <p className="px-1 text-xs text-slate-400 dark:text-slate-500">Nothing in your feed yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Status Viewer Modal */}
      {viewerOpen && (
        <StatusViewerModal
          open={viewerOpen}
          items={updates}
          index={viewerIndex}
          me={me}
          headerName={me?.name || "My status"}
          headerAvatar={me?.avatar_url}
          onClose={() => setViewerOpen(false)}
          onNavigate={(nextIdx) => setViewerIndex(nextIdx)}
        />
      )}
    </section>
  );
}
