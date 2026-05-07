import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

function isValidVideoUrl(rawUrl) {
  const value = (rawUrl || "").toString().trim();
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return true;
  if (value.startsWith("/")) return true;
  return false;
}

function normalizePosition(rawPosition) {
  const value = Number(rawPosition);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function normalizeRate(rawRate) {
  const value = Number(rawRate);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.25, Math.min(2, value));
}

export default function WatchTogetherPanel({
  chatId,
  session,
  onSetSource,
  onClearSession,
  onSyncPlayback,
  disabled = false,
  notify,
  theme = "dark"
}) {
  const [sourceInput, setSourceInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [saving, setSaving] = useState(false);
  const videoRef = useRef(null);
  const applyingRemoteStateRef = useRef(false);
  const applyingTimerRef = useRef(null);
  const isDarkTheme = theme === "dark";
  const activeSession = session?.active ? session : null;
  const activeSourceUrl = (activeSession?.sourceUrl || "").toString();

  useEffect(() => {
    if (activeSourceUrl) {
      setSourceInput(activeSourceUrl);
      setTitleInput((activeSession?.title || "").toString());
    } else {
      setSourceInput("");
      setTitleInput("");
    }
  }, [activeSourceUrl, activeSession?.title, chatId]);

  useEffect(() => () => {
    if (applyingTimerRef.current) {
      clearTimeout(applyingTimerRef.current);
      applyingTimerRef.current = null;
    }
  }, []);

  const beginRemoteApply = useCallback(() => {
    applyingRemoteStateRef.current = true;
    if (applyingTimerRef.current) clearTimeout(applyingTimerRef.current);
    applyingTimerRef.current = setTimeout(() => {
      applyingRemoteStateRef.current = false;
      applyingTimerRef.current = null;
    }, 220);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSession || !activeSourceUrl) return;

    beginRemoteApply();

    const nextRate = normalizeRate(activeSession.playbackRate);
    if (Math.abs(video.playbackRate - nextRate) > 0.01) {
      video.playbackRate = nextRate;
    }

    const nextPosition = normalizePosition(activeSession.position);
    if (Math.abs((video.currentTime || 0) - nextPosition) > 1.1) {
      try {
        video.currentTime = nextPosition;
      } catch {
        // ignore seek errors while metadata is not ready
      }
    }

    if (activeSession.isPlaying) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } else {
      video.pause();
    }
  }, [
    activeSession,
    activeSession?.isPlaying,
    activeSession?.playbackRate,
    activeSession?.position,
    activeSession?.updatedAt,
    activeSourceUrl,
    beginRemoteApply
  ]);

  const emitPlaybackSync = useCallback((action) => {
    const video = videoRef.current;
    if (!video || !chatId || !onSyncPlayback || !activeSession || applyingRemoteStateRef.current) return;
    onSyncPlayback({
      chatId,
      action,
      position: normalizePosition(video.currentTime),
      playbackRate: normalizeRate(video.playbackRate),
      isPlaying: !video.paused
    });
  }, [activeSession, chatId, onSyncPlayback]);

  const handleSetSource = useCallback(async (event) => {
    event.preventDefault();
    if (!chatId || !onSetSource) return;

    const sourceUrl = sourceInput.trim();
    const title = titleInput.trim();
    if (!isValidVideoUrl(sourceUrl)) {
      notify?.({
        type: "error",
        message: "Use a direct video URL starting with https://, http://, or /."
      });
      return;
    }

    setSaving(true);
    try {
      await onSetSource({
        chatId,
        sourceUrl,
        title
      });
    } finally {
      setSaving(false);
    }
  }, [chatId, notify, onSetSource, sourceInput, titleInput]);

  const handleClear = useCallback(async () => {
    if (!chatId || !onClearSession) return;
    setSaving(true);
    try {
      await onClearSession({ chatId });
    } finally {
      setSaving(false);
    }
  }, [chatId, onClearSession]);

  return (
    <div className={`rounded-2xl border px-3 py-3 sm:px-5 ${
      isDarkTheme
        ? "border-slate-800/80 bg-slate-950/85"
        : "border-slate-200/80 bg-white/90"
    }`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${
            isDarkTheme ? "text-slate-400" : "text-slate-500"
          }`}>
            Watch Together
          </p>
          <p className={`mt-0.5 text-[11px] ${
            isDarkTheme ? "text-slate-400" : "text-slate-500"
          }`}>
            Share one video URL and keep playback synced.
          </p>
        </div>
        {activeSession ? (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            activeSession.isPlaying
              ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-200 dark:text-emerald-200"
              : "border-amber-300/60 bg-amber-500/15 text-amber-200 dark:text-amber-200"
          }`}>
            {activeSession.isPlaying ? "Playing" : "Paused"}
          </span>
        ) : null}
      </div>

      <form onSubmit={handleSetSource} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
        <input
          value={sourceInput}
          onChange={(event) => setSourceInput(event.target.value)}
          placeholder="https://example.com/video.mp4 or /uploads/video.mp4"
          disabled={disabled || saving}
          className={`h-10 rounded-xl border px-3 text-sm outline-none transition ${
            isDarkTheme
              ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-violet-500"
              : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-violet-500"
          } disabled:cursor-not-allowed disabled:opacity-60`}
          aria-label="Shared video URL"
        />
        <input
          value={titleInput}
          onChange={(event) => setTitleInput(event.target.value)}
          placeholder="Optional title"
          disabled={disabled || saving}
          maxLength={80}
          className={`h-10 rounded-xl border px-3 text-sm outline-none transition ${
            isDarkTheme
              ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-violet-500"
              : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-violet-500"
          } disabled:cursor-not-allowed disabled:opacity-60`}
          aria-label="Video title"
        />
        <button
          type="submit"
          disabled={disabled || saving || !sourceInput.trim()}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-500 px-3 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : (activeSession ? "Update" : "Start")}
        </button>
        <button
          type="button"
          onClick={() => void handleClear()}
          disabled={disabled || saving || !activeSession}
          className={`inline-flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition ${
            isDarkTheme
              ? "border-rose-500/35 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
              : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          Stop
        </button>
      </form>

      {activeSession && activeSourceUrl ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/80 bg-black dark:border-slate-700/80">
          <video
            ref={videoRef}
            controls
            playsInline
            src={activeSourceUrl}
            className="h-auto max-h-[360px] w-full bg-black"
            onPlay={() => emitPlaybackSync("play")}
            onPause={() => emitPlaybackSync("pause")}
            onSeeked={() => emitPlaybackSync("seek")}
            onRateChange={() => emitPlaybackSync("rate")}
            onLoadedMetadata={() => {
              if (!activeSession) return;
              beginRemoteApply();
              const video = videoRef.current;
              if (!video) return;
              const nextPosition = normalizePosition(activeSession.position);
              if (Math.abs((video.currentTime || 0) - nextPosition) > 1.1) {
                try {
                  video.currentTime = nextPosition;
                } catch {
                  // ignore seek errors when metadata updates
                }
              }
            }}
            onError={() => {
              notify?.({
                type: "error",
                message: "Unable to load this video URL."
              });
            }}
          />
          <div className={`px-3 py-2 text-[11px] ${
            isDarkTheme ? "text-slate-300" : "text-slate-600"
          }`}>
            {activeSession.title || "Shared video"}
          </div>
        </div>
      ) : (
        <p className={`mt-3 rounded-xl border border-dashed px-3 py-2 text-xs ${
          isDarkTheme
            ? "border-slate-700 text-slate-400"
            : "border-slate-300 text-slate-500"
        }`}>
          Paste a direct video file URL to begin watching together in this chat.
        </p>
      )}
    </div>
  );
}
