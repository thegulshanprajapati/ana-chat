import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "../common/Avatar";
import { formatDayLabel, formatTime } from "../../utils/time";
import twemoji from "twemoji";
import { 
  EyeOff, 
  Pin, 
  PinOff, 
  Trash2, 
  MoreVertical, 
  Archive, 
  Bell, 
  BellOff, 
  MessageSquare, 
  Heart, 
  Ban, 
  LogOut, 
  Eraser 
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";

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

  const { user } = useAuth();
  const meId = user?.id || "guest";

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPoint, setMenuPoint] = useState({ x: 0, y: 0 });
  const menuPopupRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const pressPointRef = useRef(null);
  const touchMovedRef = useRef(false);

  // Local state managers for visual preferences matching context actions
  const [isMuted, setIsMuted] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem(`ana_muted_chats_${meId}`) || "[]");
      return list.includes(chat.id);
    } catch {
      return false;
    }
  });

  const [isArchived, setIsArchived] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem(`ana_archived_chats_${meId}`) || "[]");
      return list.includes(chat.id);
    } catch {
      return false;
    }
  });

  const [isFavourite, setIsFavourite] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem(`ana_favourite_chats_${meId}`) || "[]");
      return list.map(String).includes(String(chat.id));
    } catch {
      return false;
    }
  });

  const [isMarkedUnread, setIsMarkedUnread] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem(`ana_unread_override_chats_${meId}`) || "[]");
      return list.map(String).includes(String(chat.id));
    } catch {
      return false;
    }
  });

  const [isBlocked, setIsBlocked] = useState(() => {
    return Boolean(chat.blocked_by_me);
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const mutes = JSON.parse(localStorage.getItem(`ana_muted_chats_${meId}`) || "[]");
        setIsMuted(mutes.map(String).includes(String(chat.id)));
      } catch (e) {}
      try {
        const archived = JSON.parse(localStorage.getItem(`ana_archived_chats_${meId}`) || "[]");
        setIsArchived(archived.map(String).includes(String(chat.id)));
      } catch (e) {}
      try {
        const favs = JSON.parse(localStorage.getItem(`ana_favourite_chats_${meId}`) || "[]");
        setIsFavourite(favs.map(String).includes(String(chat.id)));
      } catch (e) {}
      try {
        const unreads = JSON.parse(localStorage.getItem(`ana_unread_override_chats_${meId}`) || "[]");
        setIsMarkedUnread(unreads.map(String).includes(String(chat.id)));
      } catch (e) {}
    };
    window.addEventListener("ana_chats_updated", handleSync);
    return () => window.removeEventListener("ana_chats_updated", handleSync);
  }, [meId, chat.id]);

  const toggleMute = () => {
    try {
      const key = `ana_muted_chats_${meId}`;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      let next;
      const cidStr = String(chat.id);
      if (list.map(String).includes(cidStr)) {
        next = list.filter(id => String(id) !== cidStr);
        setIsMuted(false);
      } else {
        next = [...list, chat.id];
        setIsMuted(true);
      }
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("ana_chats_updated"));
    } catch {
      // ignore
    }
  };

  const toggleArchive = () => {
    try {
      const key = `ana_archived_chats_${meId}`;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      let next;
      const cidStr = String(chat.id);
      if (list.map(String).includes(cidStr)) {
        next = list.filter(id => String(id) !== cidStr);
        setIsArchived(false);
      } else {
        next = [...list, chat.id];
        setIsArchived(true);
      }
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("ana_chats_updated"));
    } catch {
      // ignore
    }
  };

  const toggleFavourite = () => {
    try {
      const key = `ana_favourite_chats_${meId}`;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      let next;
      const cidStr = String(chat.id);
      if (list.map(String).includes(cidStr)) {
        next = list.filter(id => String(id) !== cidStr);
        setIsFavourite(false);
      } else {
        next = [...list, chat.id];
        setIsFavourite(true);
      }
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("ana_chats_updated"));
    } catch {
      // ignore
    }
  };

  const toggleMarkUnread = () => {
    try {
      const key = `ana_unread_override_chats_${meId}`;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      let next;
      const cidStr = String(chat.id);
      if (list.map(String).includes(cidStr)) {
        next = list.filter(id => String(id) !== cidStr);
        setIsMarkedUnread(false);
      } else {
        next = [...list, chat.id];
        setIsMarkedUnread(true);
      }
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("ana_chats_updated"));
    } catch {
      // ignore
    }
  };

  const toggleBlockUser = async () => {
    if (isGroup || isSelf) return;
    const targetUserId = chat.other_user_id;
    if (!targetUserId) return;
    try {
      if (isBlocked) {
        await api.delete(`/users/${targetUserId}/block`);
        setIsBlocked(false);
      } else {
        await api.post(`/users/${targetUserId}/block`);
        setIsBlocked(true);
      }
      window.dispatchEvent(new Event("ana_chats_updated"));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to toggle block status.");
    }
  };

  const actions = useMemo(() => {
    const items = [];

    // 1. Archive chat
    items.push({
      key: "archive",
      icon: <Archive size={14} />,
      label: isArchived ? "Unarchive chat" : "Archive chat",
      onClick: toggleArchive,
      danger: false
    });

    // 2. Mute/Unmute Notifications
    items.push({
      key: "mute",
      icon: isMuted ? <Bell size={14} /> : <BellOff size={14} />,
      label: isMuted ? "Unmute notifications" : "Mute notifications",
      desc: isMuted ? "Muted always" : null,
      onClick: toggleMute,
      danger: false
    });

    // 3. Pin chat / Unpin chat
    items.push({
      key: "pin",
      icon: pinned ? <PinOff size={14} /> : <Pin size={14} />,
      label: pinned ? "Unpin chat" : "Pin chat",
      onClick: () => onTogglePin?.(chat?.id, !pinned),
      danger: false
    });

    // 4. Mark as unread / Mark as read
    items.push({
      key: "unread",
      icon: <MessageSquare size={14} />,
      label: isMarkedUnread ? "Mark as read" : "Mark as unread",
      onClick: toggleMarkUnread,
      danger: false
    });

    // 5. Add to favourites / Remove from favourites
    items.push({
      key: "favourites",
      icon: <Heart size={14} />,
      label: isFavourite ? "Remove from favourites" : "Add to favourites",
      onClick: toggleFavourite,
      danger: false,
      dividerAfter: true
    });

    // 6. Clear chat
    items.push({
      key: "clear",
      icon: <Eraser size={14} />,
      label: "Clear chat",
      onClick: async () => {
        const confirm = window.confirm("Are you sure you want to clear all messages in this chat?");
        if (confirm) {
          try {
            await api.post(`/chats/${chat.id}/clear`);
            window.dispatchEvent(new Event("ana_chats_updated"));
            window.dispatchEvent(new CustomEvent("ana_active_chat_cleared", { detail: { chatId: chat.id } }));
          } catch (err) {
            alert(err.response?.data?.message || "Failed to clear chat.");
          }
        }
      },
      danger: false
    });

    if (isGroup) {
      // 7. Exit group
      items.push({
        key: "exit",
        icon: <LogOut size={14} />,
        label: "Exit group",
        onClick: async () => {
          const confirm = window.confirm("Are you sure you want to exit this group?");
          if (confirm) {
            try {
              await api.post(`/chats/${chat.id}/exit`);
              window.dispatchEvent(new Event("ana_chats_updated"));
            } catch (err) {
              alert(err.response?.data?.message || "Failed to exit group.");
            }
          }
        },
        danger: true
      });
    } else {
      // 7. Block / Unblock
      items.push({
        key: "block",
        icon: <Ban size={14} />,
        label: isBlocked ? "Unblock" : "Block",
        onClick: toggleBlockUser,
        danger: true
      });

      // 8. Delete chat
      items.push({
        key: "delete",
        icon: <Trash2 size={14} />,
        label: "Delete chat",
        onClick: () => onDelete?.(chat?.id),
        danger: true
      });
    }

    return items;
  }, [chat?.id, isArchived, isMuted, pinned, isMarkedUnread, isFavourite, isGroup, isBlocked, onDelete, onTogglePin]);

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
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick?.(chat)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick?.(chat);
          }
        }}
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
        className={`cursor-pointer group relative w-full rounded-2xl border ${compactMode ? "p-2.5" : "p-3"} text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ring-accent ${
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
                 {isMuted && (
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                      customDark
                        ? "border-white/15 bg-white/10 text-slate-400"
                        : "border-slate-200 bg-white/80 text-slate-400 dark:border-slate-700 dark:bg-slate-900/60"
                    }`}
                    aria-label="Muted chat"
                    title="Muted"
                  >
                    <BellOff size={11} />
                  </span>
                )}
                {isFavourite && (
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                      customDark
                        ? "border-white/15 bg-white/10 text-rose-300"
                        : "border-slate-200 bg-white/80 text-rose-500 dark:border-slate-700 dark:bg-slate-900/60"
                    }`}
                    aria-label="Favourite chat"
                    title="Favourite"
                  >
                    <Heart size={12} fill="currentColor" />
                  </span>
                )}
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
                {hasUnread ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : (
                  isMarkedUnread && (
                    <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
                  )
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
      </div>

      {menuOpen && actions.length > 0 && createPortal(
        <div className="fixed inset-0 z-[80]">
          <div
            ref={menuPopupRef}
            className="fixed min-w-[200px] overflow-hidden rounded-xl border shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            style={{
              ...menuStyle,
              backgroundColor: "var(--panel-bg)",
              borderColor: "var(--panel-border, rgba(255,255,255,0.1))",
              color: "var(--panel-text)"
            }}
            role="menu"
            aria-label="Chat options"
          >
            <div className="py-2">
              {actions.map((item) => (
                <div key={item.key}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-semibold transition ${
                      item.danger
                        ? "text-rose-500 hover:bg-rose-500/10"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    style={{
                      color: item.danger ? "var(--rose-500, #f43f5e)" : "var(--panel-text)"
                    }}
                    role="menuitem"
                    onClick={() => {
                      item.onClick?.();
                      setMenuOpen(false);
                    }}
                  >
                    <span className="shrink-0 opacity-80">{item.icon}</span>
                    <div className="flex flex-col min-w-0">
                      <span>{item.label}</span>
                      {item.desc && (
                        <span className="text-[10px] font-medium mt-0.5 leading-none text-slate-400 dark:text-slate-500">{item.desc}</span>
                      )}
                    </div>
                  </button>
                  {item.dividerAfter && (
                    <div className="my-1 border-t" style={{ borderColor: "var(--panel-border, rgba(255,255,255,0.1))" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
