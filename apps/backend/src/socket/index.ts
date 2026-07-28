import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { config } from "../config.js";
import { verifyToken } from "../services/auth.service.js";
import logger from "../shared/logger/index.js";
import { createClient } from "redis";

let io: Server;
let redisClient: ReturnType<typeof createClient>;

export async function createSocketServer(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN?.split(",") || ["http://localhost:3000"],
      credentials: true
    },
    transports: ["websocket", "polling"],
    pingInterval: 15000, // 15-second heartbeat as recommended
    pingTimeout: 30000,
    allowEIO3: false
  });

  // Connect Redis client for presence and adapters
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
      socket.join(`user:${userId}`);
      if (redisClient) {
        redisClient.hSet(`presence:user:${userId}`, {
          status: "online",
          socketId: socket.id,
          lastSeen: new Date().toISOString()
        }).catch((err) => logger.error(err, "[Socket] Failed to set presence in Redis"));
        
        // Broadcast presence change
        socket.broadcast.emit("presence:update", { userId, status: "online" });
      }
    }

    // Typing timeout tracker
    let typingTimeout: NodeJS.Timeout | null = null;

    socket.on("message:send", async (message, ack) => {
      try {
        const targetRoom = `user:${message.recipientId}`;
        
        // Emitting socket event with exact status tracking
        io.to(targetRoom).emit("message:receive", {
          ...message,
          status: "SENT"
        });

        // Fire callback acknowledgement
        if (ack) ack({ success: true, messageId: message.messageId });
      } catch (err) {
        logger.error(err, "[Socket] Failed handling message:send");
      }
    });

    socket.on("typing:start", (payload) => {
      socket.to(`user:${payload.recipientId}`).emit("typing:start", payload);
      
      // Auto timeout typing indicator after 3 seconds
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.to(`user:${payload.recipientId}`).emit("typing:stop", payload);
      }, 3000);
    });

    socket.on("typing:stop", (payload) => {
      if (typingTimeout) clearTimeout(typingTimeout);
      socket.to(`user:${payload.recipientId}`).emit("typing:stop", payload);
    });

    socket.on("disconnect", () => {
      logger.info({ userId, socketId: socket.id }, "[Socket] Client disconnected");
      if (typingTimeout) clearTimeout(typingTimeout);

      if (userId && redisClient) {
        // Update presence status to offline
        const lastSeen = new Date().toISOString();
        redisClient.hSet(`presence:user:${userId}`, {
          status: "offline",
          lastSeen
        }).catch((err) => logger.error(err, "[Socket] Failed to clear presence"));

        socket.broadcast.emit("presence:update", { userId, status: "offline", lastSeen });
      }
    });
  });

  logger.info("[Socket] Socket.IO server initialized successfully.");
}

export function getSocketServer() {
  if (!io) throw new Error("Socket server is not initialized.");
  return io;
}
