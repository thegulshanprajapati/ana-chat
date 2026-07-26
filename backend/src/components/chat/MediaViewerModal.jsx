import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Info,
  Share2,
  SmilePlus,
  Trash2,
  X
} from "lucide-react";
import { isVideoMedia, mediaSrc } from "../../utils/chat";
import { decryptMediaToObjectUrl, getOrCreateRsaKeyPair } from "../../utils/e2ee";
import { formatTime } from "../../utils/time";

const UI_IDLE_MS = 2600;
const OPEN_ANIM_MS = 170;
const CLOSE_ANIM_MS = 160;
const MAX_SCALE = 6;
const MIN_SCALE = 1;
const DOUBLE_TAP_MS = 300;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function rgbToHex(r, g, b) {
  const to = (n) => n.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function pickKind(message) {
  const kind = message?.e2ee?.media?.kind;
  if (kind) return kind;
  if (!message?.image_url) return null;
  return isVideoMedia(message.image_url) ? "video" : "image";
}

function isPdfMessage(message) {
  const kind = pickKind(message);
  if (kind !== "file") return false;
  const mime = (message?.e2ee?.media?.mime || "").toString();
  return /^application\/pdf\b/i.test(mime);
}

function canCanvasSampleFromBlobUrl(url) {
  return typeof url === "string" && url.startsWith("blob:");
}

async function extractDominantColorsFromImage({
  src,
  withCredentials = true,
  maxSamples = 18000,
  k = 6
}) {
  if (!src) throw new Error("src required");

  const response = await fetch(src, { credentials: withCredentials ? "include" : "omit" });
  if (!response.ok) throw new Error("Unable to load image");
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const scale = Math.min(1, Math.sqrt(maxSamples / (bitmap.width * bitmap.height)));
  const w = Math.max(1, Math.floor(bitmap.width * scale));
  const h = Math.max(1, Math.floor(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const samples = [];
  const stride = Math.max(1, Math.floor((w * h) / Math.min(maxSamples, w * h)));
  for (let i = 0, px = 0; i < data.length; i += 4 * stride, px += 1) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 40) continue;
    samples.push([r, g, b]);
    if (samples.length >= maxSamples) break;
  }

  if (!samples.length) return [];

  // K-means (small k, small sample count; good enough for chat UX).
  const centers = [];
  for (let i = 0; i < k; i += 1) {
    centers.push(samples[(i * 997) % samples.length].slice());
  }

  const assignments = new Array(samples.length).fill(0);
  for (let iter = 0; iter < 10; iter += 1) {
    // assign
    for (let i = 0; i < samples.length; i += 1) {
      const [r, g, b] = samples[i];
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centers.length; c += 1) {
        const cr = centers[c][0];
        const cg = centers[c][1];
        const cb = centers[c][2];
        const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      assignments[i] = best;
    }

    // recompute
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i += 1) {
      const a = assignments[i];
      const s = sums[a];
      s[0] += samples[i][0];
      s[1] += samples[i][1];
      s[2] += samples[i][2];
      s[3] += 1;
    }
    for (let c = 0; c < centers.length; c += 1) {
      if (!sums[c][3]) continue;
      centers[c][0] = Math.round(sums[c][0] / sums[c][3]);
      centers[c][1] = Math.round(sums[c][1] / sums[c][3]);
      centers[c][2] = Math.round(sums[c][2] / sums[c][3]);
    }
  }

  const counts = new Array(k).fill(0);
  for (let i = 0; i < assignments.length; i += 1) counts[assignments[i]] += 1;

  const colors = centers
    .map((c, idx) => ({ rgb: c, count: counts[idx] }))
    .sort((a, b) => b.count - a.count)
    .map((c) => rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]));

  // Deduplicate near-equals (quick + UI friendly).
  const unique = [];
  for (const hex of colors) {
    if (!unique.includes(hex)) unique.push(hex);
    if (unique.length >= 6) break;
  }
  return unique;
}

function useBodyScrollLock(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, [enabled]);
}

function useFocusTrap({ open, closeButtonRef, panelRef }) {
  const lastFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    lastFocusRef.current = document.activeElement;
    const timer = setTimeout(() => closeButtonRef.current?.focus?.(), 0);

    function getFocusable() {
      const root = panelRef.current;
      if (!root) return [];
      const nodes = root.querySelectorAll(
        'a[href], button:not([disabled]), iframe, video, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(nodes).filter((el) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        return style.visibility !== "hidden" && style.display !== "none";
      });
    }

    function onKeyDown(event) {
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !panelRef.current?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      const last = lastFocusRef.current;
      lastFocusRef.current = null;
      if (last && typeof last.focus === "function") last.focus();
    };
  }, [closeButtonRef, open, panelRef]);
}

function computePanClamp({ scale, viewportW, viewportH, contentW, contentH }) {
  if (scale <= 1) return { maxX: 0, maxY: 0 };
  const scaledW = contentW * scale;
  const scaledH = contentH * scale;
  const maxX = Math.max(0, (scaledW - viewportW) / 2);
  const maxY = Math.max(0, (scaledH - viewportH) / 2);
  return { maxX, maxY };
}

export default function MediaViewerModal({
  open,
  items,
  index,
  uploadBase,
  meId,
  onClose,
  onNavigate,
  onDeleteLocal,
  onDeleteForEveryone,
  onReact,
  notify
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const viewportRef = useRef(null);
  const mediaRef = useRef(null);
  const idleTimerRef = useRef(null);
  const lastTapAtRef = useRef(0);
  const pointersRef = useRef(new Map());

  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [palette, setPalette] = useState([]);
  const [paletteError, setPaletteError] = useState("");
  const [pointerCount, setPointerCount] = useState(0);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaLoadTick, setMediaLoadTick] = useState(0);
  const tapIntentRef = useRef({ downAt: 0, downX: 0, downY: 0, moved: false });

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pinchRef = useRef({ baseScale: 1, baseDistance: 0, baseCenter: { x: 0, y: 0 }, basePan: { x: 0, y: 0 } });
  const panDragRef = useRef({ dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const swipeRef = useRef({ swiping: false, startX: 0, startY: 0, at: 0, dx: 0, dy: 0, t: 0 });
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);

  const cacheRef = useRef(new Map()); // id -> { url, mime, kind, size, revokable, decrypting }

  const current = items?.[index] || null;
  const currentKind = useMemo(() => pickKind(current), [current]);
  const currentIsPdf = useMemo(() => isPdfMessage(current), [current]);
  const isImage = currentKind === "image" && !currentIsPdf;
  const isVideo = currentKind === "video";
  const canPrev = index > 0;
  const canNext = index < (items?.length || 0) - 1;

  useBodyScrollLock(open);
  useFocusTrap({ open: mounted, closeButtonRef: closeRef, panelRef });

  useEffect(() => {
    if (!open) {
      setMounted(false);
      setClosing(false);
      return;
    }
    setMounted(true);
    setClosing(false);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    setScale(1);
    setPan({ x: 0, y: 0 });
    setSwipeOffsetX(0);
    setPalette([]);
    setPaletteError("");
    setShowInfo(false);
    setMediaLoaded(false);
    setMediaLoadTick((v) => v + 1);
  }, [mounted, index]);

  const requestClose = useCallback(() => {
    setUiVisible(true);
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      onClose?.();
      setClosing(false);
    }, CLOSE_ANIM_MS);
  }, [closing, onClose]);

  useEffect(() => {
    if (!mounted) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        if (canPrev && scale === 1) {
          event.preventDefault();
          onNavigate?.(index - 1);
        }
        return;
      }
      if (event.key === "ArrowRight") {
        if (canNext && scale === 1) {
          event.preventDefault();
          onNavigate?.(index + 1);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canNext, canPrev, index, mounted, onNavigate, requestClose, scale]);

  const nudgeUiVisible = useCallback(() => {
    setUiVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setUiVisible(false), UI_IDLE_MS);
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;
    nudgeUiVisible();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [mounted, nudgeUiVisible]);

  const resolved = useMemo(() => {
    // cacheVersion makes sure we re-read cacheRef when entries change
    void cacheVersion;
    if (!current?.id || !current?.image_url) return { url: "", mime: "", kind: currentKind, decrypting: false };
    const cached = cacheRef.current.get(String(current.id));
    if (cached?.url) return { url: cached.url, mime: cached.mime || "", kind: cached.kind || currentKind, decrypting: false };

    const cipher = mediaSrc(uploadBase, current.image_url);
    const encrypted = Boolean(!current.deleted_for_everyone && current?.e2ee?.key && current?.e2ee?.media?.iv);
    if (!encrypted) {
      cacheRef.current.set(String(current.id), { url: cipher, mime: current?.e2ee?.media?.mime || "", kind: currentKind, revokable: false });
      return { url: cipher, mime: current?.e2ee?.media?.mime || "", kind: currentKind, decrypting: false };
    }

    return { url: "", mime: current?.e2ee?.media?.mime || "", kind: currentKind, decrypting: true, cipher };
  }, [cacheVersion, current, currentKind, uploadBase]);

  // Decrypt current + prefetch adjacent.
  useEffect(() => {
    if (!mounted || !meId) return undefined;
    const targets = [current, items?.[index - 1], items?.[index + 1]].filter(Boolean);
    let canceled = false;

    async function ensureForMessage(msg) {
      const id = String(msg.id);
      if (!msg?.image_url) return;
      const already = cacheRef.current.get(id);
      if (already?.url) return;

      const kind = pickKind(msg);
      const cipher = mediaSrc(uploadBase, msg.image_url);
      const encrypted = Boolean(!msg.deleted_for_everyone && msg?.e2ee?.key && msg?.e2ee?.media?.iv);

      if (!encrypted) {
        cacheRef.current.set(id, { url: cipher, mime: msg?.e2ee?.media?.mime || "", kind, revokable: false });
        setCacheVersion((v) => v + 1);
        return;
      }

      cacheRef.current.set(id, { url: "", mime: msg?.e2ee?.media?.mime || "", kind, revokable: false, decrypting: true });
      setCacheVersion((v) => v + 1);
      try {
        const pair = await getOrCreateRsaKeyPair(meId);
        const response = await fetch(cipher, { credentials: "include" });
        const encryptedBytes = await response.arrayBuffer();
        const result = await decryptMediaToObjectUrl({
          e2ee: msg.e2ee,
          privateJwk: pair.privateJwk,
          encryptedBytes
        });
        if (canceled) {
          if (result?.url) URL.revokeObjectURL(result.url);
          return;
        }
        cacheRef.current.set(id, { url: result?.url || "", mime: result?.mime || "", kind: result?.kind || kind, size: result?.size || null, revokable: true });
        setCacheVersion((v) => v + 1);
      } catch {
        cacheRef.current.set(id, { url: "", mime: msg?.e2ee?.media?.mime || "", kind, revokable: false, failed: true });
        setCacheVersion((v) => v + 1);
      }
    }

    Promise.all(targets.map((msg) => ensureForMessage(msg)));

    return () => {
      canceled = true;
    };
  }, [index, items, meId, mounted, uploadBase, current]);

  // Revoke object URLs on unmount.
  useEffect(() => {
    if (!mounted) return undefined;
    const cache = cacheRef.current;
    return () => {
      for (const entry of cache.values()) {
        if (entry?.revokable && entry?.url) URL.revokeObjectURL(entry.url);
      }
      cache.clear();
    };
  }, [mounted]);

  const currentUrl = useMemo(() => {
    void cacheVersion;
    if (!current?.id) return "";
    const cached = cacheRef.current.get(String(current.id));
    if (cached?.url) return cached.url;
    return resolved.url || "";
  }, [cacheVersion, current?.id, resolved.url]);

  useEffect(() => {
    if (!mounted) return;
    setMediaLoaded(false);
    setMediaLoadTick((v) => v + 1);
  }, [currentUrl, mounted]);

  const downloadName = useMemo(() => {
    const kind = (current?.e2ee?.media?.kind || "file").toString().trim() || "file";
    const mime = (current?.e2ee?.media?.mime || "").toString();
    const ext = (() => {
      const v = mime.toLowerCase().split(";")[0].trim();
      if (v === "application/pdf") return "pdf";
      if (v === "image/png") return "png";
      if (v === "image/jpeg") return "jpg";
      if (v === "image/webp") return "webp";
      if (v === "image/gif") return "gif";
      if (v === "video/mp4") return "mp4";
      if (v === "video/webm") return "webm";
      if (v === "video/quicktime") return "mov";
      return "bin";
    })();
    const id = (current?.id || "media").toString();
    return `anach-${kind}-${id}.${ext}`;
  }, [current?.e2ee?.media?.kind, current?.e2ee?.media?.mime, current?.id]);
  const downloadMime = useMemo(() => {
    return (current?.e2ee?.media?.mime || "").toString().trim() || "application/octet-stream";
  }, [current?.e2ee?.media?.mime]);

  function clampPan(nextPan) {
    const viewport = viewportRef.current?.getBoundingClientRect?.();
    const mediaEl = mediaRef.current;
    if (!viewport || !mediaEl || scale <= 1) return { x: 0, y: 0 };
    const contentW = mediaEl.naturalWidth || mediaEl.videoWidth || viewport.width;
    const contentH = mediaEl.naturalHeight || mediaEl.videoHeight || viewport.height;
    const { maxX, maxY } = computePanClamp({
      scale,
      viewportW: viewport.width,
      viewportH: viewport.height,
      contentW,
      contentH
    });
    return {
      x: clamp(nextPan.x, -maxX, maxX),
      y: clamp(nextPan.y, -maxY, maxY)
    };
  }

  function setScaleAndPan(nextScale, nextPan) {
    const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    setScale(clampedScale);
    setPan(clampedScale <= 1 ? { x: 0, y: 0 } : clampPan(nextPan));
  }

  function toggleZoomAt(pointClient) {
    const viewport = viewportRef.current?.getBoundingClientRect?.();
    if (!viewport) {
      setScaleAndPan(scale > 1 ? 1 : 2.4, { x: 0, y: 0 });
      return;
    }

    const nextScale = scale > 1 ? 1 : 2.6;
    if (nextScale === 1) {
      setScaleAndPan(1, { x: 0, y: 0 });
      return;
    }

    // Zoom towards the tap point.
    const cx = pointClient.x - (viewport.left + viewport.width / 2);
    const cy = pointClient.y - (viewport.top + viewport.height / 2);
    const factor = nextScale / Math.max(scale, 1);
    const nextPan = { x: pan.x - cx * (factor - 1), y: pan.y - cy * (factor - 1) };
    setScaleAndPan(nextScale, nextPan);
  }

  function onBackdropPointerDown(event) {
    if (event.target !== event.currentTarget) return;
    if (scale > 1) return;
    requestClose();
  }

  function onViewportWheel(event) {
    if (!isImage) return;
    nudgeUiVisible();
    event.preventDefault();
    const delta = -event.deltaY;
    const zoom = delta > 0 ? 1.08 : 0.92;
    const viewport = viewportRef.current?.getBoundingClientRect?.();
    if (!viewport) return;
    const point = { x: event.clientX, y: event.clientY };
    const nextScale = clamp(scale * zoom, MIN_SCALE, MAX_SCALE);
    if (nextScale === scale) return;

    const cx = point.x - (viewport.left + viewport.width / 2);
    const cy = point.y - (viewport.top + viewport.height / 2);
    const factor = nextScale / Math.max(scale, 1);
    const nextPan = { x: pan.x - cx * (factor - 1), y: pan.y - cy * (factor - 1) };
    setScaleAndPan(nextScale, nextPan);
  }

  function onViewportPointerDown(event) {
    if (!mounted) return;
    nudgeUiVisible();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setPointerCount(pointersRef.current.size);
    viewportRef.current?.setPointerCapture?.(event.pointerId);
    tapIntentRef.current = { downAt: performance.now(), downX: event.clientX, downY: event.clientY, moved: false };

    if (scale > 1 && isImage) {
      panDragRef.current = { dragging: true, startX: event.clientX, startY: event.clientY, baseX: pan.x, baseY: pan.y };
      return;
    }

    swipeRef.current = { swiping: true, startX: event.clientX, startY: event.clientY, at: event.clientX, dx: 0, dy: 0, t: performance.now() };
  }

  function onViewportPointerMove(event) {
    if (!mounted) return;
    const pointerMap = pointersRef.current;
    if (pointerMap.size >= 2 && isImage) {
      if (pointerMap.has(event.pointerId)) pointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pts = Array.from(pointerMap.entries());
      if (pts.length < 2) return;
      const p1 = pts[0][1];
      const p2 = pts[1][1];
      const nowDist = distance(p1, p2);
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      if (!pinchRef.current.baseDistance) {
        pinchRef.current = { baseScale: scale, baseDistance: nowDist, baseCenter: center, basePan: pan };
        return;
      }
      const nextScale = clamp(pinchRef.current.baseScale * (nowDist / pinchRef.current.baseDistance), MIN_SCALE, MAX_SCALE);
      const viewport = viewportRef.current?.getBoundingClientRect?.();
      if (!viewport) return;
      const cx = center.x - (viewport.left + viewport.width / 2);
      const cy = center.y - (viewport.top + viewport.height / 2);
      const factor = nextScale / Math.max(scale, 1);
      const nextPan = { x: pan.x - cx * (factor - 1), y: pan.y - cy * (factor - 1) };
      setScaleAndPan(nextScale, nextPan);
      return;
    }

    if (panDragRef.current.dragging && isImage && scale > 1) {
      const dx = event.clientX - panDragRef.current.startX;
      const dy = event.clientY - panDragRef.current.startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) tapIntentRef.current.moved = true;
      setPan(() => clampPan({ x: panDragRef.current.baseX + dx, y: panDragRef.current.baseY + dy }));
      return;
    }

    if (swipeRef.current.swiping && scale === 1) {
      const dx = event.clientX - swipeRef.current.startX;
      const dy = event.clientY - swipeRef.current.startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) tapIntentRef.current.moved = true;
      swipeRef.current.dx = dx;
      swipeRef.current.dy = dy;
      swipeRef.current.at = event.clientX;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        setSwipeOffsetX(clamp(dx, -240, 240));
      }
    }
  }

  function finishSwipeNavigate() {
    const info = swipeRef.current;
    swipeRef.current.swiping = false;
    setSwipeOffsetX(0);
    const elapsed = performance.now() - (info.t || performance.now());
    const velocity = info.dx / Math.max(1, elapsed);
    const dx = info.dx;
    const swipeOk = Math.abs(dx) > 90 || Math.abs(velocity) > 0.65;
    if (!swipeOk) return;
    if (dx < 0 && canNext) onNavigate?.(index + 1);
    if (dx > 0 && canPrev) onNavigate?.(index - 1);
  }

  function onViewportPointerUp(event) {
    nudgeUiVisible();
    pointersRef.current.delete(event.pointerId);
    setPointerCount(pointersRef.current.size);
    viewportRef.current?.releasePointerCapture?.(event.pointerId);

    if (pointersRef.current.size >= 2) {
      pinchRef.current.baseDistance = 0;
      pinchRef.current.baseScale = scale;
      return;
    }

    if (panDragRef.current.dragging) {
      panDragRef.current.dragging = false;
      return;
    }

    if (swipeRef.current.swiping) {
      finishSwipeNavigate(event);
      return;
    }

    const now = Date.now();
    const last = lastTapAtRef.current || 0;
    lastTapAtRef.current = now;
    const isDouble = now - last <= DOUBLE_TAP_MS;
    if (isDouble && isImage) {
      toggleZoomAt({ x: event.clientX, y: event.clientY });
      return;
    }
  }

  function onViewportPointerCancel(event) {
    pointersRef.current.delete(event.pointerId);
    setPointerCount(pointersRef.current.size);
    panDragRef.current.dragging = false;
    swipeRef.current.swiping = false;
    pinchRef.current.baseDistance = 0;
    setSwipeOffsetX(0);
  }

  async function handleShare() {
    if (!currentUrl) return;
    nudgeUiVisible();
    try {
      const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

      if (canNativeShare) {
        const isBlob = currentUrl.startsWith("blob:");
          const canFetchAsBlob = isBlob || currentUrl.startsWith("http") || currentUrl.startsWith("/");
          if (canFetchAsBlob) {
            const response = await fetch(currentUrl, { credentials: isBlob ? "omit" : "include" });
            const blob = await response.blob();
            const file = new File([blob], downloadName, { type: blob.type || downloadMime });
            const canShareFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
            if (canShareFiles) {
              await navigator.share({ files: [file], title: "Media" });
              return;
            }
          }

        await navigator.share({ title: "Media", url: currentUrl });
        return;
      }

      await navigator.clipboard.writeText(currentUrl);
      notify?.({ type: "success", message: "Link copied." });
    } catch {
      try {
        await navigator.clipboard.writeText(currentUrl);
        notify?.({ type: "success", message: "Link copied." });
      } catch {
        notify?.({ type: "error", message: "Unable to share media." });
      }
    }
  }

  async function handleCopyHex(hex) {
    try {
      await navigator.clipboard.writeText(hex);
    } catch {
      // ignore
    }
  }

  async function handleExtractColors() {
    if (!isImage || !currentUrl) return;
    nudgeUiVisible();
    setExtracting(true);
    setPaletteError("");
    setPalette([]);
    try {
      // If it's a remote URL and might taint canvas, we still fetch as blob and sample pixels.
      // For blob URLs we can fetch too (safe).
      const withCreds = !canCanvasSampleFromBlobUrl(currentUrl);
      const colors = await extractDominantColorsFromImage({ src: currentUrl, withCredentials: withCreds });
      setPalette(colors);
      if (!colors.length) setPaletteError("No colors detected.");
    } catch {
      setPaletteError("Unable to extract colors.");
    } finally {
      setExtracting(false);
    }
  }

  function handleReact() {
    if (!current?.id) return;
    nudgeUiVisible();
    // Minimal quick reactions to keep the viewer lightweight.
    onReact?.(current, "\u2764\uFE0F");
    notify?.({ type: "success", message: "Reacted." });
  }

  function handleDelete() {
    if (!current?.id) return;
    if (Number(current.sender_id) === Number(meId)) {
      onDeleteForEveryone?.(current);
    } else {
      onDeleteLocal?.(current);
    }
    requestClose();
  }

  const senderLabel = useMemo(() => {
    if (!current) return "";
    if (Number(current.sender_id) === Number(meId)) return "You";
    return current.sender_name || "User";
  }, [current, meId]);

  if (!mounted) return null;

  const overlayClass = `fixed inset-0 z-[120] ${closing ? "pointer-events-none" : ""}`;
  const dimClass = `absolute inset-0 bg-[color:var(--overlay-dim)] backdrop-blur-xl transition-opacity ${closing ? "opacity-0" : "opacity-100"}`;
  const panelAnim = `absolute inset-0 flex items-center justify-center p-2 sm:p-4 transition ${closing ? "opacity-0 scale-[0.985]" : "opacity-100 scale-100"}`;

  return createPortal(
    <div className={overlayClass} role="dialog" aria-modal="true" aria-label="Media viewer" ref={panelRef}>
      <div className={dimClass} style={{ transitionDuration: `${closing ? CLOSE_ANIM_MS : OPEN_ANIM_MS}ms` }} onPointerDown={onBackdropPointerDown} />
      <div className={panelAnim} style={{ transitionDuration: `${closing ? CLOSE_ANIM_MS : OPEN_ANIM_MS}ms` }}>
        <div className="relative h-full w-full overflow-hidden rounded-2xl border border-[color:var(--overlay-border)] bg-[color:var(--overlay-surface)] shadow-2xl">
          {/* Header */}
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-[color:var(--overlay-grad-top)] via-[color:var(--overlay-grad-mid)] to-transparent px-3 pt-3 pb-6 transition-opacity duration-200 ${uiVisible ? "opacity-100" : "opacity-0"}`}
          >
            <div className="pointer-events-auto flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[color:var(--overlay-text)]">{senderLabel}</p>
                <p className="mt-0.5 text-[11px] text-[color:var(--overlay-muted)]">{current?.created_at ? formatTime(current.created_at) : ""}</p>
              </div>
              <button
                type="button"
                onClick={requestClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--overlay-btn-border)] bg-[color:var(--overlay-btn-bg)] text-[color:var(--overlay-text)] transition hover:bg-[color:var(--overlay-btn-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--overlay-ring)]"
                aria-label="Close"
                ref={closeRef}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Nav indicators */}
          <button
            type="button"
            onClick={() => canPrev && scale === 1 && onNavigate?.(index - 1)}
            disabled={!canPrev || scale !== 1}
            className={`absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full border border-[color:var(--overlay-btn-border)] bg-[color:var(--overlay-btn-bg)] p-2 text-[color:var(--overlay-text)] transition hover:bg-[color:var(--overlay-btn-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--overlay-ring)] ${uiVisible && canPrev && scale === 1 ? "opacity-100" : "opacity-0"} disabled:pointer-events-none`}
            aria-label="Previous"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => canNext && scale === 1 && onNavigate?.(index + 1)}
            disabled={!canNext || scale !== 1}
            className={`absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full border border-[color:var(--overlay-btn-border)] bg-[color:var(--overlay-btn-bg)] p-2 text-[color:var(--overlay-text)] transition hover:bg-[color:var(--overlay-btn-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--overlay-ring)] ${uiVisible && canNext && scale === 1 ? "opacity-100" : "opacity-0"} disabled:pointer-events-none`}
            aria-label="Next"
          >
            <ChevronRight size={20} />
          </button>

          {/* Viewport */}
          <div
            ref={viewportRef}
            className="relative h-full w-full touch-none select-none"
            onPointerDown={onViewportPointerDown}
            onPointerMove={onViewportPointerMove}
            onPointerUp={onViewportPointerUp}
            onPointerCancel={onViewportPointerCancel}
            onPointerLeave={onViewportPointerCancel}
            onWheel={onViewportWheel}
            onMouseMove={nudgeUiVisible}
            onTouchStart={nudgeUiVisible}
            onClick={() => {
              if (tapIntentRef.current.moved) return;
              setUiVisible((v) => !v);
            }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translateX(${swipeOffsetX}px)`
              }}
            >
              {currentIsPdf ? (
                <div className="h-full w-full px-2 pt-14 pb-16 sm:px-6">
                  {currentUrl ? (
                      <iframe
                        src={currentUrl}
                        title="PDF preview"
                        className="h-full w-full rounded-2xl border border-[color:var(--overlay-border)] bg-white shadow-2xl"
                        sandbox="allow-same-origin allow-scripts allow-downloads"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-[color:var(--overlay-border)] bg-[color:var(--overlay-btn-bg)] px-6 text-center text-sm text-[color:var(--overlay-muted)]">
                        {resolved.decrypting ? "Decrypting..." : "Unable to preview."}
                      </div>
                    )}
                </div>
              ) : isVideo ? (
                <div className="h-full w-full px-2 pt-14 pb-16 sm:px-6">
                  {currentUrl ? (
                    <video
                      controls
                      autoPlay
                      preload="auto"
                      playsInline
                      className="h-full w-full rounded-2xl border border-[color:var(--overlay-border)] bg-[color:var(--overlay-media-bg)] object-contain shadow-2xl"
                    >
                      <source src={currentUrl} />
                    </video>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-2xl border border-[color:var(--overlay-border)] bg-[color:var(--overlay-btn-bg)] px-6 text-center text-sm text-[color:var(--overlay-muted)]">
                      {resolved.decrypting ? "Decrypting..." : "Unable to preview."}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
                    transition: pointerCount >= 2 ? "none" : "transform 80ms linear"
                  }}
                >
                  {currentUrl ? (
                    <div className="relative">
                      {!mediaLoaded && (
                        <div className="absolute inset-0 rounded-2xl border border-[color:var(--overlay-border)] bg-white/5 shadow-2xl">
                          <div className="h-full w-full animate-pulse rounded-2xl bg-white/10" />
                        </div>
                      )}
                      <img
                        key={mediaLoadTick}
                        ref={mediaRef}
                        src={currentUrl}
                        alt="Media preview"
                        draggable={false}
                        className={`max-h-[92vh] max-w-[96vw] rounded-2xl border border-[color:var(--overlay-border)] object-contain shadow-2xl transition-opacity duration-200 ${mediaLoaded ? "opacity-100" : "opacity-0"}`}
                        style={{ willChange: "transform", backfaceVisibility: "hidden" }}
                        onLoad={() => {
                          setMediaLoaded(true);
                          nudgeUiVisible();
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex h-[72vh] w-[min(96vw,980px)] items-center justify-center rounded-2xl border border-[color:var(--overlay-border)] bg-[color:var(--overlay-btn-bg)] px-6 text-center text-sm text-[color:var(--overlay-muted)] shadow-2xl">
                      {resolved.decrypting ? (
                        <div className="w-full max-w-[520px]">
                          <div className="mb-3 h-2 w-24 rounded-full bg-white/10" />
                          <div className="h-10 w-full animate-pulse rounded-2xl bg-white/10" />
                          <p className="mt-3 text-xs text-[color:var(--overlay-muted)]">Decrypting media...</p>
                        </div>
                      ) : (
                        "Unable to preview."
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[color:var(--overlay-grad-bottom)] via-[color:var(--overlay-grad-mid)] to-transparent px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-6 transition-opacity duration-200 ${uiVisible ? "opacity-100" : "opacity-0"}`}
          >
            <div className="pointer-events-auto flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <a
                  href={currentUrl || ""}
                  download={downloadName}
                  className={`inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--overlay-btn-border)] bg-[color:var(--overlay-btn-bg)] px-4 text-[12px] font-semibold text-[color:var(--overlay-text)] transition hover:bg-[color:var(--overlay-btn-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--overlay-ring)] ${currentUrl ? "" : "pointer-events-none opacity-50"}`}
                  aria-label="Download"
                  title="Download"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--overlay-btn-border)] bg-[color:var(--overlay-btn-bg)] text-[color:var(--overlay-text)] transition hover:bg-[color:var(--overlay-btn-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--overlay-ring)]"
                  aria-label="Share"
                  title="Share"
                >
                  <Share2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleReact}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--overlay-btn-border)] bg-[color:var(--overlay-btn-bg)] text-[color:var(--overlay-text)] transition hover:bg-[color:var(--overlay-btn-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--overlay-ring)]"
                  aria-label="React"
                  title="React"
                >
                  <SmilePlus size={16} />
                </button>
                {isImage && (
                  <button
                    type="button"
                    onClick={handleExtractColors}
                    className={`inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--overlay-btn-border)] bg-[color:var(--overlay-btn-bg)] px-4 text-[12px] font-semibold text-[color:var(--overlay-text)] transition hover:bg-[color:var(--overlay-btn-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--overlay-ring)] ${extracting ? "opacity-75" : ""}`}
                    aria-label="Extract colors"
                    title="Extract colors"
                  >
                    <Copy size={16} />
                    <span className="hidden sm:inline">{extracting ? "Extracting..." : "Colors"}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInfo((v) => !v)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--overlay-btn-border)] bg-[color:var(--overlay-btn-bg)] text-[color:var(--overlay-text)] transition hover:bg-[color:var(--overlay-btn-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--overlay-ring)]"
                  aria-label="Info"
                  title="Info"
                >
                  <Info size={16} />
                </button>
                {Number(current?.sender_id) === Number(meId) && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/15 text-rose-100 transition hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/30"
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {(palette.length > 0 || paletteError) && (
              <div className="mt-3 rounded-2xl border border-[color:var(--overlay-border)] bg-[color:var(--overlay-btn-bg)] p-3 text-[color:var(--overlay-text)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--overlay-muted)]">
                    Palette
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPalette([]);
                      setPaletteError("");
                    }}
                    className="rounded-lg px-2 py-1 text-[11px] text-[color:var(--overlay-muted)] transition hover:bg-white/10 hover:text-[color:var(--overlay-text)]"
                  >
                    Close
                  </button>
                </div>
                {paletteError ? (
                  <p className="mt-2 text-sm text-[color:var(--overlay-muted)]">{paletteError}</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {palette.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => handleCopyHex(hex)}
                        className="group inline-flex items-center gap-2 rounded-xl border border-[color:var(--overlay-btn-border)] bg-white/5 px-3 py-2 text-[12px] font-semibold text-[color:var(--overlay-text)] transition hover:bg-white/10"
                        aria-label={`Copy ${hex}`}
                        title="Copy hex"
                      >
                        <span className="h-4 w-4 rounded-full border border-[color:var(--overlay-btn-border)]" style={{ backgroundColor: hex }} />
                        <span className="font-mono text-[12px]">{hex}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showInfo && (
              <div className="mt-3 rounded-2xl border border-[color:var(--overlay-border)] bg-[color:var(--overlay-btn-bg)] p-3 text-[12px] text-[color:var(--overlay-muted)]">
                <p className="font-semibold text-[color:var(--overlay-text)]">Details</p>
                <div className="mt-2 space-y-1">
                  <p className="opacity-90">
                    <span className="text-[color:var(--overlay-muted)]">Type:</span>{" "}
                    {currentIsPdf ? "PDF" : (currentKind || "media")}
                  </p>
                  {current?.e2ee?.media?.mime && (
                    <p className="opacity-90">
                      <span className="text-[color:var(--overlay-muted)]">MIME:</span> {current.e2ee.media.mime}
                    </p>
                  )}
                  {current?.e2ee?.media?.size && (
                    <p className="opacity-90">
                      <span className="text-[color:var(--overlay-muted)]">Size:</span> {Math.round(Number(current.e2ee.media.size) / 1024)} KB
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
