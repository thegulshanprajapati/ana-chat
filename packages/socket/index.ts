export type SocketEventMap = {
  handshake: { userId: string };
  message: { recipientId: string; payload: unknown };
  typing: { recipientId: string; isTyping: boolean };
  stopTyping: { recipientId: string };
  presence: { recipientId: string; status: "online" | "offline" | "away" };
  delivered: { messageId: string; recipientId: string };
  read: { messageId: string; recipientId: string };
  reaction: { messageId: string; reaction: string };
  edit: { messageId: string; content: string };
  delete: { messageId: string };
  ack: { messageId: string };
};

export type SocketMessage = SocketEventMap["message"];
