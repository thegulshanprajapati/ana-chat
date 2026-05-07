import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CircleDot } from "lucide-react";
import Avatar from "../common/Avatar";
import { formatDayLabel, formatTime } from "../../utils/time";

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

  return (
    <section className="glass-bar flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-none shadow-[0_22px_70px_rgb(0_0_0_/_0.28)] sm:rounded-lg">
      <header className="sticky top-0 z-30 glass-bar rounded-none border-x-0 border-t-0 border-b border-slate-200/60 px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.10)] dark:border-white/10 sm:px-5 sm:py-3">
        <div className="flex items-center gap-3">
          {mobile && (
            <button
              type="button"
              onClick={onBack}
              className="glass-icon-btn"
              aria-label="Back to chats"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <CircleDot size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">Status</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Updates from you</p>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        <section className="rounded-2xl border border-slate-200/70 bg-white/60 p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/35">
          <div className="flex items-center gap-3">
            <Avatar name={me?.name || "Me"} src={me?.avatar_url} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">My Status</p>
              <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                {myStatus.text ? myStatus.text : "No status set"}
              </p>
              {myStatus.updatedAt && (
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                  Updated {formatDayLabel(myStatus.updatedAt)} {formatTime(myStatus.updatedAt) ? `• ${formatTime(myStatus.updatedAt)}` : ""}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-4">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Recent Updates
          </p>
          {recent.length ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recent.map((item) => (
                <div
                  key={item.id}
                  className="w-[180px] shrink-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm dark:border-white/10 dark:bg-slate-950/30"
                >
                  {item.mediaType === "image" && item.mediaDataUrl ? (
                    <img src={item.mediaDataUrl} alt="" className="h-28 w-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-accent-soft p-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {(item.text || "").slice(0, 60) || "Update"}
                    </div>
                  )}
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{item.text || "Update"}</p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                      {formatDayLabel(item.created_at)} {formatTime(item.created_at) ? `• ${formatTime(item.created_at)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1 text-sm text-slate-500 dark:text-slate-400">No updates yet.</p>
          )}
        </section>

        <section className="mt-4">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Status Feed
          </p>
          <div className="space-y-2">
            {updates.length ? (
              [...updates]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 40)
                .map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200/70 bg-white/60 p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Update</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {formatDayLabel(item.created_at)} {formatTime(item.created_at) ? `• ${formatTime(item.created_at)}` : ""}
                      </p>
                    </div>
                    {item.mediaType === "image" && item.mediaDataUrl && (
                      <img
                        src={item.mediaDataUrl}
                        alt=""
                        className="mt-2 max-h-56 w-full rounded-2xl object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    {item.text && <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{item.text}</p>}
                  </div>
                ))
            ) : (
              <p className="px-1 text-sm text-slate-500 dark:text-slate-400">Nothing in your feed yet.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

