import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import MessageGroup from "./MessageGroup";
import DaySeparator from "./DaySeparator";
import TypingIndicator from "./TypingIndicator";
import { chatBackgroundStyle, groupMessages, isVideoMedia } from "../../utils/chat";
import useChatScroll from "../../hooks/useChatScroll";
import SparkleConfetti from "./SparkleConfetti";
import MediaViewerModal from "./MediaViewerModal";

function EncryptionNotice() {
  return (
    <div className="mx-auto w-fit rounded-full border border-emerald-300/70 bg-emerald-50/90 px-3 py-1 text-[11px] font-medium text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200">
      Messages and calls are end-to-end encrypted.
    </div>
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
  notify
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const celebratedChatIdsRef = useRef(new Set());
  const grouped = useMemo(() => groupMessages(messages), [messages]);
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

  useEffect(() => {
    if (atBottom) {
      scrollToBottom("smooth");
      onSeen?.();
    }
  }, [atBottom, grouped, onSeen, scrollToBottom, typing]);

  useEffect(() => {
    const normalizedChatId = Number(chatId);
    if (!normalizedChatId || !messages.length) return;
    if (!atTop) return;
    if (celebratedChatIdsRef.current.has(normalizedChatId)) return;
    celebratedChatIdsRef.current.add(normalizedChatId);
    requestAnimationFrame(() => setSparkle(true));
  }, [atTop, chatId, messages.length]);

  if (loading) {
    return (
      <div className="min-h-0 flex-1">
        <div
          ref={scrollRef}
          style={threadBackgroundStyle || undefined}
          onContextMenu={(event) => event.preventDefault()}
          className="thread-surface chat-scroll min-h-0 h-full w-full flex-1 scroll-smooth space-y-2.5 overflow-y-auto px-3 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 sm:pb-16"
          aria-label="Loading messages"
        >
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className={`animate-pulse ${idx % 2 ? "ml-auto w-[65%]" : "w-[72%]"}`}>
              <div className="h-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
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
          className="thread-surface chat-scroll min-h-0 h-full w-full flex-1 scroll-smooth overflow-y-auto px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] text-sm text-slate-500 dark:text-slate-400"
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
        className="thread-surface chat-scroll min-h-0 h-full w-full flex-1 scroll-smooth space-y-2.5 overflow-y-auto px-3 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 sm:pb-16"
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
