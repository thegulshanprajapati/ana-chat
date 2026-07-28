import makeWASocket, { BufferJSON, initAuthCreds, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import { getDb } from "../db.js";

// Store active connections in memory to interact with them
const activeConnections = new Map();

export async function useMongoAuthState(userId) {
  const db = await getDb();
  // Store authentication credentials under 'whatsapp_sessions' collection for that user
  const collection = db.collection("whatsapp_sessions");

  const readData = async (type, id) => {
    const doc = await collection.findOne({ userId, type, id });
    if (!doc) return null;
    try {
      return JSON.parse(doc.data, BufferJSON.reviver);
    } catch (e) {
      console.error(`[WhatsApp Auth] Error parsing auth data for ${type}/${id}:`, e);
      return null;
    }
  };

  const writeData = async (type, id, value) => {
    if (value === null || value === undefined) {
      await collection.deleteOne({ userId, type, id });
    } else {
      const dataStr = JSON.stringify(value, BufferJSON.replacer);
      await collection.updateOne(
        { userId, type, id },
        { $set: { data: dataStr, updatedAt: new Date() } },
        { upsert: true }
      );
    }
  };

  let creds = await readData("creds", "session");
  if (!creds) {
    creds = initAuthCreds();
    await writeData("creds", "session", creds);
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(type, id);
              if (type === "app-state-sync-key" && value) {
                // Return value directly
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              tasks.push(writeData(category, id, value));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: async () => {
      await writeData("creds", "session", creds);
    },
    clearState: async () => {
      await collection.deleteMany({ userId });
    }
  };
}

export async function startWhatsAppSession(userId, onQRCallback, onConnectionCallback) {
  // If already active, close the existing one
  if (activeConnections.has(userId)) {
    try {
      const existing = activeConnections.get(userId);
      existing.sock.ev.removeAllListeners();
      existing.sock.end();
    } catch (e) {
      console.error("[WhatsApp] Error ending existing socket:", e);
    }
    activeConnections.delete(userId);
  }

  console.log(`[WhatsApp] Initializing session for user ${userId}...`);
  const { state, saveCreds, clearState } = await useMongoAuthState(userId);

  const sock = makeWASocket.default ? makeWASocket.default({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  }) : makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  });

  activeConnections.set(userId, { sock, qr: null, status: "connecting" });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`[WhatsApp] QR generated for user ${userId}`);
      try {
        const qrDataURL = await QRCode.toDataURL(qr);
        const conn = activeConnections.get(userId);
        if (conn) {
          conn.qr = qrDataURL;
          conn.status = "qr_ready";
        }
        onQRCallback?.(qrDataURL);
      } catch (err) {
        console.error("Error generating QR Data URL:", err);
      }
    }

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`[WhatsApp] Connection closed for user ${userId}. Reconnecting?`, shouldReconnect);
      
      const conn = activeConnections.get(userId);
      if (conn) {
        conn.status = "disconnected";
        conn.qr = null;
      }
      onConnectionCallback?.({ status: "disconnected", reason: lastDisconnect?.error?.message });

      if (shouldReconnect) {
        // Automatically restart session after brief delay
        setTimeout(() => {
          startWhatsAppSession(userId, onQRCallback, onConnectionCallback).catch(console.error);
        }, 5000);
      } else {
        await clearState();
        activeConnections.delete(userId);
      }
    } else if (connection === "open") {
      console.log(`[WhatsApp] Connected successfully for user ${userId}`);
      const conn = activeConnections.get(userId);
      if (conn) {
        conn.status = "connected";
        conn.qr = null;
      }
      onConnectionCallback?.({ status: "connected" });
    }
  });

  return sock;
}

export function getWhatsAppSession(userId) {
  return activeConnections.get(userId);
}

export async function disconnectWhatsAppSession(userId) {
  const conn = activeConnections.get(userId);
  if (conn) {
    try {
      conn.sock.logout();
    } catch (e) {
      console.error("[WhatsApp] Error during logout:", e);
    }
    const { clearState } = await useMongoAuthState(userId);
    await clearState();
    activeConnections.delete(userId);
  }
}
