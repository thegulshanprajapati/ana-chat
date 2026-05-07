import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImageUp, Loader2, Paintbrush2, Search, Trash2, X } from "lucide-react";
import ChatHeader from "./ChatHeader";
import MessageThread from "./MessageThread";
import Composer from "./Composer";
import PartnerProfileSheet from "./PartnerProfileSheet";
import WatchTogetherPanel from "./WatchTogetherPanel";
import { CHAT_BACKGROUND_PRESETS } from "../../utils/chat";
import { navigateTo } from "../../utils/nav";

export default function ChatPane({
  meId,
  isAdminUser = false,
  activeChat,
  partner,
  messages,
  loadingMessages,
  typing,
  typingName,
  uploadBase,
  onTyping,
  onSeen,
  onSend,
  replyToMessage,
  onCancelReply,
  enterToSend,
  onVoiceCall,
  onVideoCall,
  onVideoChat,
  onOpenCallLogs,
  watchSession,
  onSetWatchSource,
  onClearWatchSession,
  onWatchPlaybackSync,
  onRefreshMessages,
  onSetChatBackground,
  onClearChatBackground,
  onHideChat,
  onBlockUser,
  onUnblockUser,
  onReportUser,
  blockActionBusy = false,
  onBackMobile,
  onReply,
  onDeleteLocal,
  onEditMessage,
  onDeleteForEveryone,
  onToggleStar,
  onReact,
  onForward,
  onSelectToggle,
  selectedMessageIds,
  compactMode,
  showOnlineStatus,
  isGroupChat = false,
  isSelfChat = false,
  memberCount = 0,
  theme = "dark",
  chatPaneColor,
  isChatPaneLight,
  notify,
  mobile
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [muted, setMuted] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const isDarkTheme = theme === "dark";
  const searchInputRef = useRef(null);
  const backgroundFileRef = useRef(null);
  const scrollApiRef = useRef(null);
  const currentBackground = (activeChat?.chat_background_url || "").toString();
  const activePreset = currentBackground.startsWith("preset:")
    ? currentBackground.slice("preset:".length)
    : "";
  const blockedByMe = !isGroupChat && !isSelfChat && Boolean(activeChat?.blocked_by_me || partner?.blocked_by_me);
  const blockedMe = !isGroupChat && !isSelfChat && Boolean(activeChat?.blocked_me || partner?.blocked_me);
  const isBlocked = blockedByMe || blockedMe;
  const blockMessage = blockedByMe
    ? "You blocked this user. Unblock to send messages."
    : (blockedMe ? "This user blocked you. Messaging is disabled." : "");

  useEffect(() => {
    setSearchOpen(false);
    setSearchText("");
    setMuted(false);
    setWatchOpen(Boolean(watchSession?.active));
    setBackgroundOpen(false);
    setBackgroundSaving(false);
    setProfileOpen(false);
    setReportBusy(false);
  }, [activeChat?.id, watchSession?.active]);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [searchOpen]);

  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleMessages = useMemo(() => {
    if (!normalizedSearch) return messages;
    return messages.filter((message) => (message.body || "").toLowerCase().includes(normalizedSearch));
  }, [messages, normalizedSearch]);
  const searchResultCount = normalizedSearch ? visibleMessages.length : 0;

  async function applyBackgroundPreset(presetId) {
    if (!onSetChatBackground) return;
    setBackgroundSaving(true);
    try {
      await onSetChatBackground({ preset: presetId });
    } finally {
      setBackgroundSaving(false);
    }
  }

  async function applyBackgroundImage(file) {
    if (!file || !onSetChatBackground) return;
    setBackgroundSaving(true);
    try {
      await onSetChatBackground({ file });
      setBackgroundOpen(false);
    } finally {
      setBackgroundSaving(false);
      if (backgroundFileRef.current) backgroundFileRef.current.value = "";
    }
  }

  async function clearBackground() {
    if (!onClearChatBackground) return;
    setBackgroundSaving(true);
    try {
      await onClearChatBackground();
    } finally {
      setBackgroundSaving(false);
    }
  }

  if (!activeChat) {
    return (
      <section className="hidden h-full items-center justify-center rounded-none border border-slate-200 bg-white text-sm text-slate-500 shadow-sm sm:rounded-lg dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 md:flex">
        Select a chat to start messaging
      </section>
    );
  }

  return (
    <section
      className={`glass-bar flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-none shadow-[0_22px_70px_rgb(0_0_0_/_0.28)] sm:rounded-lg ${compactMode ? "text-[13px]" : ""} ${
        isChatPaneLight ? "text-gray-900" : "text-white"
      }`}
      style={chatPaneColor ? { backgroundColor: chatPaneColor } : undefined}
    >
      <ChatHeader
        chat={activeChat}
        partner={partner}
        typing={typing}
        typingName={typingName}
        mobile={mobile}
        showOnlineStatus={showOnlineStatus && !isGroupChat}
        isGroup={isGroupChat}
        memberCount={memberCount}
        onBack={onBackMobile}
        onVoiceCall={isGroupChat || isSelfChat || isBlocked ? undefined : onVoiceCall}
        onVideoCall={isGroupChat || isSelfChat || isBlocked ? undefined : onVideoCall}
        onVideoChat={isGroupChat || isSelfChat || isBlocked ? undefined : onVideoChat}
        onToggleWatchTogether={() => setWatchOpen((prev) => !prev)}
        watchTogetherOpen={watchOpen}
        watchTogetherEnabled={!isSelfChat && !isBlocked && Boolean(onSetWatchSource)}
        hasActiveWatchSession={Boolean(watchSession?.active)}
        onSearchInChat={() => setSearchOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onRefreshMessages={onRefreshMessages}
        onGoToFirstMessage={() => scrollApiRef.current?.scrollToTop("smooth")}
        onGoToLatestMessage={() => scrollApiRef.current?.scrollToBottom("smooth")}
        onOpenAdminPortal={isAdminUser ? () => { navigateTo("admin"); } : undefined}
        onOpenCallLogs={onOpenCallLogs}
        onOpenBackgroundPicker={() => setBackgroundOpen((prev) => !prev)}
        onClearChatBackground={clearBackground}
        hasChatBackground={Boolean(currentBackground)}
        backgroundPickerOpen={backgroundOpen}
        onHideChat={isSelfChat ? undefined : onHideChat}
        canHideChat={!isSelfChat}
        muted={muted}
        blockedByMe={blockedByMe}
        blockedMe={blockedMe}
        blockActionBusy={blockActionBusy}
        onBlockUser={onBlockUser}
        onUnblockUser={onUnblockUser}
        onToggleMute={() => {
          setMuted((prev) => {
            const next = !prev;
            notify?.({
              type: "info",
              message: next ? "Notifications muted for this chat." : "Notifications unmuted for this chat."
            });
            return next;
          });
        }}
        notify={notify}
      />

      {isBlocked && (
        <div className="border-b border-amber-200/80 bg-amber-50/90 px-4 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {blockMessage}
        </div>
      )}

      {watchOpen && (
        <div className={`border-b px-3 py-3 sm:px-5 ${
          isDarkTheme
            ? "border-slate-800 bg-slate-950"
            : "border-slate-200 bg-white"
        }`}>
          <WatchTogetherPanel
            chatId={activeChat?.id}
            session={watchSession}
            onSetSource={onSetWatchSource}
            onClearSession={onClearWatchSession}
            onSyncPlayback={onWatchPlaybackSync}
            disabled={isSelfChat || isBlocked || !onSetWatchSource}
            notify={notify}
            theme={theme}
          />
        </div>
      )}

      {backgroundOpen && (
        <div className={`border-b px-3 py-3 sm:px-5 ${
          isDarkTheme
            ? "border-slate-800 bg-slate-950"
            : "border-slate-200 bg-white"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <p className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
              isDarkTheme ? "text-slate-400" : "text-slate-500"
            }`}>
              <Paintbrush2 size={14} />
              Chat background
            </p>
            <button
              type="button"
              onClick={() => setBackgroundOpen(false)}
              className={`rounded-md p-1 transition ${
                isDarkTheme
                  ? "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
              aria-label="Close background options"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {CHAT_BACKGROUND_PRESETS.map((preset) => {
              const active = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={backgroundSaving}
                  onClick={() => void applyBackgroundPreset(preset.id)}
                  style={{ backgroundImage: preset.image }}
                  className={`relative h-14 rounded-xl border transition ${
                    active
                      ? "border-violet-400 shadow-[0_0_0_2px_rgb(var(--accent-500-rgb)_/_0.32)]"
                      : "border-slate-300/70 hover:border-violet-400 dark:border-slate-700"
                  } disabled:cursor-not-allowed disabled:opacity-70`}
                  aria-label={`Set ${preset.label} background`}
                  title={preset.label}
                >
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/25 text-white">
                      <Check size={16} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => backgroundFileRef.current?.click()}
              disabled={backgroundSaving}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                isDarkTheme
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {backgroundSaving ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />}
              Upload background
            </button>
            <button
              type="button"
              onClick={() => void clearBackground()}
              disabled={backgroundSaving || !currentBackground}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                isDarkTheme
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                  : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              <Trash2 size={14} />
              Reset
            </button>
          </div>

          <p className={`mt-2 text-[11px] ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
            Background syncs for all participants in this chat.
          </p>
          <input
            ref={backgroundFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void applyBackgroundImage(event.target.files?.[0] || null)}
          />
        </div>
      )}

      {searchOpen && (
        <div className="border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950 sm:px-5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900">
            <Search size={15} className="shrink-0 text-slate-500 dark:text-slate-400" />
            <input
              ref={searchInputRef}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Search messages in this chat"
              aria-label="Search messages in this chat"
            />
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setSearchText("");
              }}
              className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Close in-chat search"
              title="Close search"
            >
              <X size={15} />
            </button>
          </div>
          {normalizedSearch && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {searchResultCount ? `${searchResultCount} result${searchResultCount > 1 ? "s" : ""} found` : `No result for "${searchText.trim()}"`}
            </p>
          )}
        </div>
      )}

      <MessageThread
        chatId={activeChat?.id}
        scrollApiRef={scrollApiRef}
        meId={meId}
        messages={visibleMessages}
        uploadBase={uploadBase}
        chatBackground={activeChat?.chat_background_url}
        isSelfChat={isSelfChat}
        typing={typing}
        typingName={typingName || partner?.name}
        loading={loadingMessages}
        emptyStateText={normalizedSearch ? `No messages found for "${searchText.trim()}".` : "No messages yet. Say hello."}
        onSeen={onSeen}
        onReply={onReply}
        onDeleteLocal={onDeleteLocal}
        onEditMessage={onEditMessage}
        onDeleteForEveryone={onDeleteForEveryone}
        onToggleStar={onToggleStar}
        onReact={onReact}
        onForward={onForward}
        onSelectToggle={onSelectToggle}
        selectedMessageIds={selectedMessageIds}
        notify={notify}
      />

      <Composer
        onTyping={onTyping}
        onSend={onSend}
        notify={notify}
        enterToSend={enterToSend}
        disabled={isBlocked}
        disabledReason={blockMessage || "Messaging unavailable"}
        replyTo={replyToMessage}
        onCancelReply={onCancelReply}
      />

      {profileOpen && (
        <PartnerProfileSheet
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          partner={partner}
          isGroup={isGroupChat || isSelfChat}
          memberCount={isSelfChat ? 1 : memberCount}
          blockedByMe={blockedByMe}
          blockedMe={blockedMe}
          blockActionBusy={blockActionBusy}
          onBlockUser={onBlockUser}
          onUnblockUser={onUnblockUser}
          onReportUser={async (payload) => {
            if (!onReportUser || !partner?.id) return;
            setReportBusy(true);
            try {
              await onReportUser({
                userId: partner.id,
                reason: payload?.reason,
                details: payload?.details
              });
              setProfileOpen(false);
            } finally {
              setReportBusy(false);
            }
          }}
          reportBusy={reportBusy}
        />
      )}
    </section>
  );
}
