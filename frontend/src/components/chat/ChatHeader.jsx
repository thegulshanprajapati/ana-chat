import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  Bell,
  BellOff,
  ChevronsUp,
  Copy,
  Eraser,
  ImageUp,
  Lock,
  MessageSquareText,
  MoreHorizontal,
  Paintbrush2,
  Phone,
  PhoneCall,
  RotateCw,
  Search,
  Shield,
  UserCheck,
  UserMinus,
  Video
} from "lucide-react";
import Avatar from "../common/Avatar";
import { formatDayLabel, formatTime } from "../../utils/time";

function lastSeenText(partner) {
  if (!partner?.last_seen) return "offline";
  const day = formatDayLabel(partner.last_seen);
  const time = formatTime(partner.last_seen);
  if (!day || !time) return "offline";
  if (day === "Today") return `last seen today at ${time}`;
  if (day === "Yesterday") return `last seen yesterday at ${time}`;
  return `last seen ${day}, ${time}`;
}

function resolveDisplayName(partner, isGroup) {
  if (isGroup) return partner?.name || "Unnamed group";
  const rawName = (partner?.name || "").toString().trim();
  const numericName = rawName && /^\d+$/.test(rawName);
  const emailAlias = (partner?.email || "").toString().trim().split("@")[0] || "";
  if (!rawName) return emailAlias || "Unknown";
  if (numericName && emailAlias) return emailAlias;
  return rawName;
}

export default function ChatHeader({
  chat,
  partner,
  typing = false,
  typingName = "",
  mobile,
  showOnlineStatus = true,
  isGroup = false,
  memberCount = 0,
  onBack,
  onVoiceCall,
  onVideoCall,
  onVideoChat,
  onToggleWatchTogether,
  watchTogetherOpen = false,
  watchTogetherEnabled = true,
  hasActiveWatchSession = false,
  onSearchInChat,
  onOpenProfile,
  onRefreshMessages,
  onOpenCallLogs,
  onGoToFirstMessage,
  onGoToLatestMessage,
  onOpenAdminPortal,
  onToggleMute,
  onOpenBackgroundPicker,
  onClearChatBackground,
  hasChatBackground = false,
  backgroundPickerOpen = false,
  onHideChat,
  canHideChat = false,
  muted,
  blockedByMe = false,
  blockedMe = false,
  blockActionBusy = false,
  onBlockUser,
  onUnblockUser,
  notify
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeMenu(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    window.addEventListener("mousedown", closeMenu);
    return () => window.removeEventListener("mousedown", closeMenu);
  }, [menuOpen]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  if (!chat) return null;

  const statusUpdatedAtMs = (() => {
    const raw = partner?.status_updated_at;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw) {
      const parsed = new Date(raw).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  })();
  const onlineFresh = statusUpdatedAtMs ? (nowMs - statusUpdatedAtMs < 2 * 60 * 1000) : false;
  const online = !isGroup && partner?.status === "online" && onlineFresh;
  const isTyping = Boolean(typing);
  const blocked = !isGroup && (blockedByMe || blockedMe);
  const watchDisabled = !watchTogetherEnabled;
  const displayName = resolveDisplayName(partner, isGroup);
  const aboutText = (partner?.about || "").toString().trim();
  const safeTypingName = (typingName || "").toString().trim() || "Someone";
  const typingSubtitle = isTyping ? (isGroup ? `${safeTypingName} typing...` : "typing...") : "";
  const subtitleText = typingSubtitle || (isGroup
    ? (memberCount ? `${memberCount} members` : "Group chat")
    : (aboutText || (showOnlineStatus ? (online ? "online" : lastSeenText(partner)) : "")));
  const contactText = isGroup
    ? (memberCount ? `${memberCount} members` : "Group chat")
    : (chat?.other_user_mobile || chat?.other_user_email || "No contact info");
  const subtitleClass = isTyping
    ? "text-violet-600 dark:text-violet-300"
    : (!isGroup && aboutText
      ? "text-slate-500 dark:text-slate-400"
      : (online ? "text-emerald-500" : "text-slate-500 dark:text-slate-400"));

  async function copyContact() {
    try {
      await navigator.clipboard.writeText(contactText);
      notify?.({ type: "success", message: "Contact copied to clipboard." });
    } catch {
      notify?.({ type: "error", message: "Unable to copy contact." });
    } finally {
      setMenuOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 glass-bar rounded-none border-x-0 border-t-0 border-b border-slate-200/60 px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.10)] dark:border-white/10 sm:px-5 sm:py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          {mobile && (
            <button
              type="button"
              onClick={onBack}
              className="glass-icon-btn disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Back to chats"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenProfile}
            className="min-w-0 rounded-2xl border border-transparent px-1.5 py-1 text-left transition hover:border-white/10 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 ring-accent dark:hover:bg-white/5"
            aria-label="Open contact profile"
            title="Open profile"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Avatar name={partner?.name} src={partner?.avatar_url} size={42} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</span>
                {subtitleText ? (
                  <span className={`block truncate text-xs ${subtitleClass}`}>
                    {subtitleText}
                  </span>
                ) : null}
              </span>
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <HeaderAction label="Search in chat" onClick={onSearchInChat}>
            <Search size={16} />
          </HeaderAction>
          <HeaderAction
            label={watchTogetherOpen ? "Hide Watch Together" : "Watch Together"}
            onClick={onToggleWatchTogether}
            disabled={watchDisabled}
            className={hasActiveWatchSession ? "text-violet-600 dark:text-violet-300" : ""}
          >
            <MessageSquareText size={16} />
          </HeaderAction>
          {!isGroup && (
            <>
              <HeaderAction label="Voice call" onClick={onVoiceCall} disabled={blocked}>
                <Phone size={16} />
              </HeaderAction>
              <HeaderAction label="Video call" onClick={onVideoCall} disabled={blocked}>
                <Video size={16} />
              </HeaderAction>
              <HeaderAction
                label="Video chat (mic off)"
                onClick={onVideoChat}
                className="hidden sm:inline-flex"
                disabled={blocked}
              >
                <MessageSquareText size={16} />
              </HeaderAction>
            </>
          )}
          <div className="relative" ref={menuRef}>
            <HeaderAction label="More actions" onClick={() => setMenuOpen((prev) => !prev)}>
              <MoreHorizontal size={16} />
            </HeaderAction>

            {menuOpen && (
              <div className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 rounded-lg border border-slate-200/70 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/70">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Chat details</p>
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
                  {!isGroup && aboutText && (
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-300">{aboutText}</p>
                  )}
                  <p className="truncate text-xs text-slate-600 dark:text-slate-300">{contactText}</p>
                  {isGroup && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {memberCount ? `${memberCount} members` : "Group chat"}
                    </p>
                  )}
                  {showOnlineStatus && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{online ? "Online now" : lastSeenText(partner)}</p>
                  )}
                  {!isGroup && blockedByMe && (
                    <p className="mt-1 rounded-md border border-amber-300/70 bg-amber-50 px-1.5 py-1 text-[11px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                      You blocked this user.
                    </p>
                  )}
                  {!isGroup && !blockedByMe && blockedMe && (
                    <p className="mt-1 rounded-md border border-rose-300/70 bg-rose-50 px-1.5 py-1 text-[11px] text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                      This user blocked you.
                    </p>
                  )}
                </div>

                <MenuButton
                  icon={<Search size={14} />}
                  label="Search messages"
                  onClick={() => {
                    onSearchInChat?.();
                    setMenuOpen(false);
                  }}
                />
                <MenuButton
                  icon={<MessageSquareText size={14} />}
                  label={watchTogetherOpen ? "Hide Watch Together" : "Watch Together"}
                  disabled={watchDisabled}
                  onClick={() => {
                    onToggleWatchTogether?.();
                    setMenuOpen(false);
                  }}
                />
                {!isGroup && (
                  <MenuButton
                    icon={<MessageSquareText size={14} />}
                    label="Video chat (mic off)"
                    disabled={blocked}
                    onClick={() => {
                      onVideoChat?.();
                      setMenuOpen(false);
                    }}
                  />
                )}
                {!isGroup && blockedByMe && (
                  <MenuButton
                    icon={<UserCheck size={14} />}
                    label={blockActionBusy ? "Unblocking..." : "Unblock user"}
                    disabled={blockActionBusy}
                    onClick={async () => {
                      await onUnblockUser?.();
                      setMenuOpen(false);
                    }}
                  />
                )}
                {!isGroup && !blockedByMe && (
                  <MenuButton
                    icon={<UserMinus size={14} />}
                    label={blockActionBusy ? "Blocking..." : "Block user"}
                    disabled={blockActionBusy || blockedMe}
                    danger
                    onClick={async () => {
                      const confirmed = window.confirm("Block this user? You will not be able to send messages or calls until you unblock.");
                      if (!confirmed) return;
                      await onBlockUser?.();
                      setMenuOpen(false);
                    }}
                  />
                )}
                {canHideChat && (
                  <MenuButton
                    icon={<Lock size={14} />}
                    label="Hide chat with PIN"
                    onClick={async () => {
                      await onHideChat?.();
                      setMenuOpen(false);
                    }}
                  />
                )}
                <MenuButton
                  icon={muted ? <Bell size={14} /> : <BellOff size={14} />}
                  label={muted ? "Unmute notifications" : "Mute notifications"}
                  onClick={() => {
                    onToggleMute?.();
                    setMenuOpen(false);
                  }}
                />
                <MenuButton icon={<Copy size={14} />} label="Copy contact" onClick={copyContact} />
                {onOpenCallLogs && (
                  <MenuButton
                    icon={<PhoneCall size={14} />}
                    label="Call logs"
                    onClick={() => {
                      onOpenCallLogs?.();
                      setMenuOpen(false);
                    }}
                  />
                )}
                <MenuButton
                  icon={<RotateCw size={14} />}
                  label="Refresh messages"
                  onClick={() => {
                    onRefreshMessages?.();
                    setMenuOpen(false);
                  }}
                />
                {onGoToFirstMessage && (
                  <MenuButton
                    icon={<ChevronsUp size={14} />}
                    label="Go to first message"
                    onClick={() => {
                      onGoToFirstMessage?.();
                      setMenuOpen(false);
                    }}
                  />
                )}
                {onGoToLatestMessage && (
                  <MenuButton
                    icon={<ArrowDown size={14} />}
                    label="Go to latest message"
                    onClick={() => {
                      onGoToLatestMessage?.();
                      setMenuOpen(false);
                    }}
                  />
                )}
                {onOpenAdminPortal && (
                  <MenuButton
                    icon={<Shield size={14} />}
                    label="Go to Admin Panel"
                    onClick={() => {
                      onOpenAdminPortal?.();
                      setMenuOpen(false);
                    }}
                  />
                )}
                <MenuButton
                  icon={backgroundPickerOpen ? <ImageUp size={14} /> : <Paintbrush2 size={14} />}
                  label={backgroundPickerOpen ? "Hide background options" : "Change chat background"}
                  onClick={() => {
                    onOpenBackgroundPicker?.();
                    setMenuOpen(false);
                  }}
                />
                {hasChatBackground && (
                  <MenuButton
                    icon={<Eraser size={14} />}
                    label="Reset chat background"
                    onClick={() => {
                      onClearChatBackground?.();
                      setMenuOpen(false);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function HeaderAction({ children, label, onClick, className = "", disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`glass-icon-btn disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function MenuButton({ icon, label, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition ${
        disabled
          ? "cursor-not-allowed opacity-45"
          : danger
            ? "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
