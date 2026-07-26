import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createRedisAdapter, createClient } from "@socket.io/redis-adapter";
import { config } from "../config.js";
import { enqueueOfflineMessage, deliverOfflineMessages } from "../services/redis.service.js";

let io: Server;

export function createSocketServer(server: HttpServer) {
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
    const pubClient = createClient({ url: config.redisUrl });
    const subClient = pubClient.duplicate();
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createRedisAdapter(pubClient, subClient));
      console.log("[Socket] Redis adapter enabled.");
    }).catch((error) => console.warn("[Socket] Redis adapter failed:", error));
  }

  io.on("connection", (socket: Socket) => {
    console.log("[Socket] Connected", socket.id);

    socket.on("handshake", async (payload) => {
      if (payload?.userId) {
        socket.join(`user:${payload.userId}`);
        await deliverOfflineMessages(payload.userId, io);
      }
    });

    socket.on("message", async (message) => {
      const targetRoom = `user:${message.recipientId}`;
      const recipient = io.sockets.adapter.rooms.get(targetRoom);
      if (recipient?.size) {
        io.to(targetRoom).emit("message", message);
      } else {
        await enqueueOfflineMessage(message.recipientId, message);
      }
    });

    socket.on("typing", (payload) => {
      socket.to(`user:${payload.recipientId}`).emit("typing", payload);
    });

    socket.on("stopTyping", (payload) => {
      socket.to(`user:${payload.recipientId}`).emit("stopTyping", payload);
    });

    socket.on("presence", (payload) => {
      socket.to(`user:${payload.recipientId}`).emit("presence", payload);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected", socket.id);
    });
  });

  console.log("[Socket] Socket.IO initialized.");
}

export function getSocketServer() {
  if (!io) throw new Error("Socket server is not initialized.");
  return io;
}
