import { useEffect, useMemo, useRef, useState, lazy, Suspense, useCallback } from "react";
import { Check, Copy, ImageUp, Loader2, Paintbrush2, Search, Star, Trash2, X, Forward, Download, Lock, ShieldCheck, Sparkles, MessageSquare, Pin, KeyRound, ArrowRight } from "lucide-react";
import ChatHeader from "./ChatHeader";
import MessageThread from "./MessageThread";
import Composer from "./Composer";
import PartnerProfileSheet from "./PartnerProfileSheet";
import WatchTogetherPanel from "./WatchTogetherPanel";
import { CHAT_BACKGROUND_PRESETS } from "../../utils/chat";
import { navigateTo } from "../../utils/nav";
import { api } from "../../api/client";

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
  onDeleteChat,
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
  onTogglePin,
  onVotePoll,
  selectedMessageIds,
  onClearSelection,
  compactMode,
  showOnlineStatus,
  isGroupChat = false,
  isSelfChat = false,
  memberCount = 0,
  theme = "dark",
  chatPaneColor,
  isChatPaneLight,
  notify,
  mobile,
  onHiddenSearchNavigate,
  socket = null
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  // Hidden message search state
  const [searchTab, setSearchTab] = useState("messages"); // "messages" | "hidden"
  const [hiddenKey, setHiddenKey] = useState("");
  const [hiddenResults, setHiddenResults] = useState(null); // null = not searched yet
  const [hiddenVaultMeta, setHiddenVaultMeta] = useState([]); // safe metadata list
  const [hiddenSearchBusy, setHiddenSearchBusy] = useState(false);
  const [hiddenSearchError, setHiddenSearchError] = useState("");
  const hiddenKeyInputRef = useRef(null);
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

  const selectedMessages = useMemo(() => {
    return (messages || []).filter((msg) => Boolean(selectedMessageIds?.[msg.id]));
  }, [messages, selectedMessageIds]);

  const pinnedMessage = useMemo(() => {
    if (!activeChat?.pinned_message_id || !messages) return null;
    return messages.find((msg) => Number(msg.id) === Number(activeChat.pinned_message_id)) || null;
  }, [activeChat?.pinned_message_id, messages]);

  const selectedCount = selectedMessages.length;

  const handleCopySelected = async () => {
    const text = selectedMessages.map((msg) => msg.body).filter(Boolean).join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify?.({ type: "success", message: `${selectedCount} message(s) copied.` });
    } catch {
      notify?.({ type: "error", message: "Unable to copy messages." });
    }
    onClearSelection?.();
  };

  const handleStarSelected = async () => {
    for (const msg of selectedMessages) {
      await onToggleStar?.(msg);
    }
    onClearSelection?.();
  };

  const handleDeleteSelected = async () => {
    for (const msg of selectedMessages) {
      const isMine = Number(msg.sender_id) === Number(meId);
      if (isMine && !msg.deleted_for_everyone) {
        await onDeleteForEveryone?.(msg);
      } else {
        await onDeleteLocal?.(msg);
      }
    }
    onClearSelection?.();
  };

  const handleForwardSelected = () => {
    if (!selectedMessages.length) return;
    onForward?.(selectedMessages);
  };

  const handleScrollToPinned = () => {
    if (!pinnedMessage) return;
    const element = document.getElementById(`msg-${pinnedMessage.id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.remove("reply-highlight-flash");
      void element.offsetWidth;
      element.classList.add("reply-highlight-flash");
    }
  };

  const handleDownloadSelected = () => {
    if (!selectedMessages.length) return;
    const text = selectedMessages.map((msg) => {
      const sender = Number(msg.sender_id) === Number(meId) ? "Me" : (partner?.name || "User");
      const time = new Date(msg.created_at || Date.now()).toLocaleString();
      return `[${time}] ${sender}: ${msg.body || "[media]"}`;
    }).join("\n");
    
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chat_export_${activeChat.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    onClearSelection?.();
  };

  useEffect(() => {
    setSearchOpen(false);
    setSearchText("");
    setSearchTab("messages");
    setHiddenKey("");
    setHiddenResults(null);
    setHiddenSearchError("");
    setMuted(false);
    setWatchOpen(Boolean(watchSession?.active));
    setBackgroundOpen(false);
    setBackgroundSaving(false);
    setProfileOpen(false);
    setReportBusy(false);
  }, [activeChat?.id, watchSession?.active]);

  // Couple & Mood Floating Emojis States
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const isCouple = partner?.relationship_status === "relationship" || partner?.relationship_status === "married";

  const triggerEmojiExplosion = (emoji) => {
    const newEmojis = [];
    const count = 30;
    for (let i = 0; i < count; i++) {
      newEmojis.push({
        id: `explode-${Date.now()}-${Math.random()}`,
        emoji,
        left: Math.random() * 80 + 10, // percentage 10% - 90%
        delay: Math.random() * 0.4,
        size: Math.random() * 24 + 18,
        duration: Math.random() * 1.5 + 1.2,
        explode: true
      });
    }
    setFloatingEmojis((prev) => [...prev, ...newEmojis]);
  };

  const handleFloatingClick = (item) => {
    // Boom effect! Remove clicked item, explode 30 particles of it all over the pane
    setFloatingEmojis((prev) => prev.filter((x) => x.id !== item.id));
    triggerEmojiExplosion(item.emoji);
  };

  // Generate floating emojis automatically for couples, or mock expression trigger
  useEffect(() => {
    if (!activeChat?.id) return;
    const interval = setInterval(() => {
      // If couple, periodically float hearts
      if (isCouple) {
        setFloatingEmojis((prev) => [
          ...prev.slice(-40),
          {
            id: `heart-${Date.now()}-${Math.random()}`,
            emoji: "❤️",
            left: Math.random() * 80 + 10,
            delay: 0,
            size: Math.random() * 16 + 12,
            duration: Math.random() * 3 + 2.5
          }
        ]);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [activeChat?.id, isCouple]);

  // Simulate Expression Mood Recognition when new message is received or typed
  useEffect(() => {
    if (!messages.length) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.pending) return;

    // Quick sentiment parser to simulate expression recognition from face/message text
    const text = (lastMsg.body || "").toLowerCase();
    let detectedEmoji = null;
    if (text.includes("angry") || text.includes("gussa") || text.includes("hate") || text.includes("😠") || text.includes("😡")) {
      detectedEmoji = "😡";
    } else if (text.includes("happy") || text.includes("khush") || text.includes("smile") || text.includes("😊") || text.includes("😀")) {
      detectedEmoji = "😊";
    } else if (text.includes("love") || text.includes("pyar") || text.includes("sweet") || text.includes("❤️") || text.includes("😘")) {
      detectedEmoji = "💖";
    } else if (text.includes("sad") || text.includes("ro") || text.includes("cry") || text.includes("😭") || text.includes("😢")) {
      detectedEmoji = "😢";
    }

    if (detectedEmoji) {
      // Spawn floating mood emojis reflecting the sentiment
      const newMoods = Array.from({ length: 4 }).map((_, idx) => ({
        id: `mood-${Date.now()}-${idx}-${Math.random()}`,
        emoji: detectedEmoji,
        left: Math.random() * 70 + 15,
        delay: idx * 0.3,
        size: Math.random() * 18 + 14,
        duration: Math.random() * 4 + 3
      }));
      setFloatingEmojis((prev) => [...prev, ...newMoods]);
    }
  }, [messages]);

  // Focus the correct input when tab changes or search opens
  useEffect(() => {
    if (!searchOpen) return;
    const timer = setTimeout(() => {
      if (searchTab === "messages") {
        searchInputRef.current?.focus();
      } else {
        hiddenKeyInputRef.current?.focus();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [searchOpen, searchTab]);

  // Fetch vault metadata (safe) when Hidden tab is opened so we can enrich results
  const fetchHiddenVaultMeta = useCallback(async () => {
    try {
      const { data } = await api.get("/hidden-messages");
      setHiddenVaultMeta(Array.isArray(data) ? data : []);
    } catch {
      // non-critical — results still work via unlockedIds
    }
  }, []);

  useEffect(() => {
    if (searchOpen && searchTab === "hidden") {
      fetchHiddenVaultMeta();
    }
  }, [searchOpen, searchTab, fetchHiddenVaultMeta]);

  // Hidden key search handler — uses existing /api/hidden-messages/unlock endpoint
  const handleHiddenSearch = useCallback(async (e) => {
    e?.preventDefault();
    const trimmedKey = hiddenKey.trim();
    if (!trimmedKey) return;
    setHiddenSearchBusy(true);
    setHiddenSearchError("");
    setHiddenResults(null);
    try {
      const { data } = await api.post("/hidden-messages/unlock", { key: trimmedKey });
      const ids = data.unlockedIds || [];
      if (ids.length === 0) {
        // Generic message — don't reveal whether records exist or not
        setHiddenSearchError("Incorrect unlock key.");
      } else {
        setHiddenResults(ids);
        // Refresh meta to make sure we have latest
        fetchHiddenVaultMeta();
      }
    } catch (err) {
      // Return generic error regardless of actual server message
      setHiddenSearchError("Incorrect unlock key.");
    } finally {
      setHiddenSearchBusy(false);
    }
  }, [hiddenKey, fetchHiddenVaultMeta]);

  // Navigate to a hidden message result — scroll if same chat, or switch chat via prop
  const handleNavigateToHiddenResult = useCallback((entry) => {
    if (!entry?.message_id) return;
    const msgId = Number(entry.message_id);
    const chatId = Number(entry.chat_id);

    if (activeChat && Number(activeChat.id) === chatId) {
      // Same chat — scroll directly
      const el = document.getElementById(`msg-${msgId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("reply-highlight-flash");
        void el.offsetWidth;
        el.classList.add("reply-highlight-flash");
      } else {
        // Try scrollApiRef if element not yet in DOM
        scrollApiRef.current?.scrollToBottom?.("smooth");
      }
    } else {
      // Different chat — delegate to parent
      onHiddenSearchNavigate?.({ chatId, messageId: msgId });
    }
  }, [activeChat, onHiddenSearchNavigate]);

  // Normal search: privacy rule — exclude hidden messages from full-text search
  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleMessages = useMemo(() => {
    const activeMessages = (messages || []).filter((m) => !m.is_hidden_message);
    if (!normalizedSearch) return activeMessages;
    return activeMessages.filter((message) =>
      (message.body || "").toLowerCase().includes(normalizedSearch)
    );
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
      <section className="hidden h-full flex-col items-center justify-center rounded-none border-l border-slate-200/80 bg-gradient-to-tr from-slate-50 via-slate-100 to-slate-50 p-6 shadow-none sm:rounded-none dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:flex w-full select-none">
        <div className="backdrop-blur-md bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 shadow-xl rounded-3xl p-8 max-w-md w-full text-center flex flex-col items-center gap-6 transition-all duration-300 hover:shadow-2xl hover:scale-[1.01]">
          {/* Logo container */}
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
            <MessageSquare className="w-10 h-10" />
            <div className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500"></span>
            </div>
          </div>

          {/* Heading and Subtitle */}
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-950 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              AnaChat
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              Send secure messages, share media files, watch videos together, and make high-quality calls.
            </p>
          </div>

          {/* Divider */}
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent"></div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/30 dark:border-slate-700/30 text-left">
              <Lock className="w-4 h-4 text-purple-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Secure Chats</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/30 dark:border-slate-700/30 text-left">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Privacy First</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/30 dark:border-slate-700/30 text-left">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Rich Media</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/30 dark:border-slate-700/30 text-left">
              <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Watch Room</span>
            </div>
          </div>

          {/* Footer instruction */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Select a chat from the left panel to begin</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`glass-bar flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-none border-l border-slate-200/80 shadow-none sm:rounded-none ${compactMode ? "text-[13px]" : ""} ${
        isChatPaneLight ? "text-gray-900" : "text-white"
      }`}
      style={chatPaneColor ? { backgroundColor: chatPaneColor } : undefined}
    >
      {selectedCount > 0 ? (
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-slate-900/95 px-4 text-white dark:border-slate-800 dark:bg-slate-950/95 backdrop-blur-md transition-all duration-300">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onClearSelection?.()}
              className="rounded-full p-2 hover:bg-white/10 active:scale-95 transition"
              aria-label="Cancel selection"
              title="Cancel"
            >
              <X size={18} />
            </button>
            <span className="text-sm font-semibold text-slate-200">{selectedCount} selected</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleStarSelected}
              className="rounded-full p-2 hover:bg-white/10 active:scale-95 transition text-slate-200 hover:text-white"
              aria-label="Star selected messages"
              title="Star"
            >
              <Star size={16} />
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="rounded-full p-2 hover:bg-white/10 active:scale-95 transition text-rose-300 hover:text-rose-200"
              aria-label="Delete selected messages"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              onClick={handleForwardSelected}
              className="rounded-full p-2 hover:bg-white/10 active:scale-95 transition text-slate-200 hover:text-white"
              aria-label="Forward selected messages"
              title="Forward"
            >
              <Forward size={16} />
            </button>
            <button
              type="button"
              onClick={handleDownloadSelected}
              className="rounded-full p-2 hover:bg-white/10 active:scale-95 transition text-slate-200 hover:text-white"
              aria-label="Download selected messages"
              title="Download"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      ) : (
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
      )}

      {pinnedMessage && (
        <div 
          onClick={handleScrollToPinned}
          className={`flex items-center justify-between border-b px-4 py-2 text-xs font-semibold cursor-pointer transition select-none ${
            isDarkTheme 
              ? "border-slate-800 bg-slate-900/60 hover:bg-slate-800/40 text-slate-200" 
              : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Pin size={12} className="rotate-45 text-rose-500 shrink-0" />
            <span className="text-[11px] font-bold text-rose-500 shrink-0">Pinned Message:</span>
            <span className="truncate text-slate-500 dark:text-slate-400 font-medium">
              {pinnedMessage.message_type === "poll" 
                ? "📊 Poll" 
                : (pinnedMessage.body || (pinnedMessage.image_url ? "📷 Media/Attachment" : ""))}
            </span>
          </div>
          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin?.(pinnedMessage);
            }} 
            className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/5 transition"
            title="Unpin"
          >
            <X size={12} />
          </button>
        </div>
      )}

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
        <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          {/* Tab switcher */}
          <div className="flex items-center gap-0 border-b border-slate-100 dark:border-slate-800/60 px-3 sm:px-5 pt-2">
            <button
              type="button"
              id="search-tab-messages"
              onClick={() => {
                setSearchTab("messages");
                setHiddenResults(null);
                setHiddenSearchError("");
              }}
              className={`relative px-3 py-1.5 text-xs font-semibold transition-all duration-150 rounded-t-lg border-b-2 mr-1 ${
                searchTab === "messages"
                  ? "border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50/60 dark:bg-violet-950/20"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              aria-selected={searchTab === "messages"}
            >
              <span className="flex items-center gap-1.5">
                <Search size={11} />
                Messages
              </span>
            </button>
            <button
              type="button"
              id="search-tab-hidden"
              onClick={() => {
                setSearchTab("hidden");
                setSearchText("");
              }}
              className={`relative px-3 py-1.5 text-xs font-semibold transition-all duration-150 rounded-t-lg border-b-2 ${
                searchTab === "hidden"
                  ? "border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50/60 dark:bg-violet-950/20"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              aria-selected={searchTab === "hidden"}
            >
              <span className="flex items-center gap-1.5">
                <KeyRound size={11} />
                🔐 Hidden
              </span>
            </button>
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchText("");
                  setSearchTab("messages");
                  setHiddenKey("");
                  setHiddenResults(null);
                  setHiddenSearchError("");
                }}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Close search"
                title="Close search"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages tab content */}
          {searchTab === "messages" && (
            <div className="px-3 py-2 sm:px-5">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900">
                <Search size={15} className="shrink-0 text-slate-500 dark:text-slate-400" />
                <input
                  ref={searchInputRef}
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="Search messages in this chat..."
                  aria-label="Search messages in this chat"
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => setSearchText("")}
                    className="rounded-md p-0.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {normalizedSearch && (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {searchResultCount
                    ? `${searchResultCount} result${searchResultCount > 1 ? "s" : ""} found`
                    : `No results for "${searchText.trim()}"`}
                </p>
              )}
            </div>
          )}

          {/* Hidden tab content */}
          {searchTab === "hidden" && (
            <div className="px-3 py-2 sm:px-5 space-y-2.5">
              <form onSubmit={handleHiddenSearch} className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-violet-200 bg-white px-2.5 py-2 focus-within:border-violet-400 dark:border-violet-800/60 dark:bg-slate-900 dark:focus-within:border-violet-500 transition">
                  <KeyRound size={14} className="shrink-0 text-violet-400 dark:text-violet-500" />
                  <input
                    ref={hiddenKeyInputRef}
                    type="text"
                    value={hiddenKey}
                    onChange={(e) => {
                      setHiddenKey(e.target.value);
                      setHiddenResults(null);
                      setHiddenSearchError("");
                    }}
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder="Enter secret key (PIN / Emoji / PIN+Emoji)..."
                    aria-label="Enter secret key to search hidden messages"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {hiddenKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setHiddenKey("");
                        setHiddenResults(null);
                        setHiddenSearchError("");
                      }}
                      className="rounded-md p-0.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label="Clear key"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  id="hidden-search-unlock-btn"
                  disabled={hiddenSearchBusy || !hiddenKey.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {hiddenSearchBusy
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Search size={13} />}
                  Unlock
                </button>
              </form>

              {/* Error state */}
              {hiddenSearchError && (
                <p className="text-xs font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                  <X size={11} className="shrink-0" />
                  {hiddenSearchError}
                </p>
              )}

              {/* Results */}
              {hiddenResults !== null && !hiddenSearchError && (
                <div className="space-y-2 pb-1">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Check size={12} className="shrink-0" />
                    {hiddenResults.length} hidden message{hiddenResults.length !== 1 ? "s" : ""} found
                  </p>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
                    {hiddenResults.map((msgId) => {
                      // Find safe metadata for this message from vault
                      const meta = hiddenVaultMeta.find(m => Number(m.message_id) === Number(msgId));
                      const isMedia = meta?.key_type === "emoji" || meta?.key_type === "pin_emoji";
                      const timeLabel = meta?.created_at
                        ? (() => {
                            const d = new Date(meta.created_at);
                            const now = new Date();
                            const diffDays = Math.floor((now - d) / 86400000);
                            if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                            if (diffDays === 1) return `Yesterday · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                            if (diffDays < 7) return `${d.toLocaleDateString([], { weekday: "short" })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                            return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                          })()
                        : null;

                      return (
                        <button
                          key={msgId}
                          type="button"
                          id={`hidden-result-${msgId}`}
                          onClick={() => handleNavigateToHiddenResult(meta || { message_id: msgId, chat_id: activeChat?.id })}
                          className="group w-full flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-left transition hover:border-violet-300 hover:bg-violet-100/60 active:scale-[0.98] dark:border-violet-900/40 dark:bg-violet-950/20 dark:hover:border-violet-700/60 dark:hover:bg-violet-950/40"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <Lock size={11} className="shrink-0 text-violet-500" />
                              {/* PRIVACY: Never reveal original content — show placeholder only */}
                              {isMedia ? "🔒 Hidden media" : "🔒 Hidden message"}
                            </span>
                            {(timeLabel || meta?.conversation_name) && (
                              <span className="block truncate text-[10px] text-slate-400 dark:text-slate-500">
                                {[timeLabel, meta?.conversation_name].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </div>
                          <ArrowRight size={13} className="shrink-0 text-violet-400 opacity-0 transition group-hover:opacity-100" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty / hint state */}
              {hiddenResults === null && !hiddenSearchError && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                  Enter your secret key (PIN, emoji, or PIN+emoji) to find your hidden messages.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Emojis Layer */}
      <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
        {floatingEmojis.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleFloatingClick(item)}
            className="absolute pointer-events-auto select-none cursor-pointer hover:scale-125 transition-transform animate-float"
            style={{
              left: `${item.left}%`,
              fontSize: `${item.size}px`,
              animationDelay: `${item.delay}s`,
              animationDuration: `${item.duration}s`,
              bottom: item.explode ? "50%" : "-10%",
              animationName: item.explode ? "explodeUp" : "floatUp",
              animationFillMode: "forwards",
              "--dx": item.explode ? `${(Math.random() - 0.5) * 400}px` : undefined,
              "--dy": item.explode ? `${(Math.random() - 0.7) * 450}px` : undefined
            }}
          >
            {item.emoji}
          </button>
        ))}
      </div>

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
        onTogglePin={onTogglePin}
        onVotePoll={onVotePoll}
        pinnedMessageId={activeChat?.pinned_message_id}
        selectedMessageIds={selectedMessageIds}
        notify={notify}
        onHideChat={isSelfChat ? undefined : onHideChat}
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
          socket={socket}
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
          meId={meId}
          chatId={activeChat?.id}
          messages={messages}
          onSearchOpen={() => {
            setProfileOpen(false);
            setSearchOpen(true);
          }}
          onDeleteChat={onDeleteChat}
          theme={theme}
        />
      )}
    </section>
  );
}
