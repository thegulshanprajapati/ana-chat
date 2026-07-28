import { createClient } from "redis";
import { Server } from "socket.io";
import { config } from "../config.js";
import logger from "../shared/logger/index.js";

const client = createClient({ url: config.redisUrl });
let isConnected = false;

export async function connectRedis() {
  if (isConnected || !config.redisUrl) return;
  await client.connect();
  isConnected = true;
  logger.info("[Redis] Connected to Redis.");
}

export async function enqueueOfflineMessage(userId: string, message: unknown) {
  if (!config.redisUrl) return;
  const key = `offline_queue:${userId}`;
  await client.rPush(key, JSON.stringify(message));
  await client.expire(key, config.offlineMessageTtlSeconds);
}

export async function deliverOfflineMessages(userId: string, io: Server) {
  if (!config.redisUrl) return;
  const key = `offline_queue:${userId}`;
  const messages = await client.lRange(key, 0, -1);
  if (!messages.length) return;

  logger.info({ userId, messageCount: messages.length }, "[Redis] Delivering offline messages");

  for (const raw of messages) {
    try {
      const payload = JSON.parse(raw);
      io.to(`user_${userId}`).emit("receive_message", payload);

      if (payload.sender_id && Number(payload.sender_id) !== Number(userId)) {
        io.to(`user_${payload.sender_id}`).emit("message_status_update", {
          messageId: payload.id,
          chatId: payload.chat_id,
          status: "delivered",
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      logger.error(err, "[Redis] Failed to parse offline message");
    }
  }

  await client.del(key);
}

export async function disconnectRedis() {
  if (!isConnected) return;
  await client.disconnect();
}
