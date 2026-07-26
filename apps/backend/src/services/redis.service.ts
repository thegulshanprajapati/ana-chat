import { createClient } from "redis";
import { Server } from "socket.io";
import { config } from "../config.js";

const client = createClient({ url: config.redisUrl });
let isConnected = false;

export async function connectRedis() {
  if (isConnected || !config.redisUrl) return;
  await client.connect();
  isConnected = true;
  console.log("[Redis] Connected to Redis.");
}

export async function enqueueOfflineMessage(userId: string, message: unknown) {
  if (!config.redisUrl) return;
  const key = `offline:messages:${userId}`;
  await client.rPush(key, JSON.stringify(message));
  await client.expire(key, config.offlineMessageTtlSeconds);
}

export async function deliverOfflineMessages(userId: string, io: Server) {
  if (!config.redisUrl) return;
  const key = `offline:messages:${userId}`;
  const messages = await client.lRange(key, 0, -1);
  if (!messages.length) return;

  for (const raw of messages) {
    const payload = JSON.parse(raw);
    io.to(`user:${userId}`).emit("message", payload);
  }

  await client.del(key);
}

export async function disconnectRedis() {
  if (!isConnected) return;
  await client.disconnect();
}
