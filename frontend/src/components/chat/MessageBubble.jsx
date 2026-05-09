import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  CheckSquare,
  Copy,
  CornerUpLeft,
  Download,
  ExternalLink,
  FileText,
  Forward,
  Loader2,
  Paperclip,
  Pencil,
  SaveIcon,
  Share2,
  SmilePlus,
  Star,
  Trash2,
  Wallpaper,
  X
} from "lucide-react";
import { createPortal } from "react-dom";
import EmojiPicker from "emoji-picker-react";
import twemoji from "twemoji";
import { formatTime } from "../../utils/time";
import { isVideoMedia, mediaSrc } from "../../utils/chat";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { decryptMediaToObjectUrl, getOrCreateRsaKeyPair } from "../../utils/e2ee";
import useMessageReactions, { QUICK_REACTIONS } from "../../hooks/useMessageReactions";
import useSwipeReply from "../../hooks/useSwipeReply";

const EDIT_WINDOW_MS = 10 * 60 * 1000;
const DOUBLE_TAP_MS = 300;
const REACTION_PICKER = [
  ...QUICK_REACTIONS,
  "\uD83D\uDE0D",
  "\uD83D\uDE31",
  "\uD83D\uDE22",
  "\uD83D\uDE21",
  "\uD83C\uDF89",
  "\uD83E\uDD14"
];

function isEmojiOnlyMessage(value) {
  const text = (value || "").trim();
  if (!text) return false;
  const compact = text.replace(/\s+/g, "");
  const nonEmoji = compact
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\u200D/g, "")
    .replace(/\uFE0F/g, "");
  if (nonEmoji.length) return false;
  const emojiCount = (compact.match(/[\p{Extended_Pictographic}]/gu) || []).length;
  return emojiCount > 0 && emojiCount <= 10;
}

function escapeHtml(value) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linkifyHtml(value) {
  const text = (value || "").toString();
  if (!text) return "";

  const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;"')\]}])/gi;
  let out = "";
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const raw = match[0] || "";
    const index = match.index || 0;

    out += escapeHtml(text.slice(lastIndex, index));

    let href = raw;
    if (!/^https?:\/\//i.test(href)) href = `https://${href}`;

    let ok = true;
    try {
      const parsed = new URL(href);
      if (!/^https?:$/.test(parsed.protocol)) ok = false;
    } catch {
      ok = false;
    }

    if (!ok) {
      out += escapeHtml(raw);
    } else {
      out += `<a class="message-link" href="${escapeAttr(href)}" target="_blank" rel="noreferrer noopener" referrerpolicy="no-referrer">${escapeHtml(raw)}</a>`;
    }

    lastIndex = index + raw.length;
  }

  out += escapeHtml(text.slice(lastIndex));
  return out;
}

function emojiHtml(value) {
  return twemoji.parse(value || "", {
    folder: "svg",
    ext: ".svg",
    className: "twemoji-icon"
  });
}

function normalizeInlineHex(input) {
  const raw = (input || "").toString().trim();
  if (!raw.startsWith("#")) return "";
  const hex = raw.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex.split("").map((c) => c + c).join("").toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
  return "";
}

function richifyPlaceholders(value) {
  let text = (value || "").toString();
  const stash = [];
  function token(html) {
    const id = stash.length;
    stash.push(html);
    return `\u0000${id}\u0000`;
  }

  // Code spans first (prevents formatting inside code).
  text = text.replace(/`([^`\n]+?)`/g, (_m, inner) => token(`<code class="message-code">${escapeHtml(inner)}</code>`));

  // Color tags: [color:#ff00ff]text[/color] or [c=#ff00ff]text[/c]
  text = text.replace(
    /\[(?:color|c)\s*[:=]\s*(#[0-9a-fA-F]{3,6})\]([\s\S]*?)\[\/(?:color|c)\]/gi,
    (match, hex, inner) => {
      const normalized = normalizeInlineHex(hex);
      if (!normalized) return escapeHtml(match);
      return token(`<span class="message-color" style="color:${normalized}">${escapeHtml(inner)}</span>`);
    }
  );

  // Glow effect: [glow]text[/glow]
  text = text.replace(/\[glow\]([\s\S]*?)\[\/glow\]/gi, (_m, inner) => token(`<span class="message-glow">${escapeHtml(inner)}</span>`));

  // Custom link: label[url] -> clickable label
  text = text.replace(
    /(^|[\s(])([^\n[\]]{1,80}?)\[((?:https?:\/\/|www\.)[^\s\]]+)\]/g,
    (_m, lead, label, rawHref) => {
      const trimmedLabel = (label || "").toString().trim();
      if (!trimmedLabel) return _m;
      let href = (rawHref || "").toString().trim();
      if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
      let ok = true;
      try {
        const parsed = new URL(href);
        if (!/^https?:$/.test(parsed.protocol)) ok = false;
      } catch {
        ok = false;
      }
      if (!ok) return `${lead}${escapeHtml(`${trimmedLabel}[${rawHref}]`)}`;
      return `${lead}${token(`<a class="message-link" href="${escapeAttr(href)}" target="_blank" rel="noreferrer noopener" referrerpolicy="no-referrer">${escapeHtml(trimmedLabel)}</a>`)}`;
    }
  );

  // Basic markdown-like styling (non-nesting, best-effort).
  text = text.replace(/__([^_\n][\s\S]*?)__/g, (_m, inner) => token(`<u>${escapeHtml(inner)}</u>`));
  text = text.replace(/\*\*([^\n]+?)\*\*/g, (_m, inner) => token(`<strong>${escapeHtml(inner)}</strong>`));
  text = text.replace(/~{2,}([^\n]+?)~{2,}/g, (_m, inner) => token(`<s>${escapeHtml(inner)}</s>`));
  text = text.replace(/\*(?!\*)([^\n*]+?)\*(?!\*)/g, (_m, inner) => token(`<em>${escapeHtml(inner)}</em>`));

  return { text, stash };
  return { text, stash };
}

function messageHtml(value) {
  const { text, stash } = richifyPlaceholders(value);
  const withLinks = linkifyHtml(text);
  const withEmoji = emojiHtml(withLinks);
  // eslint-disable-next-line no-control-regex
  const withRich = withEmoji.replace(/\u0000(\d+)\u0000/g, (_m, id) => stash[Number(id)] || "");
  return withRich.replace(/\n/g, "<br/>");
}

function replyPreviewText(message) {
  if (!message?.reply_to_message_id) return "";
  if (message.reply_to_deleted_for_everyone) return "This message was deleted";
  if (message.reply_to_body) return message.reply_to_body;
  if (message.reply_to_image_url) return "[media]";
  return "Original message not available";
}

function formatBytes(bytes) {
  const normalized = Number(bytes);
  if (!Number.isFinite(normalized) || normalized <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = normalized;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function extensionFromMime(mime = "") {
  const value = (mime || "").toString().toLowerCase().split(";")[0].trim();
  if (value === "application/pdf") return "pdf";
  if (value === "image/png") return "png";
  if (value === "image/jpeg") return "jpg";
  if (value === "image/webp") return "webp";
  if (value === "image/gif") return "gif";
  if (value === "video/mp4") return "mp4";
  if (value === "video/webm") return "webm";
  if (value === "video/quicktime") return "mov";
  if (value === "text/plain") return "txt";
  if (value === "application/zip") return "zip";
  if (value === "application/msword") return "doc";
  if (value === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (value === "application/vnd.ms-excel") return "xls";
  if (value === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (value === "application/vnd.ms-powerpoint") return "ppt";
  if (value === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  return "bin";
}

function downloadFilenameForMessage(message, mime = "") {
  const ext = extensionFromMime(mime);
  const kind = (message?.e2ee?.media?.kind || "file").toString().trim() || "file";
  const messageId = (message?.id || "media").toString();
  return `anach-${kind}-${messageId}.${ext}`;
}

function MessageBubble({
  message,
  mine,
  centerAligned = false,
  grouped,
  uploadBase,
  onOpenMedia,
  onReply,
  onDeleteLocal,
  onEditMessage,
  onDeleteForEveryone,
  onToggleStar,
  onReact,
  onForward,
  onSelectToggle,
  selected,
  notify
}) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const meId = user?.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState({ x: 0, y: 0 });
  const [menuStyle, setMenuStyle] = useState({ left: 0, top: 0 });
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [decryptedMediaUrl, setDecryptedMediaUrl] = useState("");
  const [decryptingMedia, setDecryptingMedia] = useState(false);
  const [savingToPhone, setSavingToPhone] = useState(false);
  const [sendingToStatus, setSendingToStatus] = useState(false);
  const menuRef = useRef(null);
  const menuPopupRef = useRef(null);
  const reactionBarRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const editInputRef = useRef(null);
  const longPressTimer = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const lastTapAtRef = useRef(0);
  const pressPointRef = useRef({ x: 0, y: 0 });
  const [anchorRect, setAnchorRect] = useState(null);
  const [reactionBarStyle, setReactionBarStyle] = useState({ left: 0, top: 0 });

  const deleted = Boolean(message.deleted_for_everyone);
  const encryptedMedia = Boolean(message.image_url && !deleted && message.e2ee?.key && message.e2ee?.media?.iv);
  const cipherSrc = useMemo(() => mediaSrc(uploadBase, message.image_url), [uploadBase, message.image_url]);
  const src = useMemo(() => {
    if (!message.image_url) return "";
    if (encryptedMedia) return decryptedMediaUrl || "";
    return cipherSrc;
  }, [cipherSrc, decryptedMediaUrl, encryptedMedia, message.image_url]);
  const mediaKind = useMemo(() => {
    const kind = message.e2ee?.media?.kind;
    if (kind) return kind;
    if (!message.image_url) return null;
    return isVideoMedia(message.image_url) ? "video" : "image";
  }, [message.e2ee?.media?.kind, message.image_url]);
  const isVideo = mediaKind === "video";
  const isImage = mediaKind === "image";
  const isFile = mediaKind === "file";
  const mediaMime = (message.e2ee?.media?.mime || "").toString();
  const mediaSize = message.e2ee?.media?.size;
  const isPdf = isFile && /^application\/pdf\b/i.test(mediaMime);
  const downloadName = useMemo(() => downloadFilenameForMessage(message, mediaMime), [message?.id, mediaMime, message?.e2ee?.media?.kind]);
  const displayBody = deleted ? "This message was deleted" : (message.body || "");
  const emojiOnly = useMemo(
    () => !message.image_url && !deleted && isEmojiOnlyMessage(displayBody),
    [deleted, displayBody, message.image_url]
  );
  const bodyHtml = useMemo(() => messageHtml(displayBody), [displayBody]);
  const { reactions, toggleReaction, quickReactions } = useMessageReactions(message, onReact);
  const canEdit = useMemo(() => {
    if (!mine || deleted || !message.body || message.image_url) return false;
    const createdMs = new Date(message.created_at).getTime();
    if (!Number.isFinite(createdMs)) return false;
    return Date.now() - createdMs <= EDIT_WINDOW_MS;
  }, [deleted, message.body, message.created_at, message.image_url, mine]);
  const canForward = !deleted && Boolean(message.body || message.image_url);
  const replyPreview = useMemo(() => replyPreviewText(message), [message]);
  const swipe = useSwipeReply({
    enabled: !centerAligned && !deleted && typeof onReply === "function" && !editing && !menuOpen && !reactionPickerOpen,
    onReply: () => {
      onReply?.(message);
      setMenuOpen(false);
      setReactionPickerOpen(false);
    }
  });

  useEffect(() => {
    if (!menuOpen && !reactionPickerOpen) return undefined;

    function close(event) {
      const target = event.target;
      const withinBubble = Boolean(menuRef.current?.contains(target));
      const withinDesktopMenu = Boolean(menuPopupRef.current?.contains(target));
      const withinReactionBar = Boolean(reactionBarRef.current?.contains(target));
      const withinMobileMenu = Boolean(mobileMenuRef.current?.contains(target));
      if (!withinBubble && !withinDesktopMenu && !withinReactionBar && !withinMobileMenu) {
        setMenuOpen(false);
        setReactionPickerOpen(false);
      }
    }

    window.addEventListener("mousedown", close);
    window.addEventListener("touchstart", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("touchstart", close);
    };
  }, [menuOpen, reactionPickerOpen]);

  function openMediaViewer() {
    if (typeof onOpenMedia === "function" && message?.id) onOpenMedia(message.id);
  }

  useEffect(() => {
    if (menuOpen || reactionPickerOpen) return;
    setEmojiPickerOpen(false);
    setDeleteConfirm("");
  }, [menuOpen, reactionPickerOpen]);

  function openMenuAtPoint({ x, y }) {
    const nextX = Number.isFinite(Number(x)) ? Number(x) : 0;
    const nextY = Number.isFinite(Number(y)) ? Number(y) : 0;
    setReactionPickerOpen(false);
    setEmojiPickerOpen(false);
    setDeleteConfirm("");
    setMenuCoords({ x: nextX, y: nextY });
    setMenuStyle({ left: nextX, top: nextY });
    setReactionBarStyle({ left: nextX, top: nextY });
    const rect = menuRef.current?.getBoundingClientRect?.();
    setAnchorRect(rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null);
    setMenuOpen(true);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const popup = menuPopupRef.current;
    if (!popup) return;

    const rect = popup.getBoundingClientRect();
    const padding = 12;
    const offset = 8;

    let left = menuCoords.x + offset;
    let top = menuCoords.y + offset;

    // Prefer opening away from the nearest screen edge (feels more native to chat apps).
    if (left + rect.width > window.innerWidth - padding) {
      left = menuCoords.x - rect.width - offset;
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = menuCoords.y - rect.height - offset;
    }

    left = Math.max(padding, Math.min(left, window.innerWidth - rect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - rect.height - padding));

    setMenuStyle({ left, top });
  }, [deleteConfirm, emojiPickerOpen, menuCoords.x, menuCoords.y, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const bar = reactionBarRef.current;
    if (!bar) return;
    if (deleteConfirm) return;

    const padding = 12;
    const offset = 10;
    const rect = bar.getBoundingClientRect();
    const fallback = anchorRect;
    const baseX = fallback ? fallback.left + fallback.width / 2 : menuCoords.x;
    const baseTop = fallback ? fallback.top : menuCoords.y;

    let left = baseX - rect.width / 2;
    let top = baseTop - rect.height - offset;

    if (top < padding) {
      const below = fallback ? (fallback.top + fallback.height + offset) : (menuCoords.y + offset);
      top = below;
    }

    left = Math.max(padding, Math.min(left, window.innerWidth - rect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - rect.height - padding));
    setReactionBarStyle({ left, top });
  }, [anchorRect, deleteConfirm, menuCoords.x, menuCoords.y, menuOpen]);

  useEffect(() => {
    if (!editing) return undefined;
    setEditDraft((prev) => (prev ? prev : (message.body || "")));
    const timer = setTimeout(() => editInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [editing, message.body]);

  useEffect(() => {
    setEditing(false);
    setEditDraft("");
    setEmojiPickerOpen(false);
    setDeleteConfirm("");
  }, [message.id]);

  useEffect(() => () => clearTimeout(longPressTimer.current), []);

  useEffect(() => {
    if (!encryptedMedia || !cipherSrc || !meId) {
      setDecryptedMediaUrl("");
      setDecryptingMedia(false);
      return undefined;
    }

    let canceled = false;
    let revokeUrl = "";

    async function run() {
      setDecryptingMedia(true);
      setDecryptedMediaUrl("");
      try {
        const pair = await getOrCreateRsaKeyPair(meId);
        const response = await fetch(cipherSrc, { credentials: "include" });
        const encryptedBytes = await response.arrayBuffer();
        const result = await decryptMediaToObjectUrl({
          e2ee: message.e2ee,
          privateJwk: pair.privateJwk,
          encryptedBytes
        });
        if (canceled) {
          if (result?.url) URL.revokeObjectURL(result.url);
          return;
        }
        revokeUrl = result?.url || "";
        setDecryptedMediaUrl(revokeUrl);
      } catch {
        // keep media hidden if decryption fails
      } finally {
        if (!canceled) setDecryptingMedia(false);
      }
    }

    run();

    return () => {
      canceled = true;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [cipherSrc, encryptedMedia, meId, message.id, message.e2ee?.key, message.e2ee?.media?.iv]);

  const showTail = false; // modern bubble style (no tail)
  const bubbleRadius = "rounded-[18px]";

  const bubblePadding = emojiOnly ? "px-4 py-3" : "px-[18px] py-[12px]";
  const bubbleRing = selected ? "ring-2 ring-accent ring-offset-1 ring-offset-white dark:ring-offset-slate-950" : "";
  const bubbleHoverShadow = mine
    ? "sm:hover:shadow-[0_18px_48px_rgb(var(--accent-500-rgb)_/_0.26)]"
    : "sm:hover:shadow-[0_18px_44px_rgb(var(--accent-500-rgb)_/_0.14)]";
  const bubbleTone = mine
    ? "border-white/10 text-[color:var(--bubble-out-text)] bg-[radial-gradient(120%_120%_at_15%_0%,rgba(236,72,153,0.22)_0%,transparent_60%),linear-gradient(135deg,rgb(var(--accent-700-rgb)_/_1),rgb(var(--accent-400-rgb)_/_1))]"
    : "border-[color:var(--bubble-in-border)] text-[color:var(--bubble-in-text)] backdrop-blur-md";
  const bubbleHoverBorder = mine
    ? "hover:border-white/20"
    : "hover:border-[color:var(--panel-border)]";
  const bubbleClass = `relative overflow-hidden border ${bubbleRadius} ${bubbleTone} ${bubblePadding} ${bubbleRing} ${bubbleHoverShadow} ${bubbleHoverBorder} shadow-[0_2px_8px_rgba(0,0,0,0.30)] transition-[transform,box-shadow,border-color,filter] duration-200 ease-out hover:brightness-105 sm:hover:scale-[1.01]`;

  function openMenuAtBubble() {
    const rect = menuRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    openMenuAtPoint({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  function handleKeyDown(event) {
    const target = event.target;
    const tag = target?.tagName?.toLowerCase?.() || "";
    if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
      setReactionPickerOpen(false);
      setEmojiPickerOpen(false);
      setDeleteConfirm("");
      if (editing) cancelEdit();
      return;
    }

    const openMenuShortcut = event.key === "ContextMenu" || (event.shiftKey && event.key === "F10") || event.key === "m";
    if (openMenuShortcut) {
      event.preventDefault();
      if (!editing) openMenuAtBubble();
      return;
    }

    if (deleted || editing || menuOpen || reactionPickerOpen) return;

    const key = (event.key || "").toLowerCase();
    if (key === "r") {
      event.preventDefault();
      onReply?.(message);
      return;
    }
    if (key === "c") {
      event.preventDefault();
      handleCopy();
      return;
    }
    if (key === "s") {
      event.preventDefault();
      onToggleStar?.(message);
      return;
    }
    if (key === "f") {
      event.preventDefault();
      if (canForward) onForward?.(message);
      return;
    }
    if (key === "e") {
      event.preventDefault();
      handleEdit();
      return;
    }
    if (key === "d") {
      event.preventDefault();
      if (message.image_url && src) handleSaveToPhone();
      return;
    }
    if (event.key === "Enter") {
      if (message.image_url && src && (isImage || isPdf || isVideo)) {
        event.preventDefault();
        openMediaViewer();
      }
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      requestDeleteConfirm("local");
    }
  }

  function beginLongPress() {
    if (editing) return;
    clearTimeout(longPressTimer.current);
    longPressTriggeredRef.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      if (!selected) onSelectToggle?.(message);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(10);
      }
      setReactionPickerOpen(false);
      openMenuAtPoint(pressPointRef.current || { x: 0, y: 0 });
    }, 420);
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer.current);
  }

  function handleTapEnd(event) {
    cancelLongPress();
    if (editing) return;
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    const now = Date.now();
    const elapsed = now - lastTapAtRef.current;
    lastTapAtRef.current = now;

    if (!deleted && elapsed > 0 && elapsed <= DOUBLE_TAP_MS) {
      event.preventDefault();
      onReply?.(message);
      setMenuOpen(false);
      setReactionPickerOpen(false);
    }
  }

  function handleReactionSelect(reaction) {
    toggleReaction(reaction);
    setEmojiPickerOpen(false);
    setReactionPickerOpen(false);
    setMenuOpen(false);
  }

  async function handleCopy() {
    if (!message.body) return;
    try {
      await navigator.clipboard.writeText(message.body);
      notify?.({ type: "success", message: "Message copied" });
    } catch {
      notify?.({ type: "error", message: "Unable to copy message" });
    } finally {
      setMenuOpen(false);
    }
  }

  function handleEdit() {
    if (!canEdit) return;
    setMenuOpen(false);
    setReactionPickerOpen(false);
    setEmojiPickerOpen(false);
    setEditing(true);
  }

  async function commitEdit() {
    if (!canEdit || deleted) return;
    const nextBody = (editDraft || "").trim();
    if (!nextBody) {
      notify?.({ type: "info", message: "Message cannot be empty." });
      return;
    }

    if (nextBody === (message.body || "").trim()) {
      setEditing(false);
      setEditDraft("");
      return;
    }

    setEditSaving(true);
    try {
      await onEditMessage?.(message, nextBody);
      setEditing(false);
      setEditDraft("");
    } finally {
      setEditSaving(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setEditDraft("");
  }

  async function handleSaveToPhone() {
    if (!src) return;
    setSavingToPhone(true);
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify?.({ type: "success", title: "Saved", message: "Media saved to downloads" });
    } catch (err) {
      notify?.({ type: "error", title: "Save failed", message: err.message });
    } finally {
      setSavingToPhone(false);
      setMenuOpen(false);
    }
  }

  async function handleSetAsWallpaper() {
    if (!isImage || !src) return;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const canvas = document.createElement("canvas");
      const img = new Image();
      img.onload = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        const wallpaperUrl = canvas.toDataURL();
        localStorage.setItem("chatWallpaper", wallpaperUrl);
        window.location.reload();
        notify?.({ type: "success", title: "Wallpaper set", message: "Chat wallpaper updated" });
      };
      img.src = URL.createObjectURL(blob);
    } catch (err) {
      notify?.({ type: "error", title: "Failed", message: err.message });
    } finally {
      setMenuOpen(false);
    }
  }

  async function handleSendToStatus() {
    if (!message.image_url || !src) return;
    setSendingToStatus(true);
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append("media", blob, downloadName);
      await fetch("/api/status", { method: "POST", body: formData });
      notify?.({ type: "success", title: "Sent", message: "Added to your status" });
    } catch (err) {
      notify?.({ type: "error", title: "Failed", message: err.message });
    } finally {
      setSendingToStatus(false);
      setMenuOpen(false);
    }
  }

  function requestDeleteConfirm(mode) {
    setDeleteConfirm(mode);
  }

  return (
    <>
      <div
        className={`flex ${centerAligned ? "justify-center" : (mine ? "justify-end" : "justify-start")}`}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (editing) return;
          setReactionPickerOpen(false);
          setEmojiPickerOpen(false);
          openMenuAtPoint({ x: event.clientX, y: event.clientY });
        }}
        onDoubleClick={() => {
          if (deleted || editing) return;
          onReply?.(message);
          setMenuOpen(false);
          setReactionPickerOpen(false);
        }}
        onTouchStart={(event) => {
          const touch = event.touches?.[0];
          if (touch) pressPointRef.current = { x: touch.clientX, y: touch.clientY };
          swipe.onTouchStart(event);
          beginLongPress();
        }}
        onTouchMove={(event) => {
          swipe.onTouchMove(event);
          cancelLongPress();
        }}
        onTouchEnd={(event) => {
          const consumed = swipe.onTouchEnd();
          if (consumed) {
            cancelLongPress();
            return;
          }
          handleTapEnd(event);
        }}
        onTouchCancel={() => {
          swipe.reset();
          cancelLongPress();
        }}
      >
        <div
          className="relative max-w-[86%] sm:max-w-[70%] focus-visible:outline-none"
          ref={menuRef}
          tabIndex={deleted ? -1 : 0}
          role="group"
          aria-label={mine ? "Your message" : "Message"}
          onKeyDown={handleKeyDown}
        >
          {!centerAligned && !deleted && typeof onReply === "function" && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-0.5">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full border border-accent bg-accent-soft text-accent shadow-sm"
                style={{
                  opacity: Math.min(1, swipe.offset / 24),
                  transform: `scale(${0.85 + Math.min(1, swipe.offset / 96) * 0.15})`
                }}
              >
                <CornerUpLeft size={14} />
              </div>
            </div>
          )}

          <div
            className="relative chat-message-in"
            style={{
              transform: swipe.offset ? `translate3d(${swipe.offset}px,0,0)` : undefined,
              transition: swipe.swiping ? "none" : "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)"
            }}
          >
            {canForward && !deleted && typeof onForward === "function" && (
              <button
                type="button"
                onClick={() => onForward(message)}
                className={`pointer-events-none absolute top-2 z-20 hidden h-9 w-9 items-center justify-center rounded-full border text-white/90 opacity-0 shadow-xl backdrop-blur-md transition sm:inline-flex sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 ${
                  mine
                    ? "-left-2 -translate-x-full border-white/15 bg-black/35 hover:bg-black/50"
                    : "-right-2 translate-x-full border-white/10 bg-black/30 hover:bg-black/45"
                }`}
                aria-label="Forward message"
                title="Forward"
              >
                <Forward size={16} />
              </button>
            )}
            {showTail && (
              <span
                aria-hidden
                className={`absolute bottom-2.5 h-4 w-4 rotate-45 rounded-[4px] border shadow-md ${
                  mine
                    ? "-right-[6px] border-white/10 shadow-[0_18px_52px_rgb(var(--accent-500-rgb)_/_0.28)] bg-[linear-gradient(135deg,rgb(var(--accent-700-rgb)_/_1),rgb(var(--accent-400-rgb)_/_1))]"
                    : "-left-[6px] border-slate-200/80 bg-white/70 backdrop-blur-md shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-950/35"
                }`}
              />
            )}
            <div
              className={bubbleClass}
              style={mine ? undefined : { backgroundImage: "var(--bubble-in-bg)", backgroundColor: "var(--bubble-in-tint)" }}
            >
            {message.reply_to_message_id && !deleted && (
              <div className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[11px] ${
                mine
                  ? "border-white/80 bg-white/18"
                  : "border-accent bg-accent-soft text-slate-700 dark:bg-slate-800/85 dark:text-slate-200"
              }`}>
                <p className={`truncate font-semibold ${mine ? "" : "text-accent"}`}>
                  {message.reply_to_sender_name || "Reply"}
                </p>
                <p className={`line-clamp-2 break-words ${mine ? "text-white/90" : "text-slate-600 dark:text-slate-300"}`}>
                  {replyPreview}
                </p>
              </div>
            )}

            {editing && canEdit && !deleted && (
              <div className="space-y-2">
                <textarea
                  ref={editInputRef}
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelEdit();
                      return;
                    }
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void commitEdit();
                    }
                  }}
                  rows={1}
                  className={`w-full resize-none rounded-xl border px-3 py-2 text-[14px] leading-5 outline-none transition ${
                    mine
                      ? "border-white/25 bg-white/15 text-white placeholder:text-white/70 focus:border-white/45 focus:ring-2 focus:ring-white/25"
                      : "border-slate-200 bg-white/80 text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-violet-500"
                  }`}
                  placeholder="Edit message"
                  aria-label="Edit message"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={editSaving}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                      mine
                        ? "border-white/30 bg-white/10 text-white hover:bg-white/15"
                        : "border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <X size={13} />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void commitEdit()}
                    disabled={editSaving || !(editDraft || "").trim()}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${
                      mine
                        ? "bg-white/90 text-violet-800 hover:bg-white"
                        : "bg-violet-500 text-white hover:bg-violet-600"
                    }`}
                  >
                    {editSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Save
                  </button>
                </div>
              </div>
            )}

            {!editing && displayBody && (
              <p
                className={`message-body break-words ${deleted ? "italic opacity-80" : ""} ${emojiOnly ? "message-body--emoji text-[28px] leading-tight tracking-tight" : "text-[14px] leading-5"}`}
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            )}

            {message.image_url && isFile && !deleted && (
              <div className="mt-2 w-full max-w-[360px] overflow-hidden rounded-2xl border border-black/10 bg-black/5 text-[11px] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-violet-700 shadow-sm dark:bg-slate-950/40 dark:text-violet-200">
                    {isPdf ? <FileText size={18} /> : <Paperclip size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">
                      {isPdf ? "PDF document" : "Attachment"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] opacity-80">
                      {mediaMime ? mediaMime : "file"}{mediaSize ? ` • ${formatBytes(mediaSize)}` : ""}
                    </p>
                  </div>
                  {encryptedMedia && !src ? (
                    <div className="shrink-0 text-[11px] opacity-80">
                      {decryptingMedia ? "Decrypting..." : "Locked"}
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isPdf && (
                        <button
                          type="button"
                          onClick={openMediaViewer}
                          className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-100 dark:hover:bg-slate-950/55"
                          aria-label="View PDF"
                          title="View PDF"
                        >
                          <ExternalLink size={13} />
                          View
                        </button>
                      )}
                      <a
                        href={src || cipherSrc}
                        download={downloadName}
                        className="inline-flex items-center gap-1 rounded-xl bg-violet-500 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-violet-600"
                        aria-label="Download attachment"
                        title="Download"
                      >
                        <Download size={13} />
                        Download
                      </a>
                    </div>
                  )}
                </div>
                {encryptedMedia && !src && (
                  <div className="border-t border-black/10 px-3 py-2 text-[11px] opacity-80 dark:border-white/10">
                    {decryptingMedia ? "Decrypting attachment for you…" : "Unable to decrypt attachment."}
                  </div>
                )}
              </div>
            )}

            {message.image_url && isImage && !deleted && (
              encryptedMedia && !src ? (
                <div className="mt-2 w-full max-w-[340px] rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-[11px] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  {decryptingMedia ? "Decrypting media..." : "Unable to decrypt media."}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openMediaViewer}
                  className="mt-2 block max-w-full overflow-hidden rounded-2xl border border-black/10 shadow-[0_14px_40px_rgba(0,0,0,0.18)] transition duration-200 hover:brightness-110 hover:shadow-[0_18px_56px_rgba(0,0,0,0.26)] sm:hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                  aria-label="Open image preview"
                >
                  <img
                    src={src}
                    alt="message media"
                    className="h-auto w-full max-h-[30vh] object-cover sm:max-w-[360px]"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              )
            )}

            {message.image_url && isVideo && !deleted && (
              encryptedMedia && !src ? (
                <div className="mt-2 w-full max-w-[340px] rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-[11px] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  {decryptingMedia ? "Decrypting media..." : "Unable to decrypt media."}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openMediaViewer}
                  className="mt-2 block max-w-full overflow-hidden rounded-2xl border border-black/10 shadow-[0_14px_40px_rgba(0,0,0,0.18)] transition duration-200 hover:brightness-110 hover:shadow-[0_18px_56px_rgba(0,0,0,0.26)] sm:hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                  aria-label="Open video preview"
                >
                  <video preload="metadata" className="h-auto w-full max-h-[30vh] bg-black sm:max-w-[360px]">
                    <source src={src} />
                  </video>
                </button>
              )
            )}

            <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${centerAligned ? "justify-center" : "justify-end"} ${mine ? "text-[color:var(--bubble-out-meta)]" : "text-[color:var(--bubble-in-meta)]"}`}>
              {Boolean(message.my_starred) && <Star size={11} className={mine ? "fill-current text-amber-100" : "fill-amber-500 text-amber-500"} />}
              <span>{formatTime(message.created_at)}</span>
              {mine && !centerAligned && <SeenStatus message={message} />}
            </div>
          </div>
          </div>

          {reactions.length > 0 && !deleted && (
            <div className={`mt-1 flex ${centerAligned ? "justify-center" : (mine ? "justify-end" : "justify-start")}`}>
              <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] text-slate-700 shadow-sm dark:border-white/15 dark:bg-slate-900 dark:text-slate-200">
                {reactions.map(([reaction, count]) => (
                  <button
                    key={reaction}
                    type="button"
                    onClick={() => toggleReaction(reaction)}
                    className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 transition active:scale-95 ${
                      message.my_reaction === reaction
                        ? "border-violet-300/70 bg-violet-100/80 text-violet-800 dark:border-violet-500/60 dark:bg-violet-500/20 dark:text-violet-200"
                        : "border-black/10 bg-white/80 text-slate-700 dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-200"
                    }`}
                  >
                    <span className="text-[12px] leading-none">{reaction}</span>
                    <span>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {reactionPickerOpen && !deleted && (
            <>
              <button
                type="button"
                onClick={() => setReactionPickerOpen(false)}
                className="fixed inset-0 z-[110] bg-slate-950/55"
                aria-label="Close reactions"
              />
              <div className="fixed inset-x-2 bottom-2 z-[120] max-h-[74vh] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white/98 p-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-700 dark:bg-slate-900/96 sm:inset-x-0 sm:bottom-6 sm:mx-auto sm:max-w-[520px]">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    React to message
                  </p>
                  <button
                    type="button"
                    onClick={() => setReactionPickerOpen(false)}
                    className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    aria-label="Close reactions"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-1.5 px-0.5">
                  {REACTION_PICKER.map((reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      onClick={() => handleReactionSelect(reaction)}
                      className={`inline-flex h-9 items-center justify-center rounded-lg border text-base transition ${
                        message.my_reaction === reaction
                          ? "border-violet-400 bg-violet-50 dark:border-violet-500/60 dark:bg-violet-500/20"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                      }`}
                      aria-label={`React ${reaction}`}
                    >
                      <span className="text-[18px] leading-none">{reaction}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setEmojiPickerOpen((v) => !v)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <SmilePlus size={14} />
                    {emojiPickerOpen ? "Hide emojis" : "More emojis"}
                  </button>

                  {emojiPickerOpen && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                      <EmojiPicker
                        width="100%"
                        height={320}
                        lazyLoadEmojis
                        theme={theme === "dark" ? "dark" : "light"}
                        onEmojiClick={(emoji) => handleReactionSelect(emoji.emoji)}
                      />
                    </div>
                  )}

                  {message.my_reaction && (
                    <button
                      type="button"
                      onClick={() => {
                        onReact?.(message, "");
                        setEmojiPickerOpen(false);
                        setReactionPickerOpen(false);
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Remove my reaction
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {menuOpen && typeof document !== "undefined" && createPortal((
            <>
              {!deleted && !deleteConfirm && (
                <div
                  ref={reactionBarRef}
                  onContextMenu={(event) => event.preventDefault()}
                  style={{ left: reactionBarStyle.left, top: reactionBarStyle.top }}
                  className="chat-menu-in fixed z-[130] inline-flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                >
                  {quickReactions.map((reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      onClick={() => handleReactionSelect(reaction)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-base transition active:scale-95 ${
                        message.my_reaction === reaction
                          ? "border-violet-400 bg-violet-50 dark:border-violet-500/60 dark:bg-violet-500/20"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                      }`}
                      aria-label={`React ${reaction}`}
                    >
                      <span className="text-[18px] leading-none">{reaction}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setReactionPickerOpen(true);
                      setEmojiPickerOpen(true);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    aria-label="More reactions"
                    title="More reactions"
                  >
                    <SmilePlus size={16} />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-[110] bg-slate-950/55 sm:hidden"
                aria-label="Close message options"
              />
              <div
                ref={mobileMenuRef}
                onContextMenu={(event) => event.preventDefault()}
                className="fixed inset-x-2 bottom-2 z-[120] max-h-[74vh] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white/98 p-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-700 dark:bg-slate-900/96 sm:hidden"
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Message options</p>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    aria-label="Close options"
                  >
                    <X size={14} />
                  </button>
                </div>

                {deleteConfirm && (
                  <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100">
                    <p className="font-semibold">Delete this message?</p>
                    <p className="mt-0.5 text-[11px] text-rose-700/90 dark:text-rose-200/90">
                      {deleteConfirm === "everyone"
                        ? "This will remove the message for everyone in this chat."
                        : "This will delete the message only for you."}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm("")}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-rose-200 bg-white/85 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-white dark:border-rose-500/25 dark:bg-slate-950/30 dark:text-rose-200 dark:hover:bg-slate-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (deleteConfirm === "everyone") {
                            await onDeleteForEveryone?.(message);
                          } else {
                            await onDeleteLocal?.(message);
                          }
                          setDeleteConfirm("");
                          setMenuOpen(false);
                        }}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {!deleteConfirm && (
                  <div className="grid grid-cols-1 gap-1">
                  <MenuButton
                    icon={<CheckSquare size={13} />}
                    label={selected ? "Unselect" : "Select"}
                    onClick={() => {
                      onSelectToggle?.(message);
                      setMenuOpen(false);
                    }}
                  />
                  <MenuButton
                    icon={<CornerUpLeft size={13} />}
                    label="Reply"
                    onClick={() => {
                      onReply?.(message);
                      setMenuOpen(false);
                    }}
                  />
                  {message.body && <MenuButton icon={<Copy size={13} />} label="Copy" onClick={handleCopy} />}
                  {canEdit && <MenuButton icon={<Pencil size={13} />} label="Edit" onClick={handleEdit} />}
                  <MenuButton
                    icon={<Star size={13} />}
                    label={message.my_starred ? "Unstar" : "Star"}
                    onClick={() => {
                      onToggleStar?.(message);
                      setMenuOpen(false);
                    }}
                  />
                  {canForward && (
                    <MenuButton
                      icon={<Forward size={13} />}
                      label="Forward"
                      onClick={() => {
                        onForward?.(message);
                        setMenuOpen(false);
                      }}
                    />
                  )}
                  {(isImage || isVideo || isPdf) && (
                    <>
                      {isImage && (
                        <MenuButton
                          icon={<Wallpaper size={13} />}
                          label="Set as wallpaper"
                          onClick={handleSetAsWallpaper}
                          disabled={!src || decryptingMedia}
                        />
                      )}
                      <MenuButton
                        icon={<SaveIcon size={13} />}
                        label={savingToPhone ? "Saving..." : "Save to phone"}
                        onClick={handleSaveToPhone}
                        disabled={!src || decryptingMedia || savingToPhone}
                      />
                      {isImage && (
                        <MenuButton
                          icon={<Share2 size={13} />}
                          label={sendingToStatus ? "Sending..." : "Send to status"}
                          onClick={handleSendToStatus}
                          disabled={!src || decryptingMedia || sendingToStatus}
                        />
                      )}
                    </>
                  )}
                  <MenuButton
                    icon={<Trash2 size={13} />}
                    label="Delete for me"
                    className="text-rose-500 dark:text-rose-300"
                    onClick={() => {
                      setEmojiPickerOpen(false);
                      requestDeleteConfirm("local");
                    }}
                  />
                  {mine && !deleted && (
                    <MenuButton
                      icon={<Trash2 size={13} />}
                      label="Delete for everyone"
                      className="text-rose-600 dark:text-rose-200"
                      onClick={() => {
                        setEmojiPickerOpen(false);
                        requestDeleteConfirm("everyone");
                      }}
                    />
                  )}
                </div>
                )}
              </div>

              <div
                ref={menuPopupRef}
                onContextMenu={(event) => event.preventDefault()}
                style={{ left: menuStyle.left, top: menuStyle.top }}
                className="chat-menu-in hidden sm:block sm:fixed sm:z-[120] sm:w-56 sm:max-h-[calc(100vh-24px)] sm:overflow-y-auto sm:overscroll-contain sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:p-2.5 sm:shadow-2xl dark:sm:border-slate-700 dark:sm:bg-slate-900"
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Message options</p>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    aria-label="Close options"
                  >
                    <X size={14} />
                  </button>
                </div>

                {deleteConfirm && (
                  <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100">
                    <p className="font-semibold">Delete this message?</p>
                    <p className="mt-0.5 text-[11px] text-rose-700/90 dark:text-rose-200/90">
                      {deleteConfirm === "everyone"
                        ? "This will remove the message for everyone in this chat."
                        : "This will delete the message only for you."}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm("")}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-rose-200 bg-white/85 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-white dark:border-rose-500/25 dark:bg-slate-950/30 dark:text-rose-200 dark:hover:bg-slate-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (deleteConfirm === "everyone") {
                            await onDeleteForEveryone?.(message);
                          } else {
                            await onDeleteLocal?.(message);
                          }
                          setDeleteConfirm("");
                          setMenuOpen(false);
                        }}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {!deleteConfirm && (
                  <div className="grid grid-cols-1 gap-1">
                  <MenuButton
                    icon={<CheckSquare size={13} />}
                    label={selected ? "Unselect" : "Select"}
                    onClick={() => {
                      onSelectToggle?.(message);
                      setMenuOpen(false);
                    }}
                  />
                  <MenuButton
                    icon={<CornerUpLeft size={13} />}
                    label="Reply"
                    onClick={() => {
                      onReply?.(message);
                      setMenuOpen(false);
                    }}
                  />
                  {message.body && <MenuButton icon={<Copy size={13} />} label="Copy" onClick={handleCopy} />}
                  {canEdit && <MenuButton icon={<Pencil size={13} />} label="Edit" onClick={handleEdit} />}
                  <MenuButton
                    icon={<Star size={13} />}
                    label={message.my_starred ? "Unstar" : "Star"}
                    onClick={() => {
                      onToggleStar?.(message);
                      setMenuOpen(false);
                    }}
                  />
                  {canForward && (
                    <MenuButton
                      icon={<Forward size={13} />}
                      label="Forward"
                      onClick={() => {
                        onForward?.(message);
                        setMenuOpen(false);
                      }}
                    />
                  )}
                  {(isImage || isVideo || isPdf) && (
                    <>
                      {isImage && (
                        <MenuButton
                          icon={<Wallpaper size={13} />}
                          label="Set as wallpaper"
                          onClick={handleSetAsWallpaper}
                          disabled={!src || decryptingMedia}
                        />
                      )}
                      <MenuButton
                        icon={<SaveIcon size={13} />}
                        label={savingToPhone ? "Saving..." : "Save to phone"}
                        onClick={handleSaveToPhone}
                        disabled={!src || decryptingMedia || savingToPhone}
                      />
                      {isImage && (
                        <MenuButton
                          icon={<Share2 size={13} />}
                          label={sendingToStatus ? "Sending..." : "Send to status"}
                          onClick={handleSendToStatus}
                          disabled={!src || decryptingMedia || sendingToStatus}
                        />
                      )}
                    </>
                  )}
                  <MenuButton
                    icon={<Trash2 size={13} />}
                    label="Delete for me"
                    className="text-rose-500 dark:text-rose-300"
                    onClick={() => {
                      setEmojiPickerOpen(false);
                      requestDeleteConfirm("local");
                    }}
                  />
                  {mine && !deleted && (
                    <MenuButton
                      icon={<Trash2 size={13} />}
                      label="Delete for everyone"
                      className="text-rose-600 dark:text-rose-200"
                      onClick={() => {
                        setEmojiPickerOpen(false);
                        requestDeleteConfirm("everyone");
                      }}
                    />
                  )}
                </div>
                )}
              </div>
            </>
          ), document.body)}
        </div>
      </div>

    </>
  );
}

function SeenStatus({ message }) {
  if (message.pending) {
    return <Check size={12} className="opacity-60" aria-label="Sending" />;
  }
  if (message.seen) {
    return <CheckCheck size={12} className="text-blue-500" aria-label="Read" />;
  }
  return <CheckCheck size={12} className="opacity-90" aria-label="Delivered" />;
}

export default memo(MessageBubble);

function MenuButton({ icon, label, className = "", onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800 ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}
