import Avatar from "../common/Avatar";
import { formatDayLabel, formatTime } from "../../utils/time";
import twemoji from "twemoji";

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
  compactMode = false,
  showOnlineStatus = true,
  customDark = false,
  nowMs = 0
}) {
  const hasUnread = unreadCount > 0;
  const isGroup = chat.chat_type === "group";
  const isSelf = chat.chat_type === "self";

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
    <button
      type="button"
      onClick={() => onClick?.(chat)}
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
            <p className={`shrink-0 text-[11px] ${metaClass}`}>{formatTime(chat.last_message_at || chat.last_message_created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <p
              className={`min-w-0 flex-1 truncate text-xs ${metaClass}`}
              dangerouslySetInnerHTML={{ __html: emojiHtml(stripRichFormatting(lastPreview)) }}
            />
            {hasUnread && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
