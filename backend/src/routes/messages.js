import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db.js";
import { query } from "../dbPostgres.js";
import { redisClient } from "../redis.js";
import { requireUser } from "../middleware/auth.js";
import {
  directPeerId,
  getChatMembership,
  getChatParticipantIds,
  getDirectBlockState
} from "../utils/chatDb.js";
import { parseE2EE } from "../models/Message.js";
import { v2 as cloudinary } from "cloudinary";
import { fileURLToPath } from "node:url";

if (process.env.CLOUDINARY_URL) {
  cloudinary.config();
}

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAX_MEDIA_SIZE = 50 * 1024 * 1024;
const uploadDir = path.resolve(__dirname, "..", "uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext || "";
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_MEDIA_SIZE }
});

function mediaUpload(req, res, next) {
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ])(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({ message: err.message || "Media upload failed" });
  });
}

function getUploadedFile(req) {
  return req.files?.media?.[0] || req.files?.image?.[0] || req.files?.video?.[0] || null;
}

// GET /messages/:chatId returns empty array as server doesn't store chat history permanently
router.get("/:chatId", requireUser, async (req, res) => {
  res.json([]);
});

// Backup APIs
router.post("/backup", requireUser, async (req, res) => {
  const { backupBlob, backupPinHash, salt, iv } = req.body;
  if (!backupBlob || !backupPinHash || !salt || !iv) {
    return res.status(400).json({ message: "Invalid backup payload" });
  }

  try {
    const size = Buffer.byteLength(backupBlob, "utf8");
    await query(
      `INSERT INTO backups (user_id, backup_blob, backup_pin_hash, salt, iv, last_backup_size)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         backup_blob = EXCLUDED.backup_blob,
         backup_pin_hash = EXCLUDED.backup_pin_hash,
         salt = EXCLUDED.salt,
         iv = EXCLUDED.iv,
         last_backup_at = CURRENT_TIMESTAMP,
         last_backup_size = EXCLUDED.last_backup_size`,
      [Number(req.user.id), backupBlob, backupPinHash, salt, iv, size]
    );

    res.json({ success: true, size, timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ message: "Failed to save backup: " + err.message });
  }
});

router.get("/backup/status", requireUser, async (req, res) => {
  try {
    const dbRes = await query("SELECT last_backup_at, last_backup_size, salt, iv FROM backups WHERE user_id = $1", [Number(req.user.id)]);
    if (dbRes.rows.length === 0) {
      return res.json({ hasBackup: false });
    }
    const row = dbRes.rows[0];
    res.json({
      hasBackup: true,
      lastBackupAt: row.last_backup_at,
      lastBackupSize: row.last_backup_size,
      salt: row.salt,
      iv: row.iv
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to get backup status" });
  }
});

router.get("/backup/download", requireUser, async (req, res) => {
  try {
    const dbRes = await query("SELECT backup_blob, backup_pin_hash, salt, iv FROM backups WHERE user_id = $1", [Number(req.user.id)]);
    if (dbRes.rows.length === 0) {
      return res.status(404).json({ message: "No backup found" });
    }
    const row = dbRes.rows[0];
    res.json({
      backupBlob: row.backup_blob,
      backupPinHash: row.backup_pin_hash,
      salt: row.salt,
      iv: row.iv
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to download backup" });
  }
});

router.delete("/backup", requireUser, async (req, res) => {
  try {
    await query("DELETE FROM backups WHERE user_id = $1", [Number(req.user.id)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete backup" });
  }
});

// Relay Outgoing Message
async function sendMessageHandler(req, res) {
  const chatId = Number(req.body.chatId);
  const replyToMessageId = Number(req.body.replyToMessageId || req.body.reply_to_message_id || 0) || null;
  const clientMessageId = (req.body.clientMessageId || req.body.client_message_id || "").toString().trim() || null;
  const uploaded = getUploadedFile(req);
  const e2ee = parseE2EE(req.body?.e2ee);

  if (!chatId) return res.status(400).json({ message: "chatId required" });
  if (!e2ee) return res.status(400).json({ message: "e2ee payload required" });

  const db = await getDb();
  const chat = await getChatMembership(db, chatId, req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });

  let imageUrl = null;
  if (uploaded) {
    if (process.env.CLOUDINARY_URL) {
      try {
        const uploadResult = await cloudinary.uploader.upload(uploaded.path, {
          folder: "anachat_attachments",
          resource_type: "raw"
        });
        imageUrl = uploadResult.secure_url;
        fs.unlink(uploaded.path, () => {});
      } catch (err) {
        imageUrl = uploaded.filename;
      }
    } else {
      imageUrl = `/api/uploads/${uploaded.filename}`;
    }
  }

  const messageId = Date.now();
  const messagePayload = {
    id: messageId,
    chat_id: chatId,
    sender_id: Number(req.user.id),
    sender_name: req.user.name || req.user.mobile || req.user.email || "User",
    client_message_id: clientMessageId,
    body: null,
    image_url: imageUrl,
    reply_to_message_id: replyToMessageId,
    e2ee,
    seen: false,
    created_at: new Date().toISOString(),
    deleted_for_everyone: false
  };

  // Relay via Socket.IO
  const io = req.app.get("io");
  const participantIds = await getChatParticipantIds(db, chat);

  if (io) {
    for (const userId of participantIds) {
      const userRoom = `user_${userId}`;
      const socketsInRoom = io.sockets.adapter.rooms.get(userRoom);
      
      if (socketsInRoom && socketsInRoom.size > 0) {
        // Recipient is online: Deliver immediately
        io.to(userRoom).emit("receive_message", messagePayload);
      } else {
        // Recipient is offline: Save to temporary Redis offline queue (retained for 48h)
        const queueKey = `offline_queue:${userId}`;
        await redisClient.lPush(queueKey, JSON.stringify(messagePayload));
        // Set expiry on queue
        await redisClient.set(`${queueKey}:expiry`, "1", { EX: 48 * 3600 });
      }
    }
    // Update chat active timestamps
    participantIds.forEach(uid => {
      io.to(`user_${uid}`).emit("chat_updated", { chatId });
    });
  }

  res.json(messagePayload);
}

router.post("/", requireUser, mediaUpload, sendMessageHandler);
router.post("/send", requireUser, mediaUpload, sendMessageHandler);

// Seen, Star, Edit, Delete are relayed via Socket.IO for real-time synchronization, without database writes.
router.patch("/:chatId/seen", requireUser, async (req, res) => {
  const chatId = Number(req.params.chatId);
  const io = req.app.get("io");
  if (io) io.to(`chat_${chatId}`).emit("seen", { chatId, userId: req.user.id });
  res.json({ success: true });
});

router.patch("/:messageId/edit", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const io = req.app.get("io");
  if (io) {
    io.emit("message_updated", {
      id: messageId,
      chat_id: Number(req.body.chatId),
      e2ee: parseE2EE(req.body?.e2ee)
    });
  }
  res.json({ success: true });
});

router.post("/:messageId/delete-for-everyone", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const io = req.app.get("io");
  if (io) {
    io.emit("message_deleted_everyone", {
      messageId,
      chatId: Number(req.body.chatId),
      deletedByUserId: req.user.id
    });
  }
  res.json({ success: true });
});

router.post("/:messageId/delete-for-me", requireUser, async (req, res) => {
  res.json({ success: true });
});

export default router;
