import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "../common/Avatar";
import { formatDayLabel, formatTime } from "../../utils/time";
import twemoji from "twemoji";
import { EyeOff, Pin, PinOff, Trash2, MoreVertical } from "lucide-react";

function escapeHtml(value) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emojiHtml(value) {
  return twemoji.parse(escapeHtml(value || ""), {
    folder: "svg",
    ext: ".svg",
    className: "twemoji-icon twemoji-icon--list"
  });
}

function stripRichFormatting(value) {
  let text = (value || "").toString();
  if (!text) return "";

  // Preserve explicit media placeholder.
  if (text.trim() === "[media]") return "[media]";

  // Inline code -> plain text.
  text = text.replace(/`([^`\n]+?)`/g, "$1");

  // Custom tags -> inner content.
  text = text.replace(/\[(?:color|c)\s*[:=]\s*#[0-9a-fA-F]{3,6}\]([\s\S]*?)\[\/(?:color|c)\]/gi, "$1");
  text = text.replace(/\[glow\]([\s\S]*?)\[\/glow\]/gi, "$1");

  // Basic markdown-like styling -> inner.
  text = text.replace(/__([^_\n][\s\S]*?)__/g, "$1");
  text = text.replace(/\*\*([^\n]+?)\*\*/g, "$1");
  text = text.replace(/~{2,}([^\n]+?)~{2,}/g, "$1");
  text = text.replace(/\*(?!\*)([^\n*]+?)\*(?!\*)/g, "$1");

  return text.replace(/\s+/g, " ").trim();
}

export default function ChatListItem({
  chat,
  active,
  unreadCount = 0,
  onClick,
  pinned = false,
  onTogglePin,
  onHide,
  onDelete,
  compactMode = false,
  showOnlineStatus = true,
  customDark = false,
  nowMs = 0
}) {
  const hasUnread = unreadCount > 0;
  const isGroup = chat.chat_type === "group";
  const isSelf = chat.chat_type === "self";
  const canHide = !isSelf;
  const canDelete = !isSelf;

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPoint, setMenuPoint] = useState({ x: 0, y: 0 });
  const menuPopupRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const pressPointRef = useRef(null);
  const touchMovedRef = useRef(false);

  const actions = useMemo(() => {
    const items = [];
    items.push({
      key: "pin",
      icon: pinned ? <PinOff size={14} /> : <Pin size={14} />,
      label: pinned ? "Unpin" : "Pin",
      onClick: () => onTogglePin?.(chat?.id, !pinned),
      danger: false,
      hidden: false
    });
    items.push({
      key: "hide",
      icon: <EyeOff size={14} />,
      label: "Hide",
      onClick: () => onHide?.(chat?.id),
      danger: false,
      hidden: !canHide
    });
    items.push({
      key: "delete",
      icon: <Trash2 size={14} />,
      label: "Delete",
      onClick: () => onDelete?.(chat?.id),
      danger: true,
      hidden: !canDelete
    });
    return items.filter((item) => !item.hidden);
  }, [canDelete, canHide, chat?.id, onDelete, onHide, onTogglePin, pinned]);

  function cancelLongPress() {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function openMenuAtPoint(point) {
    const nextX = Number.isFinite(Number(point?.x)) ? Number(point.x) : 0;
    const nextY = Number.isFinite(Number(point?.y)) ? Number(point.y) : 0;
    setMenuPoint({ x: nextX, y: nextY });
    setMenuOpen(true);
  }

  function toggleMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openMenuAtPoint({
      x: rect.right - 196,
      y: rect.bottom + 4
    });
  }

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onGlobalDown(event) {
      const target = event.target;
      if (menuPopupRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", onGlobalDown);
    window.addEventListener("touchstart", onGlobalDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onGlobalDown);
      window.removeEventListener("touchstart", onGlobalDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const menuStyle = useMemo(() => {
    const padding = 10;
    const estimatedWidth = 196;
    const estimatedHeight = Math.max(44, actions.length * 36 + 16);
    let left = menuPoint.x;
    let top = menuPoint.y;
    left = Math.max(padding, Math.min(left, window.innerWidth - estimatedWidth - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - estimatedHeight - padding));
    return { left, top };
  }, [actions.length, menuPoint.x, menuPoint.y]);

  const statusUpdatedAtMs = (() => {
    const raw = chat.other_user_status_updated_at;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw) {
      const parsed = new Date(raw).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  })();

  const onlineFresh = statusUpdatedAtMs ? (Number(nowMs) - statusUpdatedAtMs < 2 * 60 * 1000) : false;
  const online = showOnlineStatus && !isGroup && !isSelf && chat.other_user_status === "online" && onlineFresh;
  const blockedByMe = !isGroup && Boolean(chat.blocked_by_me);
  const blockedMe = !isGroup && Boolean(chat.blocked_me);
  const lastPreview = isSelf
    ? (chat.last_message_body || "Private self chat")
    : (blockedByMe
    ? "You blocked this user"
    : (blockedMe
      ? "This user blocked you"
      : (chat.last_message_body
        || (chat.last_message_image ? "[media]" : (chat.last_message_at || chat.last_message_created_at ? "Message deleted" : "Start conversation")))));
  const titleClass = active
    ? "text-slate-900 dark:text-slate-50"
    : (customDark ? "text-white" : "text-slate-900 dark:text-slate-100");
  const metaClass = active
    ? "text-slate-700 dark:text-slate-300"
    : (customDark ? "text-white/70" : "text-slate-500 dark:text-slate-400");
  let statusLabel = "";
  if (showOnlineStatus && !isGroup && !isSelf) {
    if (online) statusLabel = "Online";
    else if (chat.other_user_last_seen) {
      const day = formatDayLabel(chat.other_user_last_seen);
      const time = formatTime(chat.other_user_last_seen);
      statusLabel = day === "Today" && time
        ? `Last seen ${time}`
        : (day ? `Last seen ${day}` : "Offline");
    } else {
      statusLabel = "Offline";
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onClick?.(chat)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openMenuAtPoint({ x: event.clientX, y: event.clientY });
        }}
        onTouchStart={(event) => {
          const touch = event.touches?.[0];
          touchMovedRef.current = false;
          pressPointRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
          cancelLongPress();
          longPressTimerRef.current = window.setTimeout(() => {
            if (touchMovedRef.current) return;
            openMenuAtPoint(pressPointRef.current || { x: 12, y: 12 });
          }, 520);
        }}
        onTouchMove={() => {
          touchMovedRef.current = true;
          cancelLongPress();
        }}
        onTouchEnd={() => {
          cancelLongPress();
        }}
        onTouchCancel={() => {
          cancelLongPress();
        }}
        className={`group relative w-full rounded-2xl border ${compactMode ? "p-2.5" : "p-3"} text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ring-accent ${
          active
            ? "border-accent bg-accent-soft shadow-accent"
            : (customDark
              ? "border-transparent hover:border-white/15 hover:bg-white/10"
              : "border-transparent hover:border-slate-200 hover:bg-slate-100/85 dark:hover:border-slate-700 dark:hover:bg-slate-800/70")
        }`}
        aria-label={`Open chat with ${chat.other_user_name || "user"}`}
      >
        {active && <span className={`absolute left-0 ${compactMode ? "top-2.5 h-9" : "top-3 h-10"} w-1 rounded-r-full bg-accent`} aria-hidden />}

        <div className={`flex items-center ${compactMode ? "gap-2.5" : "gap-3"}`}>
          <span className="relative">
            <Avatar name={chat.other_user_name} src={chat.other_user_avatar} size={compactMode ? 42 : 48} />
            {showOnlineStatus && online && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-semibold ${titleClass}`}
                  dangerouslySetInnerHTML={{ __html: emojiHtml(chat.other_user_name || "Unknown") }}
                />
                {isGroup && (
                  <p className={`truncate text-[11px] ${metaClass}`}>
                    {chat.member_count ? `${chat.member_count} members` : "Group"}
                  </p>
                )}
                {isSelf && (
                  <p className={`truncate text-[11px] ${metaClass}`}>Only visible to you</p>
                )}
                {!isGroup && !isSelf && statusLabel && (
                  <p className={`truncate text-[11px] ${online ? "text-emerald-600 dark:text-emerald-400" : metaClass}`}>
                    {statusLabel}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                {pinned && (
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                      customDark
                        ? "border-white/15 bg-white/10 text-white/85"
                        : "border-slate-200 bg-white/80 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                    }`}
                    aria-label="Pinned chat"
                    title="Pinned"
                  >
                    <Pin size={12} />
                  </span>
                )}
                <p className={`text-[11px] ${metaClass}`}>{formatTime(chat.last_message_at || chat.last_message_created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p
                className={`min-w-0 flex-1 truncate text-xs ${metaClass}`}
                dangerouslySetInnerHTML={{ __html: emojiHtml(stripRichFormatting(lastPreview)) }}
              />
              <div className="shrink-0 flex items-center gap-1.5">
                {hasUnread && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleMenu}
                  className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 hover:bg-slate-200 dark:hover:bg-slate-700 focus:opacity-100 opacity-0 group-hover:opacity-100 max-md:opacity-100 ${
                    customDark ? "hover:bg-white/15 text-white" : "text-slate-500 dark:text-slate-400"
                  }`}
                  aria-label="Chat options"
                  title="Options"
                >
                  <MoreVertical size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </button>

      {menuOpen && actions.length > 0 && createPortal(
        <div className="fixed inset-0 z-[80]">
          <div
            ref={menuPopupRef}
            className="fixed min-w-[196px] overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/92"
            style={menuStyle}
            role="menu"
            aria-label="Chat options"
          >
            <div className="py-2">
              {actions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition ${
                    item.danger
                      ? "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                  role="menuitem"
                  onClick={() => {
                    item.onClick?.();
                    setMenuOpen(false);
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
