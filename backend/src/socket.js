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

// Connection monitoring
const connectionMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  totalDisconnects: 0,
  totalReconnects: 0,
  connectionErrors: 0
};

// Monitoring events storage (in production, this would go to a database)
const monitoringEvents = [];
const MAX_MONITORING_EVENTS = 1000;

function logMonitoringEvent(eventData) {
  monitoringEvents.unshift({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...eventData
  });

  // Keep only recent events
  if (monitoringEvents.length > MAX_MONITORING_EVENTS) {
    monitoringEvents.splice(MAX_MONITORING_EVENTS);
  }

  // Emit real-time dashboard updates for connected admin sockets.
  if (io) {
    io.to("admin_monitoring").emit("monitoring_update", eventData);
  }

  // In production, emit to admin dashboard
  console.log('[Monitoring]', eventData);
}

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
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;

  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[Socket.IO] Redis adapter enabled.");
    return { pubClient, subClient };
  } catch (error) {
    console.warn("[Socket.IO] Redis adapter disabled:", error.message);
    return null;
  }
}

let io = null; // Module-level io instance for monitoring

export async function initSocket(httpServer) {
  const clientOriginConfig = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || "https://chat.myana.site,https://www.chat.myana.site";
  const allowedOrigins = clientOriginConfig
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const originAllowed = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/[^/]+$/.test(origin)) return true;
    return false;
  };

  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (originAllowed(origin)) return callback(null, true);
        return callback(new Error("CORS blocked"));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    }
  });

  await createRedisAdapterIfConfigured(io);

  const watchSessions = new Map();

  io.use(async (socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie || "";
      const parsed = cookie.parse(rawCookie);
      const headerAuth = socket.handshake.headers.authorization || socket.handshake.headers.Authorization || "";
      const headerToken = headerAuth.startsWith("Bearer ") ? headerAuth.slice(7).trim() : null;
      const authToken = socket.handshake.auth?.token || parsed.access_token || headerToken;

      if (process.env.NODE_ENV !== "production") {
        console.debug("[Socket.IO] handshake auth check", {
          socketId: socket.id,
          origin: socket.handshake.headers.origin,
          authTokenPresent: Boolean(authToken),
          cookieKeys: Object.keys(parsed),
          authPayload: socket.handshake.auth
        });
      }

      if (!authToken) {
        connectionMetrics.connectionErrors++;
        return next(new Error("Unauthorized"));
      }

      const payload = verifyToken(authToken);
      if (payload.typ !== "access") {
        connectionMetrics.connectionErrors++;
        return next(new Error("Unauthorized"));
      }

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
        connectionMetrics.connectionErrors++;
        return next(new Error("Unauthorized"));
      }

      socket.userId = user.id;
      socket.sessionId = session.id;
      socket.userName = (user.name || "").toString().trim() || `User ${user.id}`;
      socket.userAvatar = user.avatar_url || null;
      socket.isAdmin = Boolean(user.is_admin);
      return next();
    } catch (err) {
      connectionMetrics.connectionErrors++;
      if (process.env.NODE_ENV !== "production") {
        console.debug("[Socket.IO] token verification failed", { error: err?.message });
      }
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    connectionMetrics.totalConnections++;
    connectionMetrics.activeConnections++;
    console.log("[Socket.IO] User connected:", { socketId: socket.id, userId: socket.userId, origin: socket.handshake.headers.origin });
    logMonitoringEvent({
      type: 'socket_connect',
      userId: socket.userId,
      socketId: socket.id,
      userAgent: socket.handshake.headers['user-agent'],
      ip: socket.handshake.address
    });

    const userId = socket.userId;
    socket.join(userRoom(userId));

    try {
      const db = await getDb();
      await db.collection("users").updateOne({ id: Number(userId) }, { $set: { status: "online" } });
      io.emit("user_status", { userId, status: "online", last_seen: null });
    } catch {
      // ignore status update failures
    }

    // Heartbeat handler
    socket.on('ping', (data) => {
      socket.emit('pong', data);
    });

    // Monitoring event handler
    socket.on('monitoring_event', (eventData) => {
      logMonitoringEvent({
        ...eventData,
        socketId: socket.id,
        userId: socket.userId
      });
    });

    socket.on('monitoring_subscribe', () => {
      if (!socket.isAdmin) return;
      socket.join('admin_monitoring');
      socket.emit('monitoring_subscribed', { success: true });
    });

    socket.on('monitoring_subscribe', () => {
      if (!socket.isAdmin) return;
      socket.join('admin_monitoring');
      socket.emit('monitoring_subscribed', { success: true });
    });

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

    socket.on("message_delivered", async ({ messageId, chatId }) => {
      if (!messageId || !chatId) return;
      const db = await getDb();

      try {
        const now = new Date();
        await db.collection("messages").updateOne(
          { id: Number(messageId), chat_id: Number(chatId), sender_id: Number(userId) },
          { $set: { delivery_status: 'delivered', delivered_at: now } }
        );

        // Notify sender that message was delivered
        io.to(userRoom(userId)).emit("message_status_update", {
          messageId,
          chatId,
          status: 'delivered',
          timestamp: now
        });
      } catch (error) {
        logMonitoringEvent({
          type: 'message_delivery_update_failed',
          userId,
          messageId,
          chatId,
          error: error.message
        });
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

      const now = new Date();
      try {
        // Get messages that will be marked as read
        const unreadMessages = await db.collection("messages").find({
          chat_id: Number(chatId),
          sender_id: { $ne: Number(userId) },
          delivery_status: { $ne: 'read' }
        }).toArray();

        // Update messages as read
        await db.collection("messages").updateMany(
          { chat_id: Number(chatId), sender_id: { $ne: Number(userId) } },
          { $set: { seen: true, delivery_status: 'read', read_at: now } }
        );

        // Emit read receipts for each message to all participants
        const participantIds = await getChatParticipantIds(db, chat);
        unreadMessages.forEach((message) => {
          participantIds.forEach((participantId) => {
            if (participantId !== userId) {
              io.to(userRoom(participantId)).emit("message_read", {
                messageId: message.id,
                chatId,
                userId,
                timestamp: now
              });
            }
          });
        });
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
          client_message_id: clientMessageId,
          reply_to_message_id: null,
          body: normalizedBody,
          image_url: null,
          seen: false,
          delivery_status: 'sent', // sent, delivered, read
          delivered_at: null,
          read_at: null,
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

        // Emit delivery status to sender - message is now delivered to recipients
        io.to(userRoom(userId)).emit("message_delivered", {
          messageId,
          chatId,
          status: 'delivered',
          timestamp: now
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
      connectionMetrics.activeConnections--;
      connectionMetrics.totalDisconnects++;
      logMonitoringEvent({
        type: 'socket_disconnect',
        userId: socket.userId,
        socketId: socket.id,
        reason: 'user_disconnect'
      });

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

  // Global connection error monitoring
  io.on('connection_error', (error) => {
    connectionMetrics.connectionErrors++;
    logMonitoringEvent({
      type: 'socket_connection_error',
      error: error.message,
      code: error.code,
      context: error.context
    });
  });

  return io;
}

// Export monitoring data for admin panel
export function getSocketMonitoringData() {
  return {
    connectionMetrics,
    recentEvents: monitoringEvents.slice(0, 100),
    activeSockets: io ? Array.from(io.sockets?.sockets || []).map(socket => ({
      id: socket.id,
      userId: socket.userId,
      connectedAt: socket.handshake.time,
      userAgent: socket.handshake.headers['user-agent']
    })) : []
  };
}
