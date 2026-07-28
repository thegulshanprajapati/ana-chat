import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { config } from "../config.js";
import { verifyToken } from "../services/auth.service.js";
import logger from "../shared/logger/index.js";
import { createClient } from "redis";
import { deliverOfflineMessages } from "../services/redis.service.js";

let io: Server;
let redisClient: ReturnType<typeof createClient>;

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

  // JWT Verification Middleware for Socket Connection
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
    const userId = socket.data.user?.userId;
    logger.info({ userId, socketId: socket.id }, "[Socket] Client connected");

    // Immediately join user room and set presence to online in Redis
    if (userId) {
      const userRoom = `user_${userId}`;
      socket.join(userRoom);
      
      // Instantly deliver queued offline messages
      deliverOfflineMessages(userId, io).catch((err) => logger.error(err, "[Socket] Failed to deliver offline messages"));

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
      // Legacy handshake event in case client triggers it
      if (payload?.userId) {
        socket.join(`user_${payload.userId}`);
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
