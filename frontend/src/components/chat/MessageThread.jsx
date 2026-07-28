import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Loader2, Lock, X } from "lucide-react";
import MessageGroup from "./MessageGroup";
import DaySeparator from "./DaySeparator";
import TypingIndicator from "./TypingIndicator";
import { chatBackgroundStyle, groupMessages, isVideoMedia } from "../../utils/chat";
import useChatScroll from "../../hooks/useChatScroll";
import SparkleConfetti from "./SparkleConfetti";
import MediaViewerModal from "./MediaViewerModal";

function EncryptionNotice() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="mx-auto w-fit rounded-full border border-emerald-300/70 bg-emerald-50/90 px-4 py-1.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200 flex items-center gap-1.5 shadow-sm">
        <Lock size={12} className="text-emerald-600 dark:text-emerald-400" />
        <span>Messages and calls are end-to-end encrypted.</span>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="text-violet-600 dark:text-violet-300 hover:underline font-bold focus:outline-none"
        >
          Know more
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <div
            onClick={() => setShowModal(false)}
            className="absolute inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm transition-opacity"
          />

          {/* Card container */}
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl text-slate-800 dark:text-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                <Lock size={15} className="text-emerald-500" />
                End-to-End Encryption
              </h4>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 dark:text-slate-400 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              AnaChat secures your private messages with strong end-to-end encryption. Your conversations, calls, voice notes, and media files are encrypted before they leave your device and can only be decrypted by you and the recipient.
            </p>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-3.5 border border-slate-100 dark:border-slate-800 space-y-2">
              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                🔒 Cryptographic Proof
              </p>
              <ul className="text-[10px] text-slate-500 dark:text-slate-400 list-disc list-inside space-y-1">
                <li>Uses RSA-OAEP for secure AES key exchange.</li>
                <li>Uses AES-GCM for stream block encryption.</li>
                <li>Private keys never leave your device.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/10 active:scale-[0.98] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function MessageThread({
  chatId,
  scrollApiRef,
  meId,
  messages,
  uploadBase,
  chatBackground,
  isSelfChat = false,
  typing,
  typingName,
  loading,
  emptyStateText = "No messages yet. Say hello.",
  onSeen,
  onReply,
  onDeleteLocal,
  onEditMessage,
  onDeleteForEveryone,
  onToggleStar,
  onReact,
  onForward,
  onSelectToggle,
  selectedMessageIds,
  notify,
  onHideChat
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const celebratedChatIdsRef = useRef(new Set());
  const filteredMessages = useMemo(() => {
    if (!chatId || !meId || !messages) return messages || [];
    try {
      const config = JSON.parse(localStorage.getItem(`ana_disappearing_chats_${meId}`) || "{}");
      const duration = Number(config[chatId]);
      if (!duration) return messages;

      const now = Date.now();
      return messages.filter((msg) => {
        const createdAt = new Date(msg.created_at).getTime();
        if (duration === 86400) {
          return now - createdAt < 86400 * 1000;
        }
        if (duration === 3600) {
          if (!msg.seen) return true;
          const seenAt = msg.updated_at ? new Date(msg.updated_at).getTime() : createdAt;
          return now - seenAt < 3600 * 1000;
        }
        return true;
      });
    } catch (e) {
      return messages;
    }
  }, [messages, chatId, meId]);

  const grouped = useMemo(() => groupMessages(filteredMessages), [filteredMessages]);
  const threadBackgroundStyle = useMemo(
    () => chatBackgroundStyle(chatBackground, uploadBase),
    [chatBackground, uploadBase]
  );
  const [sparkle, setSparkle] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const mediaItems = useMemo(() => {
    return (messages || []).filter((msg) => {
      if (!msg?.image_url) return false;
      if (msg.deleted_for_everyone) return false;
      const kind = msg?.e2ee?.media?.kind || (isVideoMedia(msg.image_url) ? "video" : "image");
      if (kind === "image" || kind === "video") return true;
      if (kind !== "file") return false;
      const mime = (msg?.e2ee?.media?.mime || "").toString();
      return /^application\/pdf\b/i.test(mime);
    });
  }, [messages]);

  const openViewerByMessageId = useCallback((messageId) => {
    const idx = mediaItems.findIndex((m) => Number(m.id) === Number(messageId));
    if (idx < 0) return;
    setViewerIndex(idx);
    setViewerOpen(true);
  }, [mediaItems]);

  const {
    atBottom,
    atTop,
    showScrollDown,
    scrollToBottom,
    scrollToTop,
    refresh
  } = useChatScroll({ containerRef: scrollRef, bottomRef });

  useEffect(() => {
    if (!scrollApiRef) return undefined;
    scrollApiRef.current = { scrollToBottom, scrollToTop };
    return () => {
      scrollApiRef.current = null;
    };
  }, [scrollApiRef, scrollToBottom, scrollToTop]);

  useEffect(() => {
    refresh();
  }, [messages.length, refresh]);

  // Use useLayoutEffect or a fast frame request to snap scroll position before paint
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    // Fallback if height calculations are still running
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [chatId, messages.length]);

  useEffect(() => {
    if (atBottom) {
      scrollToBottom("smooth");
      onSeen?.();
    }
  }, [atBottom, grouped, onSeen, scrollToBottom, typing]);

  if (loading) {
    return (
      <div className="min-h-0 flex-1">
        <div
          ref={scrollRef}
          style={threadBackgroundStyle || undefined}
          onContextMenu={(event) => event.preventDefault()}
          className="thread-surface chat-scroll min-h-0 h-full w-full flex-1 overflow-y-auto px-3 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 sm:pb-16"
          aria-label="Loading messages"
        >
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <Loader2 className="animate-spin" />
            </div>
            <p>Loading messages…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="min-h-0 flex-1">
        <div
          ref={scrollRef}
          style={threadBackgroundStyle || undefined}
          onContextMenu={(event) => event.preventDefault()}
          className="thread-surface chat-scroll min-h-0 h-full w-full flex-1 overflow-y-auto px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] text-sm text-slate-500 dark:text-slate-400"
        >
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
            <EncryptionNotice />
            <p>{emptyStateText}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        style={threadBackgroundStyle || undefined}
        onContextMenu={(event) => event.preventDefault()}
        className="thread-surface chat-scroll min-h-0 h-full w-full flex-1 space-y-2.5 overflow-y-auto px-3 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 sm:pb-16"
      >
        <EncryptionNotice />
        {grouped.map((entry) => {
          if (entry.type === "day") {
            return <DaySeparator key={entry.dayKey} label={entry.label} />;
          }
          return (
            <MessageGroup
              key={entry.key}
              group={entry}
              meId={meId}
              isSelfChat={isSelfChat}
              uploadBase={uploadBase}
              onOpenMedia={openViewerByMessageId}
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
              onHideChat={onHideChat}
            />
          );
        })}
        {typing && <TypingIndicator name={typingName} />}
        <div ref={bottomRef} />
      </div>

      <SparkleConfetti active={sparkle} onDone={() => setSparkle(false)} />

      <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex flex-col gap-2">
        {showScrollDown && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-accent bg-accent shadow-accent transition hover:-translate-y-0.5 hover:brightness-110"
            aria-label="Scroll to latest"
            title="Scroll to latest"
          >
            <ArrowDown size={18} />
          </button>
        )}
      </div>

      <MediaViewerModal
        open={viewerOpen}
        items={mediaItems}
        index={viewerIndex}
        uploadBase={uploadBase}
        meId={meId}
        onClose={() => setViewerOpen(false)}
        onNavigate={(idx) => setViewerIndex(Math.max(0, Math.min(idx, mediaItems.length - 1)))}
        onReact={onReact}
        onDeleteLocal={onDeleteLocal}
        onDeleteForEveryone={onDeleteForEveryone}
        notify={notify}
      />
    </div>
  );
}
