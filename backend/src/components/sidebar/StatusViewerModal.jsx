import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Avatar from "../common/Avatar";
import { formatTime } from "../../utils/time";

const OPEN_ANIM_MS = 180;
const CLOSE_ANIM_MS = 160;
const STORY_MS = 5200;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function StatusViewerModal({
  open,
  items,
  index,
  me,
  headerName,
  headerAvatar,
  headerSubtitle,
  onClose,
  onNavigate
}) {
  const list = Array.isArray(items) ? items : [];
  const safeIndex = clamp(Number(index) || 0, 0, Math.max(0, list.length - 1));
  const current = list[safeIndex] || null;
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [progress, setProgress] = useState(0);
  const closeTimerRef = useRef(null);
  const tickRef = useRef(null);
  const startRef = useRef(0);

  const total = list.length;
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < total - 1;

  const createdLabel = useMemo(() => {
    if (!current?.created_at) return "";
    const t = formatTime(current.created_at);
    return t ? t : "";
  }, [current?.created_at]);

  const title = (headerName || me?.name || "Status").toString();
  const avatarSrc = headerAvatar || me?.avatar_url || null;
  const subtitleText = (headerSubtitle || createdLabel || "").toString();

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    setClosing(false);
    return () => {};
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    setProgress(0);
    startRef.current = performance.now();

    function tick(now) {
      const elapsed = now - startRef.current;
      setProgress(clamp(elapsed / STORY_MS, 0, 1));
      if (elapsed >= STORY_MS) {
        if (canNext) onNavigate?.(safeIndex + 1);
        else requestClose();
        return;
      }
      tickRef.current = requestAnimationFrame(tick);
    }

    tickRef.current = requestAnimationFrame(tick);
    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      tickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted, safeIndex, total]);

  useEffect(() => {
    if (!open || !mounted) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      } else if (e.key === "ArrowLeft") {
        if (canPrev) onNavigate?.(safeIndex - 1);
      } else if (e.key === "ArrowRight") {
        if (canNext) onNavigate?.(safeIndex + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, mounted, canPrev, canNext, onNavigate, safeIndex]);

  function requestClose() {
    if (closing) return;
    setClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setMounted(false);
      setClosing(false);
      onClose?.();
    }, CLOSE_ANIM_MS);
  }

  function goPrev() {
    if (!canPrev) return;
    onNavigate?.(safeIndex - 1);
  }

  function goNext() {
    if (!canNext) {
      requestClose();
      return;
    }
    onNavigate?.(safeIndex + 1);
  }

  if (!open && !mounted) return null;

  const overlayClass = `fixed inset-0 z-[140] ${closing ? "pointer-events-none" : ""}`;
  const dimClass = `absolute inset-0 bg-[color:var(--overlay-dim)] backdrop-blur-xl transition-opacity ${closing ? "opacity-0" : "opacity-100"}`;
  const panelAnim = `absolute inset-0 flex items-center justify-center transition ${closing ? "opacity-0 scale-[0.985]" : "opacity-100 scale-100"}`;

  return createPortal(
    <div className={overlayClass} role="dialog" aria-modal="true" aria-label="Status viewer">
      <div className={dimClass} style={{ transitionDuration: `${closing ? CLOSE_ANIM_MS : OPEN_ANIM_MS}ms` }} onClick={requestClose} />
      <div className={panelAnim} style={{ transitionDuration: `${closing ? CLOSE_ANIM_MS : OPEN_ANIM_MS}ms` }}>
        <div className="relative h-[100dvh] w-full overflow-hidden bg-black sm:h-[92vh] sm:w-[min(980px,96vw)] sm:rounded-3xl sm:border sm:border-[color:var(--overlay-border)] sm:bg-[color:var(--overlay-media-bg)] sm:shadow-2xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-3">
            <div className="flex gap-1">
              {list.map((it, i) => {
                const filled = i < safeIndex ? 1 : (i === safeIndex ? progress : 0);
                return (
                  <span key={it.id || i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20">
                    <span className="block h-full bg-white/85" style={{ width: `${Math.round(clamp(filled, 0, 1) * 100)}%` }} />
                  </span>
                );
              })}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-6">
            <div className="pointer-events-auto flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={title} src={avatarSrc} size={42} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{title}</p>
                  <p className="text-[11px] text-white/70">{subtitleText}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--overlay-btn-border)] bg-[color:var(--overlay-btn-bg)] text-[color:var(--overlay-text)] transition hover:bg-[color:var(--overlay-btn-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--overlay-ring)]"
                aria-label="Close status"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={goPrev}
            className="absolute inset-y-0 left-0 z-10 w-1/3"
            aria-label="Previous status"
          />
          <button
            type="button"
            onClick={goNext}
            className="absolute inset-y-0 right-0 z-10 w-1/3"
            aria-label="Next status"
          />

          <div className="absolute inset-0 flex items-center justify-center px-5 pt-16 pb-10">
            {current ? (
              current.mediaType === "image" && current.mediaDataUrl ? (
                <img
                  src={current.mediaDataUrl}
                  alt="Status"
                  className="max-h-full w-full rounded-3xl object-contain shadow-2xl"
                  loading="eager"
                  decoding="async"
                />
              ) : current.mediaType === "video" && current.mediaUrl ? (
                <video
                  src={current.mediaUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full w-full rounded-3xl object-contain shadow-2xl"
                />
              ) : (
                <div className="w-full max-w-[720px] rounded-3xl border border-white/10 bg-white/10 p-6 text-center text-white shadow-2xl">
                  <p className="whitespace-pre-wrap text-lg font-semibold leading-relaxed">{current.text || "Status"}</p>
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
