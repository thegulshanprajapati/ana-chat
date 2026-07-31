import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import mongoose from "mongoose";
import { config } from "../config.js";
import { verifyToken } from "../services/auth.service.js";
import logger from "../shared/logger/index.js";
import { createClient } from "redis";
import { deliverOfflineMessages } from "../services/redis.service.js";
import {
  directPeerId,
  getChatMembership,
  getChatParticipantIds,
  getDirectBlockState,
  usersAreConnectedByChat
} from "../shared/utils/chatDb.js";

let io: Server;
let redisClient: ReturnType<typeof createClient>;
const watchSessions = new Map<number, any>();

function normalizeWatchUrl(rawUrl: any): string {
  const value = (rawUrl || "").toString().trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  return "";
}

function normalizeWatchTitle(rawTitle: any): string {
  return (rawTitle || "").toString().trim().slice(0, 80);
}

function normalizeWatchPosition(rawPosition: any): number {
  const value = Number(rawPosition);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 1000) / 1000;
}

function normalizeWatchRate(rawRate: any): number {
  const value = Number(rawRate);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.25, Math.min(2, Math.round(value * 100) / 100));
}

export async function createSocketServer(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN?.split(",") || ["http://localhost:3000"],
      credentials: true
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 60000,
    allowEIO3: false
  });

  if (config.redisUrl) {
    try {
      redisClient = createClient({ url: config.redisUrl });
      await redisClient.connect();
      
      const pubClient = createClient({ url: config.redisUrl });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      
      io.adapter(createAdapter(pubClient, subClient));
      logger.info("[Socket] Redis adapter and presence client enabled.");
    } catch (error) {
      logger.error(error, "[Socket] Redis initialization failed");
    }
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error("Authentication required."));
      }

      const payload = await verifyToken(token) as { userId: string; isAdmin?: boolean };
      if (!payload?.userId) {
        return next(new Error("Invalid token payload."));
      }

      socket.data.user = payload;
      next();
    } catch (err) {
      logger.warn({ err }, "[Socket] Handshake unauthorized");
      next(new Error("Authentication failed."));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = Number(socket.data.user?.userId);
    logger.info({ userId, socketId: socket.id }, "[Socket] Client connected");

    if (userId) {
      const userRoom = `user_${userId}`;
      socket.join(userRoom);
      
      deliverOfflineMessages(String(userId), io).catch((err) => logger.error(err, "[Socket] Failed to deliver offline messages"));

      if (redisClient) {
        redisClient.hSet(`presence:user:${userId}`, {
          status: "online",
          socketId: socket.id,
          lastSeen: new Date().toISOString()
        }).catch((err) => logger.error(err, "[Socket] Failed to set presence in Redis"));
        
        socket.broadcast.emit("user_status", { userId, status: "online" });
      }
    }

    socket.on("handshake", async (payload) => {
      if (payload?.userId) {
        socket.join(`user_${payload.userId}`);
      }
    });

    socket.on("join_room", async (chatId) => {
      const normalizedChatId = Number(chatId);
      if (!normalizedChatId || !userId) return;
      const db = mongoose.connection.db;
      if (!db) return;
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

    socket.on("leave_room", async (chatId) => {
      const normalizedChatId = Number(chatId);
      if (!normalizedChatId) return;
      socket.leave(`chat_${normalizedChatId}`);
    });

    socket.on("message_delivered", async ({ messageId, chatId }) => {
      if (!messageId || !chatId || !userId) return;
      const db = mongoose.connection.db;
      if (!db) return;

      try {
        const now = new Date();
        await db.collection("messages").updateOne(
          { id: Number(messageId), chat_id: Number(chatId), sender_id: Number(userId) },
          { $set: { delivery_status: 'delivered', delivered_at: now } }
        );

        io.to(`user_${userId}`).emit("message_status_update", {
          messageId,
          chatId,
          status: 'delivered',
          timestamp: now
        });
      } catch (error: any) {
        logger.error(error, "[Socket] Failed to update message_delivered status");
      }
    });

    socket.on("seen", async ({ chatId }) => {
      if (!chatId || !userId) return;
      const db = mongoose.connection.db;
      if (!db) return;

      const chat = await getChatMembership(db, Number(chatId), userId);
      if (!chat) return;

      if (chat.chat_type !== "group") {
        const peerId = directPeerId(chat, userId);
        if (peerId) {
          const blocked = await getDirectBlockState(db, userId, peerId);
          if (blocked.blocked) return;
        }
      }

      const now = new Date();
      try {
        // Broadcast seen directly to other room participants
        socket.to(`chat_${chatId}`).emit("seen", { chatId });

        const unreadMessages = await db.collection("messages").find({
          chat_id: Number(chatId),
          sender_id: { $ne: Number(userId) },
          delivery_status: { $ne: 'read' }
        }).toArray();

        await db.collection("messages").updateMany(
          { chat_id: Number(chatId), sender_id: { $ne: Number(userId) } },
          { $set: { seen: true, delivery_status: 'read', read_at: now } }
        );

        const participantIds = await getChatParticipantIds(db, chat);
        unreadMessages.forEach((message) => {
          participantIds.forEach((participantId) => {
            if (participantId !== userId) {
              io.to(`user_${participantId}`).emit("message_read", {
                messageId: message.id,
                chatId,
                userId,
                timestamp: now
              });
            }
          });
        });
      } catch (err) {
        logger.error(err, "[Socket] Failed to handle seen status event");
      }
    });

    socket.on("vote_poll", async ({ messageId, chatId, optionIndex }) => {
      if (!messageId || !chatId || !userId) return;
      const db = mongoose.connection.db;
      if (!db) return;

      try {
        await db.collection("messages").updateOne(
          { id: Number(messageId) },
          { $set: { [`poll_votes.${userId}`]: optionIndex } }
        );

        io.to(`chat_${chatId}`).emit("poll_vote_update", {
          messageId,
          userId,
          optionIndex
        });
      } catch (err: any) {
        logger.error(err, "[Socket] Failed to vote on poll");
      }
    });

    socket.on("typing", (payload) => {
      socket.to(`user_${payload.recipientId}`).emit("typing", payload);
    });

    socket.on("stopTyping", (payload) => {
      socket.to(`user_${payload.recipientId}`).emit("stopTyping", payload);
    });

    socket.on("presence", (payload) => {
      socket.to(`user_${payload.recipientId}`).emit("presence", payload);
    });

    // WebRTC Calling Event Listeners
    socket.on("call_offer", async ({ toUserId, offer, chatId, callType, mode }) => {
      const targetId = Number(toUserId);
      const selectedCallType = callType === "video" ? "video" : "voice";
      const selectedMode = mode === "video_chat" ? "video_chat" : "standard";
      const normalizedChatId = chatId ? Number(chatId) : null;

      if (!targetId || targetId === userId || !offer) return;
      const db = mongoose.connection.db;
      if (!db) return;

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

      io.to(`user_${targetId}`).emit("call_offer", {
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

      const db = mongoose.connection.db;
      if (!db) return;
      const allowed = await usersAreConnectedByChat(db, userId, targetId, normalizedChatId);
      if (!allowed) return;

      io.to(`user_${targetId}`).emit("call_answer", {
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

      const db = mongoose.connection.db;
      if (!db) return;
      const allowed = await usersAreConnectedByChat(db, userId, targetId, normalizedChatId);
      if (!allowed) return;

      io.to(`user_${targetId}`).emit("call_ice_candidate", {
        fromUserId: userId,
        toUserId: targetId,
        candidate,
        chatId: normalizedChatId
      });
    });

    socket.on("call_end", ({ toUserId, reason, chatId }) => {
      const targetId = Number(toUserId);
      if (!targetId) return;

      io.to(`user_${targetId}`).emit("call_end", {
        fromUserId: userId,
        toUserId: targetId,
        reason: reason || "ended",
        chatId: chatId ? Number(chatId) : null
      });
    });

    socket.on("call_reject", ({ toUserId, reason, chatId }) => {
      const targetId = Number(toUserId);
      if (!targetId) return;

      io.to(`user_${targetId}`).emit("call_reject", {
        fromUserId: userId,
        toUserId: targetId,
        reason: reason || "rejected",
        chatId: chatId ? Number(chatId) : null
      });
    });

    // Watch Together event listeners
    socket.on("watch_session_set", async ({ chatId, sourceUrl, title }) => {
      const normalizedChatId = Number(chatId);
      const normalizedSourceUrl = normalizeWatchUrl(sourceUrl);
      if (!normalizedChatId || !normalizedSourceUrl) {
        socket.emit("watch_error", { message: "Enter a valid video URL." });
        return;
      }

      const db = mongoose.connection.db;
      if (!db) return;
      const chat = await getChatMembership(db, normalizedChatId, userId);
      if (!chat) {
        socket.emit("watch_error", { message: "Chat access denied." });
        return;
      }

      if (chat.chat_type !== "group") {
        const peerId = directPeerId(chat, userId);
        if (peerId) {
          const blocked = await getDirectBlockState(db, userId, peerId);
          if (blocked.blocked) {
            socket.emit("watch_error", { message: "Watch Together is unavailable in blocked chats." });
            return;
          }
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

      const db = mongoose.connection.db;
      if (!db) return;
      const chat = await getChatMembership(db, normalizedChatId, userId);
      if (!chat) return;

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

      const db = mongoose.connection.db;
      if (!db) return;
      const chat = await getChatMembership(db, normalizedChatId, userId);
      if (!chat) return;

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

    socket.on("disconnect", () => {
      logger.info({ userId, socketId: socket.id }, "[Socket] Client disconnected");

      if (userId && redisClient) {
        const lastSeen = new Date().toISOString();
        redisClient.hSet(`presence:user:${userId}`, {
          status: "offline",
          lastSeen
        }).catch((err) => logger.error(err, "[Socket] Failed to clear presence"));

        socket.broadcast.emit("user_status", { userId, status: "offline", lastSeen });
      }
    });
  });

  logger.info("[Socket] Socket.IO server initialized successfully.");
}

export function getSocketServer() {
  if (!io) throw new Error("Socket server is not initialized.");
  return io;
}
