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
import { parseE2EE, e2eeForUser } from "../models/Message.js";
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

router.get("/:chatId", requireUser, async (req, res) => {
  const chatId = Number(req.params.chatId);
  if (!chatId) return res.status(400).json({ message: "chatId required" });

  try {
    const db = await getDb();
    const chat = await getChatMembership(db, chatId, req.user.id);
    if (!chat) return res.status(403).json({ message: "Not chat participant" });

    const hiddenRows = await db.collection("message_user_state").find(
      { user_id: Number(req.user.id), chat_id: chatId, hidden_at: { $ne: null } },
      { projection: { _id: 0, message_id: 1 } }
    ).toArray();
    const hiddenIds = hiddenRows.map((row) => Number(row.message_id)).filter(Boolean);
    const filter = { chat_id: chatId };
    if (hiddenIds.length) filter.id = { $nin: hiddenIds };

    const rows = await db.collection("messages")
      .find(filter, { projection: { _id: 0 } })
      .sort({ created_at: 1, id: 1 })
      .limit(500)
      .toArray();

    const msgIds = rows.map((r) => String(r.id));
    const reactionsMap = {};
    const myReactionsMap = {};

    if (msgIds.length > 0) {
      try {
        const rxRes = await query(
          "SELECT message_id, user_id, reaction FROM message_reactions WHERE message_id = ANY($1)",
          [msgIds]
        );
        rxRes.rows.forEach((row) => {
          const mId = row.message_id;
          if (!reactionsMap[mId]) {
            reactionsMap[mId] = {};
          }
          reactionsMap[mId][row.reaction] = (reactionsMap[mId][row.reaction] || 0) + 1;
          if (Number(row.user_id) === Number(req.user.id)) {
            myReactionsMap[mId] = row.reaction;
          }
        });
      } catch (dbErr) {
        console.error("Failed to load message reactions from Postgres:", dbErr.message);
      }
    }

    res.json(rows.map((message) => ({
      ...message,
      e2ee: message.e2ee ? e2eeForUser(message.e2ee, req.user.id) : null,
      reactions: reactionsMap[String(message.id)] || {},
      my_reaction: myReactionsMap[String(message.id)] || null
    })));
  } catch (err) {
    console.error("Failed to load messages:", err);
    res.status(500).json({ message: "Failed to load messages" });
  }
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
    message_type: req.body.messageType || "text",
    poll_votes: req.body.messageType === "poll" ? {} : undefined,
    e2ee,
    seen: false,
    created_at: new Date().toISOString(),
    deleted_for_everyone: false
  };

  await db.collection("messages").updateOne(
    clientMessageId
      ? { client_message_id: clientMessageId, sender_id: Number(req.user.id) }
      : { id: messageId },
    {
      $setOnInsert: messagePayload
    },
    { upsert: true }
  );
  await db.collection("chats").updateOne(
    { id: chatId },
    { $set: { last_message_at: messagePayload.created_at, updated_at: new Date() } }
  );

  // Relay via Socket.IO
  const io = req.app.get("io");
  const participantIds = await getChatParticipantIds(db, chat);

  if (io) {
    for (const userId of participantIds) {
      const userRoom = `user_${userId}`;
      const socketsInRoom = io.sockets.adapter.rooms.get(userRoom);
      
      const specializedPayload = {
        ...messagePayload,
        e2ee: e2eeForUser(messagePayload.e2ee, userId)
      };

      if (socketsInRoom && socketsInRoom.size > 0) {
        // Recipient is online: Deliver immediately
        io.to(userRoom).emit("receive_message", specializedPayload);

        // Notify sender of delivery
        if (Number(userId) !== Number(req.user.id)) {
          io.to(`user_${req.user.id}`).emit("message_status_update", {
            messageId: messagePayload.id,
            chatId: chatId,
            status: "delivered",
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Recipient is offline: Save to temporary Redis offline queue (retained for 48h)
        const queueKey = `offline_queue:${userId}`;
        await redisClient.lPush(queueKey, JSON.stringify(specializedPayload));
        // Set expiry on queue
        await redisClient.set(`${queueKey}:expiry`, "1", { EX: 48 * 3600 });
      }
    }
    // Update chat active timestamps
    participantIds.forEach(uid => {
      io.to(`user_${uid}`).emit("chat_updated", { chatId });
    });
  }

  res.json({
    ...messagePayload,
    e2ee: e2eeForUser(messagePayload.e2ee, req.user.id)
  });
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
  const chatId = Number(req.body.chatId);
  const e2ee = parseE2EE(req.body?.e2ee);
  if (chatId) {
    try {
      const db = await getDb();
      const chat = await getChatMembership(db, chatId, req.user.id);
      if (!chat) return res.status(403).json({ message: "Not chat participant" });
      await db.collection("messages").updateOne(
        { id: messageId, chat_id: chatId, sender_id: Number(req.user.id) },
        { $set: { e2ee, edited_at: new Date().toISOString() } }
      );
    } catch (err) {
      console.error("Edit persist failed:", err);
    }
  }
  const io = req.app.get("io");
  if (io) {
    io.emit("message_updated", {
      id: messageId,
      chat_id: chatId,
      e2ee
    });
  }
  res.json({ success: true, message: { id: messageId, chat_id: chatId, e2ee } });
});

router.post("/:messageId/delete-for-everyone", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const chatId = Number(req.body.chatId);
  try {
    const db = await getDb();
    const message = await db.collection("messages").findOne(
      { id: messageId, chat_id: chatId },
      { projection: { _id: 0, sender_id: 1 } }
    );
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (Number(message.sender_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: "Only sender can delete this message for everyone" });
    }
    await db.collection("messages").updateOne(
      { id: messageId, chat_id: chatId },
      {
        $set: {
          body: null,
          image_url: null,
          e2ee: null,
          deleted_for_everyone: true,
          deleted_for_everyone_at: new Date().toISOString()
        }
      }
    );
    const chat = await getChatMembership(db, chatId, req.user.id);
    const participantIds = chat ? await getChatParticipantIds(db, chat) : [];
    const io = req.app.get("io");
    if (io) {
      participantIds.forEach((uid) => {
        io.to(`user_${uid}`).emit("chat_updated", { chatId });
      });
    }
  } catch (err) {
    console.error("Delete-for-everyone persist failed:", err);
    return res.status(500).json({ message: "Failed to delete message" });
  }
  const io = req.app.get("io");
  if (io) {
    io.emit("message_deleted_everyone", {
      messageId,
      chatId,
      deletedByUserId: req.user.id
    });
  }
  res.json({ success: true });
});

router.post("/:messageId/delete-for-me", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const chatId = Number(req.body?.chatId);
  if (messageId && chatId) {
    try {
      const db = await getDb();
      const chat = await getChatMembership(db, chatId, req.user.id);
      if (!chat) return res.status(403).json({ message: "Not chat participant" });
      const now = new Date();
      await db.collection("message_user_state").updateOne(
        { user_id: Number(req.user.id), message_id: messageId },
        {
          $set: { hidden_at: now, chat_id: chatId, updated_at: now },
          $setOnInsert: { user_id: Number(req.user.id), message_id: messageId, is_starred: false, created_at: now }
        },
        { upsert: true }
      );
    } catch (err) {
      console.error("Delete-for-me persist failed:", err);
      return res.status(500).json({ message: "Failed to delete message for you" });
    }
  }
  res.json({ success: true });
});

router.post("/:messageId/react", requireUser, async (req, res) => {
  const messageId = req.params.messageId;
  const { reaction, chatId } = req.body;
  const userId = req.user.id;

  if (!chatId) {
    return res.status(400).json({ message: "chatId is required" });
  }

  try {
    const db = await getDb();
    const chat = await getChatMembership(db, Number(chatId), userId);
    if (!chat) {
      return res.status(403).json({ message: "Not chat participant" });
    }

    if (!reaction) {
      await query(
        "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2",
        [messageId, Number(userId)]
      );
    } else {
      await query(
        `INSERT INTO message_reactions (message_id, user_id, reaction)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, user_id)
         DO UPDATE SET reaction = EXCLUDED.reaction`,
        [messageId, Number(userId), reaction]
      );
    }

    // Get all reactions for this message to build reactions summary object
    const rxRes = await query(
      "SELECT user_id, reaction FROM message_reactions WHERE message_id = $1",
      [messageId]
    );

    const reactions = {};
    rxRes.rows.forEach(row => {
      reactions[row.reaction] = (reactions[row.reaction] || 0) + 1;
    });

    // Get actual my_reaction from db
    const myRxRes = await query(
      "SELECT reaction FROM message_reactions WHERE message_id = $1 AND user_id = $2",
      [messageId, Number(userId)]
    );
    const my_reaction = myRxRes.rows.length > 0 ? myRxRes.rows[0].reaction : null;

    // Relay via Socket.IO to other participants
    const io = req.app.get("io");
    if (io) {
      const participantIds = await getChatParticipantIds(db, chat);
      participantIds.forEach(uid => {
        io.to(`user_${uid}`).emit("message_reaction", {
          messageId,
          chatId: Number(chatId),
          reactions
        });
      });
    }

    res.json({
      success: true,
      my_reaction,
      reactions
    });
  } catch (err) {
    console.error("Reaction failed:", err);
    res.status(500).json({ message: "Failed to process reaction: " + err.message });
  }
});

// Star / Unstar a message (stored locally per user in Postgres)
router.post("/:messageId/star", requireUser, async (req, res) => {
  const messageId = req.params.messageId;
  const starred = Boolean(req.body?.starred);
  const userId = Number(req.user.id);

  try {
    if (starred) {
      await query(
        `INSERT INTO starred_messages (message_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [messageId, userId]
      );
    } else {
      await query(
        "DELETE FROM starred_messages WHERE message_id = $1 AND user_id = $2",
        [messageId, userId]
      );
    }
    res.json({ success: true, starred });
  } catch (err) {
    console.error("Star failed:", err);
    res.status(500).json({ message: "Failed to star message: " + err.message });
  }
});

// Forward a message to another chat
router.post("/:messageId/forward", requireUser, async (req, res) => {
  const { targetChatId, keys } = req.body;
  const userId = req.user.id;

  if (!targetChatId) {
    return res.status(400).json({ message: "targetChatId is required" });
  }

  try {
    const db = await getDb();
    const chat = await getChatMembership(db, Number(targetChatId), userId);
    if (!chat) {
      return res.status(403).json({ message: "Not participant in target chat" });
    }

    const messageId = Date.now();
    const forwardPayload = {
      id: messageId,
      chat_id: Number(targetChatId),
      sender_id: Number(userId),
      sender_name: req.user.name || req.user.mobile || req.user.email || "User",
      body: null,
      image_url: null,
      forwarded: true,
      e2ee: keys ? { v: 1, alg: "RSA-OAEP-256/AES-GCM-256", keys, text: null, media: null } : null,
      seen: false,
      created_at: new Date().toISOString(),
      deleted_for_everyone: false
    };

    await db.collection("messages").insertOne(forwardPayload);
    await db.collection("chats").updateOne(
      { id: Number(targetChatId) },
      { $set: { last_message_at: forwardPayload.created_at, updated_at: new Date() } }
    );

    const io = req.app.get("io");
    if (io) {
      const participantIds = await getChatParticipantIds(db, chat);
      for (const uid of participantIds) {
        const userRoom = `user_${uid}`;
        const payload = {
          ...forwardPayload,
          e2ee: forwardPayload.e2ee ? e2eeForUser(forwardPayload.e2ee, uid) : null
        };
        io.to(userRoom).emit("receive_message", payload);
      }
      participantIds.forEach(uid => {
        io.to(`user_${uid}`).emit("chat_updated", { chatId: Number(targetChatId) });
      });
    }

    res.json({ success: true, messageId });
  } catch (err) {
    console.error("Forward failed:", err);
    res.status(500).json({ message: "Failed to forward message: " + err.message });
  }
});

// Vote on a poll message
router.post("/:messageId/vote", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const { optionIndex } = req.body;

  if (optionIndex === undefined) {
    return res.status(400).json({ message: "optionIndex is required" });
  }

  try {
    const db = await getDb();
    const message = await db.collection("messages").findOne({ id: messageId });
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const chat = await getChatMembership(db, message.chat_id, req.user.id);
    if (!chat) {
      return res.status(403).json({ message: "Not chat participant" });
    }

    await db.collection("messages").updateOne(
      { id: messageId },
      { $set: { [`poll_votes.${req.user.id}`]: optionIndex } }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`chat_${message.chat_id}`).emit("poll_vote_update", {
        messageId,
        userId: Number(req.user.id),
        optionIndex
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Poll vote failed:", err);
    res.status(500).json({ message: "Failed to vote: " + err.message });
  }
});

export default router;
