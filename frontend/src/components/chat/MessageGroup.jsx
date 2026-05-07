import ChatBubble from "./ChatBubble";

export default function MessageGroup({
  group,
  meId,
  isSelfChat = false,
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
  selectedMessageIds,
  notify
}) {
  const mine = group.senderId === meId;
  const groupAlignmentClass = isSelfChat
    ? "mx-auto w-full max-w-[560px] space-y-1"
    : `space-y-1 ${mine ? "pl-10" : "pr-10"}`;

  return (
    <div className={groupAlignmentClass}>
      {group.messages.map((message, index) => (
        <ChatBubble
          key={message.id}
          message={message}
          mine={mine}
          centerAligned={isSelfChat}
          grouped={index !== group.messages.length - 1}
          uploadBase={uploadBase}
          onOpenMedia={onOpenMedia}
          onReply={onReply}
          onDeleteLocal={onDeleteLocal}
          onEditMessage={onEditMessage}
          onDeleteForEveryone={onDeleteForEveryone}
          onToggleStar={onToggleStar}
          onReact={onReact}
          onForward={onForward}
          onSelectToggle={onSelectToggle}
          selected={Boolean(selectedMessageIds?.[message.id])}
          notify={notify}
        />
      ))}
    </div>
  );
}
