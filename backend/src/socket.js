import { Server } from "socket.io";
import cookie from "cookie";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyToken } from "./services/tokens.js";
import { getDb, getNextSequence } from "./db.js";
import {
  directPeerId,
  getChatMembership,
  getChatParticipantIds,
  getDirectBlockState,
  usersAreConnectedByChat
} from "./utils/chatDb.js";

function userRoom(userId) {
  return `user_${userId}`;
}

function notifyChatUpdated(io, userIds, chatId) {
  const unique = [...new Set(userIds.filter(Boolean))];
  unique.forEach((id) => {
    io.to(userRoom(id)).emit("chat_updated", { chatId });
  });
}

function normalizeWatchUrl(rawUrl) {
  const value = (rawUrl || "").toString().trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  return "";
}

function normalizeWatchTitle(rawTitle) {
  return (rawTitle || "").toString().trim().slice(0, 80);
}

function normalizeWatchPosition(rawPosition) {
  const value = Number(rawPosition);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 1000) / 1000;
}

function normalizeWatchRate(rawRate) {
  const value = Number(rawRate);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.25, Math.min(2, Math.round(value * 100) / 100));
}

async function createRedisAdapterIfConfigured(io) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  return { pubClient, subClient };
}

export async function initSocket(httpServer) {
  const allowedOrigins = (process.env.CLIENT_ORIGIN || "https://chat.myana.site,https://www.chat.myana.site")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const originAllowed = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/[^/]+$/.test(origin)) return true;
    return false;
  };

  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (originAllowed(origin)) return callback(null, true);
        return callback(new Error("CORS blocked"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"]
    }
  });

  await createRedisAdapterIfConfigured(io);

  const watchSessions = new Map();

  io.use(async (socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie || "";
      const parsed = cookie.parse(rawCookie);
      const accessToken = parsed.access_token;
      if (!accessToken) return next(new Error("Unauthorized"));

      const payload = verifyToken(accessToken);
      if (payload.typ !== "access") return next(new Error("Unauthorized"));

      const db = await getDb();
      const [user, session] = await Promise.all([
        db.collection("users").findOne(
          { id: Number(payload.uid) },
          { projection: { _id: 0, id: 1, name: 1, avatar_url: 1, is_blocked: 1, is_verified: 1 } }
        ),
        db.collection("sessions").findOne(
          { id: Number(payload.sid), user_id: Number(payload.uid) },
          { projection: { _id: 0, id: 1, revoked_at: 1 } }
        )
      ]);

      if (!user || !session || session.revoked_at || user.is_blocked || !user.is_verified) {
        return next(new Error("Unauthorized"));
      }

      socket.userId = user.id;
      socket.sessionId = session.id;
      socket.userName = (user.name || "").toString().trim() || `User ${user.id}`;
      socket.userAvatar = user.avatar_url || null;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    socket.join(userRoom(userId));

    try {
      const db = await getDb();
      await db.collection("users").updateOne({ id: Number(userId) }, { $set: { status: "online" } });
      io.emit("user_status", { userId, status: "online", last_seen: null });
    } catch {
      // ignore status update failures
    }

    socket.on("join_room", async (chatId) => {
      const normalizedChatId = Number(chatId);
      if (!normalizedChatId) return;
      const db = await getDb();
      const chat = await getChatMembership(db, normalizedChatId, userId);
      if (!chat) return;
      socket.join(`chat_${normalizedChatId}`);
      const session = watchSessions.get(normalizedChatId);
      if (session) {
        socket.emit("watch_session_state", session);
      } else {
        socket.emit("watch_session_state", { chatId: normalizedChatId, active: false });
      }
    });

    socket.on("typing", async ({ chatId }) => {
      if (!chatId) return;
      const db = await getDb();
      const chat = await getChatMembership(db, Number(chatId), userId);
      if (!chat) return;
      if (chat.chat_type !== "group") {
        const peerId = directPeerId(chat, userId);
        const blocked = await getDirectBlockState(db, userId, peerId);
        if (blocked.blocked) return;
      }
      socket.to(`chat_${chatId}`).emit("typing", {
        chatId,
        userId,
        name: socket.userName || null,
        avatar_url: socket.userAvatar || null
      });
    });

    socket.on("seen", async ({ chatId }) => {
      if (!chatId) return;
      const db = await getDb();
      const chat = await getChatMembership(db, Number(chatId), userId);
      if (!chat) return;
      if (chat.chat_type !== "group") {
        const peerId = directPeerId(chat, userId);
        const blocked = await getDirectBlockState(db, userId, peerId);
        if (blocked.blocked) return;
      }

      try {
        await db.collection("messages").updateMany(
          { chat_id: Number(chatId), sender_id: { $ne: Number(userId) } },
          { $set: { seen: true } }
        );
        socket.to(`chat_${chatId}`).emit("seen", { chatId, userId });
      } catch {
        // ignore
      }
    });

    socket.on("send_message", async ({ chatId, body }) => {
      if (!chatId || !body) return;
      const db = await getDb();
      const chat = await getChatMembership(db, Number(chatId), userId);
      if (!chat) return;
      if (chat.chat_type !== "group") {
        const peerId = directPeerId(chat, userId);
        const blocked = await getDirectBlockState(db, userId, peerId);
        if (blocked.blockedByA) return;
        if (blocked.blockedByB) return;
      }
      const participantIds = await getChatParticipantIds(db, chat);

      try {
        const now = new Date();
        const messageId = await getNextSequence("messages");
        const normalizedBody = (body || "").toString().trim();
        if (!normalizedBody) return;

        const message = {
          id: messageId,
          chat_id: Number(chatId),
          sender_id: Number(userId),
          client_message_id: null,
          reply_to_message_id: null,
          body: normalizedBody,
          image_url: null,
          seen: false,
          created_at: now,
          updated_at: null,
          deleted_for_everyone: false,
          deleted_by_user_id: null,
          deleted_at: null
        };

        await db.collection("messages").insertOne(message);
        await db.collection("chats").updateOne({ id: Number(chatId) }, { $set: { last_message_at: now } });

        participantIds.forEach((participantId) => {
          io.to(userRoom(participantId)).emit("receive_message", message);
        });
        notifyChatUpdated(io, participantIds, chatId);
      } catch {
        // ignore
      }
    });

    socket.on("call_offer", async ({ toUserId, offer, chatId, callType, mode }) => {
      const targetId = Number(toUserId);
      const selectedCallType = callType === "video" ? "video" : "voice";
      const selectedMode = mode === "video_chat" ? "video_chat" : "standard";
      const normalizedChatId = chatId ? Number(chatId) : null;

      if (!targetId || targetId === userId || !offer) return;
      const db = await getDb();
      const allowed = await usersAreConnectedByChat(db, userId, targetId, normalizedChatId);
      if (!allowed) {
        socket.emit("call_error", { message: "Call target not allowed" });
        return;
      }
      const blocked = await getDirectBlockState(db, userId, targetId);
      if (blocked.blockedByA) {
        socket.emit("call_error", { message: "You blocked this user. Unblock to call." });
        return;
      }
      if (blocked.blockedByB) {
        socket.emit("call_error", { message: "This user blocked you." });
        return;
      }

      const caller = await db.collection("users").findOne(
        { id: Number(userId) },
        { projection: { _id: 0, id: 1, name: 1, avatar_url: 1 } }
      );

      io.to(userRoom(targetId)).emit("call_offer", {
        fromUserId: userId,
        toUserId: targetId,
        fromUserName: caller?.name || "Unknown",
        fromUserAvatar: caller?.avatar_url || null,
        offer,
        chatId: normalizedChatId,
        callType: selectedCallType,
        mode: selectedMode
      });
    });

    socket.on("call_answer", async ({ toUserId, answer, chatId, callType, mode }) => {
      const targetId = Number(toUserId);
      const normalizedChatId = chatId ? Number(chatId) : null;
      const selectedMode = mode === "video_chat" ? "video_chat" : "standard";
      if (!targetId || !answer) return;

      const db = await getDb();
      const allowed = await usersAreConnectedByChat(db, userId, targetId, normalizedChatId);
      if (!allowed) return;
      const blocked = await getDirectBlockState(db, userId, targetId);
      if (blocked.blocked) return;

      io.to(userRoom(targetId)).emit("call_answer", {
        fromUserId: userId,
        toUserId: targetId,
        answer,
        chatId: normalizedChatId,
        callType: callType === "video" ? "video" : "voice",
        mode: selectedMode
      });
    });

    socket.on("call_ice_candidate", async ({ toUserId, candidate, chatId }) => {
      const targetId = Number(toUserId);
      const normalizedChatId = chatId ? Number(chatId) : null;
      if (!targetId || !candidate) return;

      const db = await getDb();
      const allowed = await usersAreConnectedByChat(db, userId, targetId, normalizedChatId);
      if (!allowed) return;
      const blocked = await getDirectBlockState(db, userId, targetId);
      if (blocked.blocked) return;

      io.to(userRoom(targetId)).emit("call_ice_candidate", {
        fromUserId: userId,
        toUserId: targetId,
        candidate,
        chatId: normalizedChatId
      });
    });

    socket.on("call_end", ({ toUserId, reason, chatId }) => {
      const targetId = Number(toUserId);
      if (!targetId) return;

      io.to(userRoom(targetId)).emit("call_end", {
        fromUserId: userId,
        toUserId: targetId,
        reason: reason || "ended",
        chatId: chatId ? Number(chatId) : null
      });
    });

    socket.on("call_reject", ({ toUserId, reason, chatId }) => {
      const targetId = Number(toUserId);
      if (!targetId) return;

      io.to(userRoom(targetId)).emit("call_reject", {
        fromUserId: userId,
        toUserId: targetId,
        reason: reason || "rejected",
        chatId: chatId ? Number(chatId) : null
      });
    });

    socket.on("watch_session_set", async ({ chatId, sourceUrl, title }) => {
      const normalizedChatId = Number(chatId);
      const normalizedSourceUrl = normalizeWatchUrl(sourceUrl);
      if (!normalizedChatId || !normalizedSourceUrl) {
        socket.emit("watch_error", { message: "Enter a valid video URL." });
        return;
      }

      const db = await getDb();
      const chat = await getChatMembership(db, normalizedChatId, userId);
      if (!chat) {
        socket.emit("watch_error", { message: "Chat access denied." });
        return;
      }

      if (chat.chat_type !== "group") {
        const peerId = directPeerId(chat, userId);
        const blocked = await getDirectBlockState(db, userId, peerId);
        if (blocked.blocked) {
          socket.emit("watch_error", { message: "Watch Together is unavailable in blocked chats." });
          return;
        }
      }

      const nextSession = {
        chatId: normalizedChatId,
        active: true,
        sourceUrl: normalizedSourceUrl,
        title: normalizeWatchTitle(title),
        position: 0,
        isPlaying: false,
        playbackRate: 1,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
      };

      watchSessions.set(normalizedChatId, nextSession);
      io.to(`chat_${normalizedChatId}`).emit("watch_session_state", nextSession);
    });

    socket.on("watch_session_clear", async ({ chatId }) => {
      const normalizedChatId = Number(chatId);
      if (!normalizedChatId) return;

      const db = await getDb();
      const chat = await getChatMembership(db, normalizedChatId, userId);
      if (!chat) return;

      if (chat.chat_type !== "group") {
        const peerId = directPeerId(chat, userId);
        const blocked = await getDirectBlockState(db, userId, peerId);
        if (blocked.blocked) return;
      }

      watchSessions.delete(normalizedChatId);
      io.to(`chat_${normalizedChatId}`).emit("watch_session_state", {
        chatId: normalizedChatId,
        active: false,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
      });
    });

    socket.on("watch_playback_sync", async ({ chatId, action, position, playbackRate, isPlaying }) => {
      const normalizedChatId = Number(chatId);
      const normalizedAction = ["play", "pause", "seek", "rate"].includes(action) ? action : "";
      if (!normalizedChatId || !normalizedAction) return;

      const db = await getDb();
      const chat = await getChatMembership(db, normalizedChatId, userId);
      if (!chat) return;

      if (chat.chat_type !== "group") {
        const peerId = directPeerId(chat, userId);
        const blocked = await getDirectBlockState(db, userId, peerId);
        if (blocked.blocked) return;
      }

      const existing = watchSessions.get(normalizedChatId);
      if (!existing?.active) return;

      const nextSession = {
        ...existing,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
      };
      const nextPosition = normalizeWatchPosition(position ?? existing.position);

      if (normalizedAction === "play") {
        nextSession.position = nextPosition;
        nextSession.isPlaying = true;
      } else if (normalizedAction === "pause") {
        nextSession.position = nextPosition;
        nextSession.isPlaying = false;
      } else if (normalizedAction === "seek") {
        nextSession.position = nextPosition;
        if (typeof isPlaying === "boolean") nextSession.isPlaying = isPlaying;
      } else if (normalizedAction === "rate") {
        nextSession.playbackRate = normalizeWatchRate(playbackRate ?? existing.playbackRate);
        nextSession.position = nextPosition;
        if (typeof isPlaying === "boolean") nextSession.isPlaying = isPlaying;
      }

      watchSessions.set(normalizedChatId, nextSession);

      socket.to(`chat_${normalizedChatId}`).emit("watch_playback_sync", {
        chatId: normalizedChatId,
        action: normalizedAction,
        position: nextSession.position,
        playbackRate: nextSession.playbackRate,
        isPlaying: nextSession.isPlaying,
        updatedBy: userId,
        updatedAt: nextSession.updatedAt
      });
    });

    socket.on("disconnect", async () => {
      const room = io.sockets.adapter.rooms.get(userRoom(userId));
      if (room && room.size > 0) return;

      try {
        const db = await getDb();
        const now = new Date();
        await db.collection("users").updateOne(
          { id: Number(userId) },
          { $set: { status: "offline", last_seen: now } }
        );
        io.emit("user_status", { userId, status: "offline", last_seen: now });
      } catch {
        // ignore
      }
    });
  });

  return io;
}
