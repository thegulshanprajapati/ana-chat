import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { getDb, getNextSequence } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import {
  directPeerId,
  getChatMembership,
  getChatParticipantIds,
  getDirectBlockState,
  normalizeChatType
} from "../utils/chatDb.js";
import { e2eeForUser, parseE2EE } from "../models/Message.js";

const router = express.Router();
const MAX_MEDIA_SIZE = 50 * 1024 * 1024;
const uploadDir = path.resolve(process.cwd(), "src", "uploads");
const EDIT_WINDOW_MS = 10 * 60 * 1000;

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

// Encrypted uploads typically come as `application/octet-stream`, so don't restrict mimetypes here.
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
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Media file must be 50MB or less" });
    }
    return res.status(400).json({ message: err.message || "Media upload failed" });
  });
}

function getUploadedFile(req) {
  const media = req.files?.media?.[0];
  const image = req.files?.image?.[0];
  const video = req.files?.video?.[0];
  return media || image || video || null;
}

function normalizeReaction(value) {
  return (value || "").toString().trim().slice(0, 24);
}

function emitChatUpdated(io, chatId, userIds) {
  [...new Set(userIds.filter(Boolean))].forEach((userId) => {
    io.to(`user_${userId}`).emit("chat_updated", { chatId });
  });
}

function emitMessageToParticipants(io, chatId, userIds, event, payload) {
  [...new Set(userIds.filter(Boolean))].forEach((userId) => {
    io.to(`user_${userId}`).emit(event, payload);
  });
}

async function emitMessageToParticipantsPerUser(io, userIds, event, payloadFactory) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  await Promise.all(unique.map(async (userId) => {
    try {
      const payload = await payloadFactory(userId);
      if (payload) io.to(`user_${userId}`).emit(event, payload);
    } catch {
      // ignore per-recipient payload failures
    }
  }));
}

async function ensureChatAccess(db, chatId, userId) {
  const chat = await getChatMembership(db, chatId, userId);
  if (!chat) return { ok: false, chat: null, message: "Not chat participant" };

  const chatType = normalizeChatType(chat);
  if (chatType !== "group" && chatType !== "self") {
    const peerId = directPeerId(chat, userId);
    const blockState = await getDirectBlockState(db, userId, peerId);
    if (blockState.blockedByA) {
      return { ok: false, chat: null, message: "You blocked this user. Unblock to send messages." };
    }
    if (blockState.blockedByB) {
      return { ok: false, chat: null, message: "This user blocked you. Message cannot be sent." };
    }
  }

  return { ok: true, chat, message: "" };
}

function validateE2EEKeysForParticipants(e2ee, participantIds) {
  if (!e2ee) return { ok: false, message: "e2ee payload required" };
  if (!e2ee.keys || typeof e2ee.keys !== "object") {
    return { ok: false, message: "e2ee.keys required" };
  }
  for (const id of participantIds) {
    const key = e2ee.keys[String(id)];
    if (!key || typeof key !== "string") {
      return { ok: false, message: `Missing e2ee key for participant ${id}` };
    }
  }
  return { ok: true, message: "" };
}

async function getMessageEnhancements(db, messageIds, userId) {
  const uniqueIds = [...new Set((messageIds || []).map(Number).filter(Boolean))];
  const starredMap = new Map();
  const myReactionMap = new Map();
  const reactionsMap = new Map();
  if (!uniqueIds.length) return { starredMap, myReactionMap, reactionsMap };

  const [stateRows, myReactionRows, reactionRows] = await Promise.all([
    db.collection("message_user_state")
      .find({ user_id: Number(userId), message_id: { $in: uniqueIds } }, { projection: { _id: 0, message_id: 1, is_starred: 1 } })
      .toArray(),
    db.collection("message_reactions")
      .find({ user_id: Number(userId), message_id: { $in: uniqueIds } }, { projection: { _id: 0, message_id: 1, reaction: 1 } })
      .toArray(),
    db.collection("message_reactions")
      .aggregate([
        { $match: { message_id: { $in: uniqueIds } } },
        { $group: { _id: { message_id: "$message_id", reaction: "$reaction" }, count: { $sum: 1 } } }
      ])
      .toArray()
  ]);

  stateRows.forEach((row) => {
    starredMap.set(Number(row.message_id), Boolean(row.is_starred));
  });

  myReactionRows.forEach((row) => {
    myReactionMap.set(Number(row.message_id), row.reaction || null);
  });

  reactionRows.forEach((row) => {
    const messageId = Number(row._id?.message_id);
    const reaction = row._id?.reaction;
    if (!messageId || !reaction) return;
    const prev = reactionsMap.get(messageId) || {};
    prev[reaction] = Number(row.count);
    reactionsMap.set(messageId, prev);
  });

  return { starredMap, myReactionMap, reactionsMap };
}

async function hydrateMessagesForUser(db, docs, userId) {
  const list = Array.isArray(docs) ? docs : [];
  if (!list.length) return [];

  const enhancements = await getMessageEnhancements(db, list.map((doc) => doc.id), userId);

  const replyIds = [...new Set(list.map((doc) => Number(doc.reply_to_message_id)).filter(Boolean))];
  const replyDocs = replyIds.length
    ? await db.collection("messages").find({ id: { $in: replyIds } }, {
      projection: {
        _id: 0,
        id: 1,
        sender_id: 1,
        body: 1,
        image_url: 1,
        e2ee: 1,
        deleted_for_everyone: 1
      }
    }).toArray()
    : [];

  const replyMap = new Map(replyDocs.map((doc) => [Number(doc.id), doc]));
  const replySenderIds = [...new Set(replyDocs.map((doc) => Number(doc.sender_id)).filter(Boolean))];
  const replySenderRows = replySenderIds.length
    ? await db.collection("users").find({ id: { $in: replySenderIds } }, { projection: { _id: 0, id: 1, name: 1, email: 1, mobile: 1 } }).toArray()
    : [];
  const senderNameMap = new Map(replySenderRows.map((row) => [Number(row.id), row.name || row.mobile || row.email || "User"]));

  return list.map((doc) => {
    const reply = doc.reply_to_message_id ? (replyMap.get(Number(doc.reply_to_message_id)) || null) : null;

    return {
      id: doc.id,
      chat_id: doc.chat_id,
      sender_id: doc.sender_id,
      client_message_id: doc.client_message_id || null,
      body: doc.body || null, // legacy plaintext (pre-E2EE). New messages store body=null.
      image_url: doc.image_url || null, // encrypted blob filename for E2EE media
      reply_to_message_id: doc.reply_to_message_id || null,
      reply_to_sender_id: reply?.sender_id || null,
      reply_to_sender_name: reply?.sender_id ? (senderNameMap.get(Number(reply.sender_id)) || "User") : null,
      reply_to_body: reply?.body || null,
      reply_to_image_url: reply?.image_url || null,
      reply_to_deleted_for_everyone: Boolean(reply?.deleted_for_everyone),
      reply_to_e2ee: reply ? e2eeForUser(reply.e2ee, userId) : null,
      e2ee: e2eeForUser(doc.e2ee, userId),
      seen: Boolean(doc.seen),
      created_at: doc.created_at,
      updated_at: doc.updated_at || null,
      deleted_for_everyone: Boolean(doc.deleted_for_everyone),
      my_starred: enhancements.starredMap.get(Number(doc.id)) || false,
      my_reaction: enhancements.myReactionMap.get(Number(doc.id)) || null,
      reactions: enhancements.reactionsMap.get(Number(doc.id)) || {}
    };
  });
}

function buildRealtimePayloadBase(doc, reply, replySenderName) {
  return {
    id: doc.id,
    chat_id: doc.chat_id,
    sender_id: doc.sender_id,
    client_message_id: doc.client_message_id || null,
    body: doc.body || null, // legacy plaintext (pre-E2EE). New messages store body=null.
    image_url: doc.image_url || null, // encrypted blob filename for E2EE media
    reply_to_message_id: doc.reply_to_message_id || null,
    reply_to_sender_id: reply?.sender_id || null,
    reply_to_sender_name: reply?.sender_id ? (replySenderName || "User") : null,
    reply_to_body: reply?.body || null,
    reply_to_image_url: reply?.image_url || null,
    reply_to_deleted_for_everyone: Boolean(reply?.deleted_for_everyone),
    seen: Boolean(doc.seen),
    created_at: doc.created_at,
    updated_at: doc.updated_at || null,
    deleted_for_everyone: Boolean(doc.deleted_for_everyone),
    my_starred: false,
    my_reaction: null,
    reactions: {}
  };
}

function buildRealtimePayloadForUser(base, { doc, reply, userId }) {
  return {
    ...base,
    reply_to_e2ee: reply ? e2eeForUser(reply.e2ee, userId) : null,
    e2ee: e2eeForUser(doc.e2ee, userId)
  };
}

async function getMessageByIdForUser(db, messageId, userId) {
  const doc = await db.collection("messages").findOne({ id: Number(messageId) }, { projection: { _id: 0 } });
  if (!doc) return null;

  const chat = await getChatMembership(db, Number(doc.chat_id), userId);
  if (!chat) return null;

  const [payload] = await hydrateMessagesForUser(db, [doc], userId);
  return payload || null;
}

router.get("/:chatId", requireUser, async (req, res) => {
  const chatId = Number(req.params.chatId);
  if (!chatId) return res.status(400).json({ message: "chatId required" });

  const db = await getDb();
  const chat = await getChatMembership(db, chatId, req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });

  const hiddenRows = await db.collection("message_user_state").find({
    user_id: Number(req.user.id),
    hidden_at: { $ne: null },
    $or: [
      { chat_id: chatId },
      { chat_id: { $exists: false } }
    ]
  }, { projection: { _id: 0, message_id: 1 } }).toArray();
  const hiddenIds = hiddenRows.map((row) => Number(row.message_id)).filter(Boolean);

  const filter = { chat_id: chatId };
  if (hiddenIds.length) filter.id = { $nin: hiddenIds };

  const docs = await db.collection("messages").find(filter, { projection: { _id: 0 } })
    .sort({ created_at: 1, id: 1 })
    .toArray();

  const enriched = await hydrateMessagesForUser(db, docs, req.user.id);
  res.json(enriched);
});

async function sendMessageHandler(req, res) {
  const chatId = Number(req.body.chatId);
  const replyToMessageIdRaw = Number(req.body.replyToMessageId || req.body.reply_to_message_id || 0);
  const replyToMessageId = Number.isFinite(replyToMessageIdRaw) && replyToMessageIdRaw > 0
    ? replyToMessageIdRaw
    : null;
  const clientMessageIdRaw = (req.body.clientMessageId || req.body.client_message_id || "").toString().trim();
  const clientMessageId = clientMessageIdRaw ? clientMessageIdRaw.slice(0, 64) : null;
  const uploaded = getUploadedFile(req);

  const e2ee = parseE2EE(req.body?.e2ee);

  if (!chatId) return res.status(400).json({ message: "chatId required" });
  if (!e2ee) return res.status(400).json({ message: "e2ee payload required" });
  if (!e2ee.text && !uploaded) return res.status(400).json({ message: "Encrypted text or media required" });
  if (uploaded && !e2ee.media) return res.status(400).json({ message: "e2ee.media required for encrypted uploads" });

  const db = await getDb();
  const access = await ensureChatAccess(db, chatId, req.user.id);
  if (!access.ok) return res.status(403).json({ message: access.message });

  const participantIds = await getChatParticipantIds(db, access.chat);
  const keysOk = validateE2EEKeysForParticipants(e2ee, participantIds);
  if (!keysOk.ok) return res.status(400).json({ message: keysOk.message });

  let resolvedReplyToMessageId = null;
  if (replyToMessageId) {
    const replyTarget = await db.collection("messages").findOne(
      { id: Number(replyToMessageId), chat_id: chatId },
      { projection: { _id: 0, id: 1 } }
    );
    if (!replyTarget) {
      return res.status(400).json({ message: "Reply target not found in this chat" });
    }
    resolvedReplyToMessageId = Number(replyTarget.id);
  }

  if (clientMessageId) {
    const existing = await db.collection("messages").findOne(
      { chat_id: chatId, sender_id: Number(req.user.id), client_message_id: clientMessageId },
      { projection: { _id: 0, id: 1 } }
    );
    if (existing?.id) {
      const payload = await getMessageByIdForUser(db, existing.id, req.user.id);
      if (!payload) return res.status(500).json({ message: "Unable to load existing message" });
      return res.json(payload);
    }
  }

  const messageId = await getNextSequence("messages");
  const now = new Date();

  const doc = {
    id: messageId,
    chat_id: chatId,
    sender_id: Number(req.user.id),
    client_message_id: clientMessageId,
    reply_to_message_id: resolvedReplyToMessageId,
    body: null,
    image_url: uploaded ? uploaded.filename : null,
    e2ee,
    seen: false,
    created_at: now,
    updated_at: null,
    deleted_for_everyone: false,
    deleted_by_user_id: null,
    deleted_at: null
  };

  await db.collection("messages").insertOne(doc);
  await db.collection("chats").updateOne({ id: chatId }, { $set: { last_message_at: now } });

  const io = req.app.get("io");
  const participantIdsUnique = participantIds.length ? participantIds : await getChatParticipantIds(db, access.chat);
  const payload = await getMessageByIdForUser(db, messageId, req.user.id);
  if (!payload) return res.status(500).json({ message: "Unable to load sent message" });

  let reply = null;
  let replySenderName = null;
  if (resolvedReplyToMessageId) {
    reply = await db.collection("messages").findOne(
      { id: resolvedReplyToMessageId, chat_id: chatId },
      {
        projection: {
          _id: 0,
          id: 1,
          sender_id: 1,
          body: 1,
          image_url: 1,
          e2ee: 1,
          deleted_for_everyone: 1
        }
      }
    );
    if (reply?.sender_id) {
      const replySender = await db.collection("users").findOne(
        { id: Number(reply.sender_id) },
        { projection: { _id: 0, id: 1, name: 1, email: 1, mobile: 1 } }
      );
      replySenderName = replySender?.name || replySender?.mobile || replySender?.email || "User";
    }
  }

  const base = buildRealtimePayloadBase(doc, reply, replySenderName);
  await emitMessageToParticipantsPerUser(io, participantIdsUnique, "receive_message", (userId) => (
    buildRealtimePayloadForUser(base, { doc, reply, userId })
  ));
  emitChatUpdated(io, chatId, participantIdsUnique);

  return res.json(payload);
}

router.post("/", requireUser, mediaUpload, sendMessageHandler);

router.post("/send", requireUser, mediaUpload, async (req, res) => {
  req.body.body = req.body.body || req.body.message;
  return sendMessageHandler(req, res);
});

// Backward compatibility: socket already handles "seen", but keep HTTP endpoint for clients that use it.
router.patch("/:chatId/seen", requireUser, async (req, res) => {
  const chatId = Number(req.params.chatId);
  if (!chatId) return res.status(400).json({ message: "chatId required" });

  const db = await getDb();
  const chat = await getChatMembership(db, chatId, req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });

  await db.collection("messages").updateMany(
    { chat_id: chatId, sender_id: { $ne: Number(req.user.id) } },
    { $set: { seen: true } }
  );

  const io = req.app.get("io");
  io.to(`chat_${chatId}`).emit("seen", { chatId, userId: req.user.id });

  res.json({ success: true });
});

router.patch("/:messageId/edit", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  if (!messageId) return res.status(400).json({ message: "messageId required" });

  const e2ee = parseE2EE(req.body?.e2ee);
  if (!e2ee?.text) return res.status(400).json({ message: "e2ee.text required" });

  const db = await getDb();
  const message = await db.collection("messages").findOne({ id: messageId }, { projection: { _id: 0 } });
  if (!message) return res.status(404).json({ message: "Message not found" });

  const chat = await ensureChatAccess(db, Number(message.chat_id), req.user.id);
  if (!chat.ok) return res.status(403).json({ message: "Not chat participant" });
  if (Number(message.sender_id) !== Number(req.user.id)) {
    return res.status(403).json({ message: "You can edit only your own messages" });
  }
  if (message.deleted_for_everyone) {
    return res.status(400).json({ message: "Deleted message cannot be edited" });
  }
  if (message.image_url) {
    return res.status(400).json({ message: "Media messages cannot be edited" });
  }

  const createdAt = new Date(message.created_at).getTime();
  if (Number.isFinite(createdAt) && Date.now() - createdAt > EDIT_WINDOW_MS) {
    return res.status(400).json({ message: "Edit window expired (10 minutes)" });
  }

  const participantIds = await getChatParticipantIds(db, chat.chat);
  const keysOk = validateE2EEKeysForParticipants(e2ee, participantIds);
  if (!keysOk.ok) return res.status(400).json({ message: keysOk.message });

  const now = new Date();
  await db.collection("messages").updateOne(
    { id: messageId },
    { $set: { e2ee: { ...message.e2ee, ...e2ee, media: null }, updated_at: now } }
  );

  const payload = await getMessageByIdForUser(db, messageId, req.user.id);
  if (!payload) return res.status(500).json({ message: "Unable to load updated message" });

  const io = req.app.get("io");
  await emitMessageToParticipantsPerUser(io, participantIds, "message_updated", (userId) => (
    Number(userId) === Number(req.user.id)
      ? payload
      : getMessageByIdForUser(db, messageId, userId)
  ));
  emitChatUpdated(io, Number(message.chat_id), participantIds);

  res.json(payload);
});

router.post("/:messageId/delete-for-everyone", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  if (!messageId) return res.status(400).json({ message: "messageId required" });

  const db = await getDb();
  const message = await db.collection("messages").findOne({ id: messageId }, { projection: { _id: 0 } });
  if (!message) return res.status(404).json({ message: "Message not found" });

  const chat = await getChatMembership(db, Number(message.chat_id), req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });
  if (Number(message.sender_id) !== Number(req.user.id)) {
    return res.status(403).json({ message: "You can delete only your own messages" });
  }
  if (message.deleted_for_everyone) {
    return res.json({ success: true });
  }

  const now = new Date();
  await db.collection("messages").updateOne(
    { id: messageId },
    {
      $set: {
        body: null,
        image_url: null,
        e2ee: null,
        deleted_for_everyone: true,
        deleted_by_user_id: Number(req.user.id),
        deleted_at: now,
        updated_at: now
      }
    }
  );
  await db.collection("message_reactions").deleteMany({ message_id: messageId });

  const io = req.app.get("io");
  const participantIds = await getChatParticipantIds(db, chat);
  emitMessageToParticipants(io, Number(message.chat_id), participantIds, "message_deleted_everyone", {
    messageId,
    chatId: Number(message.chat_id),
    deletedByUserId: req.user.id
  });
  emitChatUpdated(io, Number(message.chat_id), participantIds);

  res.json({ success: true });
});

router.post("/:messageId/delete-for-me", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  if (!messageId) return res.status(400).json({ message: "messageId required" });

  const db = await getDb();
  const message = await db.collection("messages").findOne({ id: messageId }, { projection: { _id: 0, id: 1, chat_id: 1 } });
  if (!message) return res.status(404).json({ message: "Message not found" });

  const chat = await getChatMembership(db, Number(message.chat_id), req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });

  const now = new Date();
  await db.collection("message_user_state").updateOne(
    { user_id: Number(req.user.id), message_id: messageId },
    {
      $set: { hidden_at: now, chat_id: Number(message.chat_id), updated_at: now },
      $setOnInsert: { user_id: Number(req.user.id), message_id: messageId, is_starred: false, created_at: now }
    },
    { upsert: true }
  );

  res.json({ success: true });
});

router.post("/:messageId/star", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  if (!messageId) return res.status(400).json({ message: "messageId required" });

  const db = await getDb();
  const message = await db.collection("messages").findOne({ id: messageId }, { projection: { _id: 0, id: 1, chat_id: 1 } });
  if (!message) return res.status(404).json({ message: "Message not found" });

  const chat = await getChatMembership(db, Number(message.chat_id), req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });

  const current = await db.collection("message_user_state").findOne(
    { user_id: Number(req.user.id), message_id: messageId },
    { projection: { _id: 0, is_starred: 1 } }
  );

  const explicit = typeof req.body?.starred === "boolean" ? req.body.starred : null;
  const nextStarred = explicit == null ? !current?.is_starred : explicit;

  const now = new Date();
  await db.collection("message_user_state").updateOne(
    { user_id: Number(req.user.id), message_id: messageId },
    {
      $set: { is_starred: Boolean(nextStarred), hidden_at: null, chat_id: Number(message.chat_id), updated_at: now },
      $setOnInsert: { user_id: Number(req.user.id), message_id: messageId, created_at: now }
    },
    { upsert: true }
  );

  res.json({ success: true, starred: Boolean(nextStarred) });
});

router.post("/:messageId/react", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  if (!messageId) return res.status(400).json({ message: "messageId required" });

  const db = await getDb();
  const message = await db.collection("messages").findOne({ id: messageId }, { projection: { _id: 0, id: 1, chat_id: 1, deleted_for_everyone: 1 } });
  if (!message) return res.status(404).json({ message: "Message not found" });

  const chat = await getChatMembership(db, Number(message.chat_id), req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });
  if (message.deleted_for_everyone) {
    return res.status(400).json({ message: "Cannot react to deleted message" });
  }

  const reaction = normalizeReaction(req.body?.reaction);
  const now = new Date();

  if (!reaction) {
    await db.collection("message_reactions").deleteOne({ message_id: messageId, user_id: Number(req.user.id) });
  } else {
    await db.collection("message_reactions").updateOne(
      { message_id: messageId, user_id: Number(req.user.id) },
      { $set: { reaction, updated_at: now }, $setOnInsert: { message_id: messageId, user_id: Number(req.user.id), created_at: now } },
      { upsert: true }
    );
  }

  const reactionRows = await db.collection("message_reactions").aggregate([
    { $match: { message_id: messageId } },
    { $group: { _id: "$reaction", count: { $sum: 1 } } }
  ]).toArray();

  const reactions = {};
  reactionRows.forEach((row) => {
    if (row._id) reactions[row._id] = Number(row.count);
  });

  const myReactionDoc = await db.collection("message_reactions").findOne(
    { message_id: messageId, user_id: Number(req.user.id) },
    { projection: { _id: 0, reaction: 1 } }
  );
  const myReaction = myReactionDoc?.reaction || null;

  const io = req.app.get("io");
  const participantIds = await getChatParticipantIds(db, chat);
  emitMessageToParticipants(io, Number(message.chat_id), participantIds, "message_reaction", {
    messageId,
    chatId: Number(message.chat_id),
    reactions
  });

  res.json({ success: true, my_reaction: myReaction, reactions });
});

router.post("/:messageId/forward", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const targetChatId = Number(req.body?.targetChatId);
  const keys = req.body?.keys && typeof req.body.keys === "object" ? req.body.keys : null;

  if (!messageId) return res.status(400).json({ message: "messageId required" });
  if (!targetChatId) return res.status(400).json({ message: "targetChatId required" });
  if (!keys) return res.status(400).json({ message: "keys required (userId -> encryptedKey)" });

  const db = await getDb();
  const source = await db.collection("messages").findOne({ id: messageId }, { projection: { _id: 0 } });
  if (!source) return res.status(404).json({ message: "Message not found" });
  if (!source.e2ee) return res.status(400).json({ message: "Only encrypted messages can be forwarded" });

  const sourceChat = await getChatMembership(db, Number(source.chat_id), req.user.id);
  if (!sourceChat) return res.status(403).json({ message: "Not chat participant" });

  const targetAccess = await ensureChatAccess(db, targetChatId, req.user.id);
  if (!targetAccess.ok) return res.status(403).json({ message: targetAccess.message });

  const participantIds = await getChatParticipantIds(db, targetAccess.chat);
  const nextE2ee = parseE2EE({ ...source.e2ee, keys });
  const keysOk = validateE2EEKeysForParticipants(nextE2ee, participantIds);
  if (!keysOk.ok) return res.status(400).json({ message: keysOk.message });

  const newMessageId = await getNextSequence("messages");
  const now = new Date();

  const doc = {
    id: newMessageId,
    chat_id: targetChatId,
    sender_id: Number(req.user.id),
    client_message_id: null,
    reply_to_message_id: null,
    body: null,
    image_url: source.image_url || null,
    e2ee: nextE2ee,
    seen: false,
    created_at: now,
    updated_at: null,
    deleted_for_everyone: false,
    deleted_by_user_id: null,
    deleted_at: null
  };

  await db.collection("messages").insertOne(doc);
  await db.collection("chats").updateOne({ id: targetChatId }, { $set: { last_message_at: now } });

  const payload = await getMessageByIdForUser(db, newMessageId, req.user.id);
  if (!payload) return res.status(500).json({ message: "Unable to load forwarded message" });

  const io = req.app.get("io");
  const base = buildRealtimePayloadBase(doc, null, null);
  await emitMessageToParticipantsPerUser(io, participantIds, "receive_message", (userId) => (
    buildRealtimePayloadForUser(base, { doc, reply: null, userId })
  ));
  emitChatUpdated(io, targetChatId, participantIds);

  res.json(payload);
});

export default router;
