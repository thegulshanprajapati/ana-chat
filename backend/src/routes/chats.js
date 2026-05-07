import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import bcrypt from "bcryptjs";
import { getDb, getNextSequence } from "../db.js";
import { e2eeForUser } from "../models/Message.js";
import {
  getChatMembership,
  getChatParticipantIds,
  getDirectBlockState,
  normalizeChatType
} from "../utils/chatDb.js";
import { requireUser } from "../middleware/auth.js";

const router = express.Router();
const MAX_BACKGROUND_SIZE = 8 * 1024 * 1024;
const ALLOWED_BG_PRESETS = new Set([
  "ocean",
  "sunset",
  "midnight",
  "mint",
  "rose",
  "graphite"
]);
const CHAT_PIN_PATTERN = /^\d{4,8}$/;
const uploadDir = path.resolve(process.cwd(), "src", "uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const bgStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || ""}`);
  }
});

const bgUpload = multer({
  storage: bgStorage,
  limits: { fileSize: MAX_BACKGROUND_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Background must be an image"));
    }
    return cb(null, true);
  }
});

function chatBackgroundUpload(req, res, next) {
  bgUpload.single("background")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Background image must be 8MB or less" });
    }
    return res.status(400).json({ message: err.message || "Background upload failed" });
  });
}

function emitChatUpdated(req, userIds, chatId) {
  const io = req.app.get("io");
  [...new Set(userIds.filter(Boolean))].forEach((id) => {
    io.to(`user_${id}`).emit("chat_updated", { chatId });
  });
}

function normalizeChatPin(value) {
  return (value || "").toString().trim();
}

async function ensureLockerChat(userId) {
  const numericUserId = Number(userId);
  if (!numericUserId) return null;

  const db = await getDb();
  const now = new Date();

  const existing = await db.collection("chats").findOne(
    { chat_type: "self", user1_id: numericUserId, user2_id: numericUserId },
    { projection: { _id: 0, id: 1 } }
  );

  let chatId = existing?.id ? Number(existing.id) : null;
  if (!chatId) {
    chatId = await getNextSequence("chats");
    await db.collection("chats").insertOne({
      id: chatId,
      user1_id: numericUserId,
      user2_id: numericUserId,
      chat_type: "self",
      group_name: "AnaLocker",
      group_avatar_url: "/logo.png",
      chat_background_url: null,
      created_by_user_id: numericUserId,
      last_message_at: null,
      created_at: now,
      updated_at: now
    });
  } else {
    await db.collection("chats").updateOne(
      { id: chatId },
      {
        $set: {
          chat_type: "self",
          group_name: "AnaLocker",
          group_avatar_url: "/logo.png",
          updated_at: now
        }
      }
    );
  }

  await db.collection("chat_members").updateOne(
    { chat_id: chatId, user_id: numericUserId },
    {
      $set: { role: "member" },
      $setOnInsert: {
        chat_id: chatId,
        user_id: numericUserId,
        joined_at: now,
        created_at: now
      }
    },
    { upsert: true }
  );

  return chatId;
}

async function verifyOrCreateChatPin(userId, pin) {
  const normalizedPin = normalizeChatPin(pin);
  if (!CHAT_PIN_PATTERN.test(normalizedPin)) {
    return { ok: false, message: "PIN must be 4 to 8 digits" };
  }

  const db = await getDb();
  const numericUserId = Number(userId);

  const row = await db.collection("user_chat_pin_settings").findOne(
    { user_id: numericUserId },
    { projection: { _id: 0, pin_hash: 1 } }
  );
  if (!row) {
    const pinHash = await bcrypt.hash(normalizedPin, 10);
    const now = new Date();
    await db.collection("user_chat_pin_settings").insertOne({
      user_id: numericUserId,
      pin_hash: pinHash,
      created_at: now,
      updated_at: now
    });
    return { ok: true, created: true };
  }

  const valid = await bcrypt.compare(normalizedPin, row.pin_hash);
  if (!valid) return { ok: false, message: "Invalid chat PIN" };
  return { ok: true, created: false };
}

async function verifyExistingChatPin(userId, pin) {
  const normalizedPin = normalizeChatPin(pin);
  if (!CHAT_PIN_PATTERN.test(normalizedPin)) {
    return { ok: false, message: "PIN must be 4 to 8 digits" };
  }

  const db = await getDb();
  const numericUserId = Number(userId);
  const row = await db.collection("user_chat_pin_settings").findOne(
    { user_id: numericUserId },
    { projection: { _id: 0, pin_hash: 1 } }
  );
  if (!row) return { ok: false, message: "PIN is not set. Hide a chat first to set PIN." };

  const valid = await bcrypt.compare(normalizedPin, row.pin_hash);
  if (!valid) return { ok: false, message: "Invalid chat PIN" };
  return { ok: true };
}

async function getUserChats(userId, options = {}) {
  const { includeHidden = false, onlyHidden = false } = options;
  const me = Number(userId);
  if (!me) return [];

  const db = await getDb();
  await ensureLockerChat(me);

  const [hiddenRows, membershipRows, meUser] = await Promise.all([
    db.collection("user_hidden_chats")
      .find({ user_id: me }, { projection: { _id: 0, chat_id: 1 } })
      .toArray(),
    db.collection("chat_members")
      .find({ user_id: me }, { projection: { _id: 0, chat_id: 1 } })
      .toArray(),
    db.collection("users").findOne(
      { id: me },
      {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          email: 1,
          mobile: 1,
          about_bio: 1,
          avatar_url: 1,
          status: 1,
          last_seen: 1
        }
      }
    )
  ]);

  const hiddenIds = new Set(hiddenRows.map((row) => Number(row.chat_id)).filter(Boolean));
  let chatIds = [...new Set(membershipRows.map((row) => Number(row.chat_id)).filter(Boolean))];

  if (onlyHidden) {
    chatIds = chatIds.filter((id) => hiddenIds.has(id));
  } else if (!includeHidden) {
    chatIds = chatIds.filter((id) => !hiddenIds.has(id));
  }

  if (!chatIds.length) return [];

  const chats = await db.collection("chats").find(
    { id: { $in: chatIds } },
    {
      projection: {
        _id: 0,
        id: 1,
        user1_id: 1,
        user2_id: 1,
        chat_type: 1,
        group_name: 1,
        group_avatar_url: 1,
        chat_background_url: 1,
        created_by_user_id: 1,
        last_message_at: 1
      }
    }
  ).toArray();

  const [lastMessageRows, memberCountRows] = await Promise.all([
    db.collection("messages").aggregate([
      { $match: { chat_id: { $in: chatIds } } },
      { $sort: { created_at: -1, id: -1 } },
      {
        $group: {
          _id: "$chat_id",
          body: { $first: "$body" },
          image_url: { $first: "$image_url" },
          e2ee: { $first: "$e2ee" },
          created_at: { $first: "$created_at" }
        }
      }
    ]).toArray(),
    db.collection("chat_members").aggregate([
      { $match: { chat_id: { $in: chatIds } } },
      { $group: { _id: "$chat_id", member_count: { $sum: 1 } } }
    ]).toArray()
  ]);

  const lastMessageMap = new Map(lastMessageRows.map((row) => [Number(row._id), row]));
  const memberCountMap = new Map(memberCountRows.map((row) => [Number(row._id), Number(row.member_count)]));

  const otherUserIds = [
    ...new Set(chats
      .filter((chat) => normalizeChatType(chat) === "direct")
      .map((chat) => (Number(chat.user1_id) === me ? Number(chat.user2_id) : Number(chat.user1_id)))
      .filter((id) => id && id !== me))
  ];

  const [otherUsers, blockRows] = await Promise.all([
    otherUserIds.length
      ? db.collection("users").find(
        { id: { $in: otherUserIds } },
        {
          projection: {
            _id: 0,
            id: 1,
            name: 1,
            email: 1,
            mobile: 1,
            about_bio: 1,
            avatar_url: 1,
            status: 1,
            last_seen: 1
          }
        }
      ).toArray()
      : Promise.resolve([]),
    otherUserIds.length
      ? db.collection("user_blocks").find(
        {
          $or: [
            { blocker_user_id: me, blocked_user_id: { $in: otherUserIds } },
            { blocker_user_id: { $in: otherUserIds }, blocked_user_id: me }
          ]
        },
        { projection: { _id: 0, blocker_user_id: 1, blocked_user_id: 1 } }
      ).toArray()
      : Promise.resolve([])
  ]);

  const otherUserMap = new Map(otherUsers.map((user) => [Number(user.id), user]));

  const blockedByMeSet = new Set(
    blockRows.filter((row) => Number(row.blocker_user_id) === me).map((row) => Number(row.blocked_user_id))
  );
  const blockedMeSet = new Set(
    blockRows.filter((row) => Number(row.blocked_user_id) === me).map((row) => Number(row.blocker_user_id))
  );

  const rows = chats.map((chat) => {
    const chatId = Number(chat.id);
    const chatType = normalizeChatType(chat);
    const last = lastMessageMap.get(chatId);
    const isHidden = hiddenIds.has(chatId);

    const base = {
      id: chatId,
      user1_id: Number(chat.user1_id) || null,
      user2_id: Number(chat.user2_id) || null,
      last_message_at: chat.last_message_at || null,
      chat_type: chatType,
      group_name: chat.group_name || null,
      group_avatar_url: chat.group_avatar_url || null,
      chat_background_url: chat.chat_background_url || null,
      created_by_user_id: chat.created_by_user_id || null,
      member_count: chatType === "group"
        ? (memberCountMap.get(chatId) || 0)
        : (chatType === "self" ? 1 : 2),
      is_hidden: isHidden ? 1 : 0,
      last_message_body: last?.body ?? null,
      last_message_image: last?.image_url ?? null,
      last_message_created_at: last?.created_at ?? null,
      last_message_e2ee: last?.e2ee ? e2eeForUser(last.e2ee, me) : null
    };

    if (chatType === "group") {
      return {
        ...base,
        other_user_id: null,
        other_user_name: (chat.group_name || "Unnamed Group").toString(),
        other_user_email: null,
        other_user_mobile: null,
        other_user_about: null,
        other_user_avatar: chat.group_avatar_url || null,
        other_user_status: "group",
        other_user_last_seen: null,
        blocked_by_me: 0,
        blocked_me: 0
      };
    }

    if (chatType === "self") {
      return {
        ...base,
        other_user_id: me,
        other_user_name: (chat.group_name || "AnaLocker").toString(),
        other_user_email: meUser?.email || null,
        other_user_mobile: meUser?.mobile || null,
        other_user_about: meUser?.about_bio || null,
        other_user_avatar: chat.group_avatar_url || "/logo.png",
        other_user_status: meUser?.status || "offline",
        other_user_last_seen: meUser?.last_seen || null,
        blocked_by_me: 0,
        blocked_me: 0
      };
    }

    const otherId = Number(chat.user1_id) === me ? Number(chat.user2_id) : Number(chat.user1_id);
    const other = otherUserMap.get(otherId) || null;

    return {
      ...base,
      other_user_id: otherId || null,
      other_user_name: other?.name || "User",
      other_user_email: other?.email || null,
      other_user_mobile: other?.mobile || null,
      other_user_about: other?.about_bio || null,
      other_user_avatar: other?.avatar_url || null,
      other_user_status: other?.status || "offline",
      other_user_last_seen: other?.last_seen || null,
      blocked_by_me: blockedByMeSet.has(otherId) ? 1 : 0,
      blocked_me: blockedMeSet.has(otherId) ? 1 : 0
    };
  });

  rows.sort((a, b) => {
    const aPriority = a?.chat_type === "self" ? 0 : 1;
    const bPriority = b?.chat_type === "self" ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const left = new Date(b.last_message_at || b.last_message_created_at || 0).getTime();
    const right = new Date(a.last_message_at || a.last_message_created_at || 0).getTime();
    return left - right;
  });

  return rows;
}

router.get("/", requireUser, async (req, res) => {
  const rows = await getUserChats(req.user.id);
  res.json(rows);
});

router.get("/hidden/count", requireUser, async (req, res) => {
  const db = await getDb();
  const count = await db.collection("user_hidden_chats").countDocuments({ user_id: Number(req.user.id) });
  res.json({ count });
});

router.post("/hidden/unlock", requireUser, async (req, res) => {
  const pin = req.body?.pin;
  const verification = await verifyExistingChatPin(req.user.id, pin);
  if (!verification.ok) return res.status(400).json({ message: verification.message });

  const rows = await getUserChats(req.user.id, { includeHidden: true, onlyHidden: true });
  res.json({ success: true, chats: rows });
});

router.post("/:chatId/hide", requireUser, async (req, res) => {
  const chatId = Number(req.params.chatId);
  if (!chatId) return res.status(400).json({ message: "chatId required" });

  const db = await getDb();
  const chat = await getChatMembership(db, chatId, req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });
  if (chat.chat_type === "self") {
    return res.status(400).json({ message: "AnaLocker chat cannot be hidden" });
  }

  const verification = await verifyOrCreateChatPin(req.user.id, req.body?.pin);
  if (!verification.ok) return res.status(400).json({ message: verification.message });

  await db.collection("user_hidden_chats").updateOne(
    { user_id: Number(req.user.id), chat_id: chatId },
    { $setOnInsert: { user_id: Number(req.user.id), chat_id: chatId, hidden_at: new Date() } },
    { upsert: true }
  );

  emitChatUpdated(req, [req.user.id], chatId);
  return res.json({ success: true, chatId, pin_created: Boolean(verification.created) });
});

router.post("/:chatId/unhide", requireUser, async (req, res) => {
  const chatId = Number(req.params.chatId);
  if (!chatId) return res.status(400).json({ message: "chatId required" });

  const db = await getDb();
  const chat = await getChatMembership(db, chatId, req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });

  const verification = await verifyExistingChatPin(req.user.id, req.body?.pin);
  if (!verification.ok) return res.status(400).json({ message: verification.message });

  await db.collection("user_hidden_chats").deleteOne({ user_id: Number(req.user.id), chat_id: chatId });

  emitChatUpdated(req, [req.user.id], chatId);
  return res.json({ success: true, chatId });
});

// E2EE helper: fetch participant public keys for encrypting messages client-side.
router.get("/:chatId/participants", requireUser, async (req, res) => {
  const chatId = Number(req.params.chatId);
  if (!Number.isInteger(chatId) || chatId <= 0) {
    return res.status(400).json({ message: "chatId required" });
  }

  const db = await getDb();
  const chat = await getChatMembership(db, chatId, req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });

  const participantIds = await getChatParticipantIds(db, chat);
  const rows = participantIds.length
    ? await db.collection("users").find(
      { id: { $in: participantIds }, is_verified: true, is_blocked: false },
      { projection: { _id: 0, id: 1, public_key: 1 } }
    ).toArray()
    : [];

  const keyMap = new Map(rows.map((row) => [Number(row.id), row.public_key || null]));
  const participants = participantIds.map((id) => ({
    id,
    publicKey: keyMap.get(Number(id)) || null
  }));

  res.json({ chatId, participants });
});

router.post("/", requireUser, async (req, res) => {
  const otherUserId = Number(req.body.otherUserId || req.body.userId);
  if (!otherUserId) return res.status(400).json({ message: "otherUserId required" });
  const me = Number(req.user.id);
  if (otherUserId === me) return res.status(400).json({ message: "Cannot chat with yourself" });

  const db = await getDb();

  const targetUser = await db.collection("users").findOne(
    { id: otherUserId, is_verified: true, is_blocked: false },
    { projection: { _id: 0, id: 1 } }
  );

  if (!targetUser) return res.status(404).json({ message: "Target user not found" });

  const blockState = await getDirectBlockState(db, me, otherUserId);
  if (blockState.blockedByA) {
    return res.status(403).json({ message: "You blocked this user. Unblock to continue." });
  }
  if (blockState.blockedByB) {
    return res.status(403).json({ message: "This user blocked you." });
  }

  const existing = await db.collection("chats").findOne(
    {
      $and: [
        { $or: [{ chat_type: "direct" }, { chat_type: null }, { chat_type: { $exists: false } }] },
        {
          $or: [
            { user1_id: me, user2_id: otherUserId },
            { user1_id: otherUserId, user2_id: me }
          ]
        }
      ]
    },
    { projection: { _id: 0 } }
  );

  const now = new Date();

  if (existing) {
    await Promise.all([
      db.collection("chat_members").updateOne(
        { chat_id: existing.id, user_id: me },
        {
          $set: { role: "member" },
          $setOnInsert: { chat_id: existing.id, user_id: me, joined_at: now, created_at: now }
        },
        { upsert: true }
      ),
      db.collection("chat_members").updateOne(
        { chat_id: existing.id, user_id: otherUserId },
        {
          $set: { role: "member" },
          $setOnInsert: { chat_id: existing.id, user_id: otherUserId, joined_at: now, created_at: now }
        },
        { upsert: true }
      )
    ]);

    emitChatUpdated(req, [me, otherUserId], existing.id);
    return res.json(existing);
  }

  const chatId = await getNextSequence("chats");
  const chat = {
    id: chatId,
    user1_id: me,
    user2_id: otherUserId,
    chat_type: "direct",
    group_name: null,
    group_avatar_url: null,
    chat_background_url: null,
    created_by_user_id: me,
    last_message_at: null,
    created_at: now,
    updated_at: now
  };

  await db.collection("chats").insertOne(chat);
  await db.collection("chat_members").insertMany([
    { chat_id: chatId, user_id: me, role: "member", joined_at: now, created_at: now },
    { chat_id: chatId, user_id: otherUserId, role: "member", joined_at: now, created_at: now }
  ]);

  emitChatUpdated(req, [me, otherUserId], chatId);
  return res.json(chat);
});

router.post("/group", requireUser, async (req, res) => {
  const me = Number(req.user.id);
  const name = (req.body?.name || req.body?.groupName || "").toString().trim().slice(0, 140);
  const rawMemberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];

  if (!name) return res.status(400).json({ message: "Group name is required" });

  const memberIds = [...new Set(rawMemberIds.map(Number).filter((id) => id && id !== me))];
  if (!memberIds.length) return res.status(400).json({ message: "Select at least one participant" });

  const db = await getDb();
  const eligibleUsers = await db.collection("users").find(
    { id: { $in: memberIds }, is_verified: true, is_blocked: false },
    { projection: { _id: 0, id: 1 } }
  ).toArray();
  const validMemberIds = eligibleUsers.map((row) => Number(row.id)).filter(Boolean);
  if (!validMemberIds.length) {
    return res.status(400).json({ message: "No valid participants selected" });
  }

  const allMembers = [me, ...new Set(validMemberIds)];

  const now = new Date();
  const chatId = await getNextSequence("chats");

  await db.collection("chats").insertOne({
    id: chatId,
    user1_id: me,
    user2_id: me,
    chat_type: "group",
    group_name: name,
    group_avatar_url: null,
    chat_background_url: null,
    created_by_user_id: me,
    last_message_at: null,
    created_at: now,
    updated_at: now
  });

  await db.collection("chat_members").insertMany(allMembers.map((userId) => ({
    chat_id: chatId,
    user_id: userId,
    role: userId === me ? "admin" : "member",
    joined_at: now,
    created_at: now
  })));

  emitChatUpdated(req, allMembers, chatId);

  const chats = await getUserChats(me);
  const created = chats.find((item) => Number(item.id) === Number(chatId));
  res.json(created || { id: chatId, chat_type: "group", group_name: name, member_count: allMembers.length });
});

router.patch("/:chatId/background", requireUser, chatBackgroundUpload, async (req, res) => {
  const chatId = Number(req.params.chatId);
  if (!chatId) return res.status(400).json({ message: "chatId required" });

  const db = await getDb();
  const chat = await getChatMembership(db, chatId, req.user.id);
  if (!chat) return res.status(403).json({ message: "Not chat participant" });

  const clearRaw = req.body?.clear;
  const clear = clearRaw === true || clearRaw === "true" || clearRaw === "1";
  const presetRaw = (req.body?.backgroundPreset || "").toString().trim().toLowerCase();
  const preset = ALLOWED_BG_PRESETS.has(presetRaw) ? `preset:${presetRaw}` : null;
  const uploadedPath = req.file?.filename ? `uploads/${req.file.filename}` : null;

  let nextBackground = null;
  if (clear) {
    nextBackground = null;
  } else if (uploadedPath) {
    nextBackground = uploadedPath;
  } else if (preset) {
    nextBackground = preset;
  } else {
    return res.status(400).json({ message: "background image or valid preset required" });
  }

  await db.collection("chats").updateOne(
    { id: chatId },
    { $set: { chat_background_url: nextBackground, updated_at: new Date() } }
  );

  const participantIds = await getChatParticipantIds(db, chat);
  emitChatUpdated(req, participantIds, chatId);

  return res.json({
    success: true,
    chatId,
    chat_background_url: nextBackground
  });
});

// Backward-compatible aliases
router.get("/list", requireUser, async (req, res) => {
  const rows = await getUserChats(req.user.id);
  res.json(rows);
});

router.post("/create", requireUser, async (req, res) => {
  const otherUserId = Number(req.body.userId || req.body.otherUserId);
  if (!otherUserId) return res.status(400).json({ message: "userId required" });

  const me = Number(req.user.id);
  if (otherUserId === me) return res.status(400).json({ message: "Cannot chat with yourself" });

  const db = await getDb();
  const targetUser = await db.collection("users").findOne(
    { id: otherUserId, is_verified: true, is_blocked: false },
    { projection: { _id: 0, id: 1 } }
  );
  if (!targetUser) return res.status(404).json({ message: "Target user not found" });

  const blockState = await getDirectBlockState(db, me, otherUserId);
  if (blockState.blockedByA) {
    return res.status(403).json({ message: "You blocked this user. Unblock to continue." });
  }
  if (blockState.blockedByB) {
    return res.status(403).json({ message: "This user blocked you." });
  }

  const existing = await db.collection("chats").findOne(
    {
      $and: [
        { $or: [{ chat_type: "direct" }, { chat_type: null }, { chat_type: { $exists: false } }] },
        {
          $or: [
            { user1_id: me, user2_id: otherUserId },
            { user1_id: otherUserId, user2_id: me }
          ]
        }
      ]
    },
    { projection: { _id: 0 } }
  );

  const now = new Date();

  if (existing) {
    await Promise.all([
      db.collection("chat_members").updateOne(
        { chat_id: existing.id, user_id: me },
        {
          $set: { role: "member" },
          $setOnInsert: { chat_id: existing.id, user_id: me, joined_at: now, created_at: now }
        },
        { upsert: true }
      ),
      db.collection("chat_members").updateOne(
        { chat_id: existing.id, user_id: otherUserId },
        {
          $set: { role: "member" },
          $setOnInsert: { chat_id: existing.id, user_id: otherUserId, joined_at: now, created_at: now }
        },
        { upsert: true }
      )
    ]);

    emitChatUpdated(req, [me, otherUserId], existing.id);
    return res.json(existing);
  }

  const chatId = await getNextSequence("chats");
  const chat = {
    id: chatId,
    user1_id: me,
    user2_id: otherUserId,
    chat_type: "direct",
    group_name: null,
    group_avatar_url: null,
    chat_background_url: null,
    created_by_user_id: me,
    last_message_at: null,
    created_at: now,
    updated_at: now
  };

  await db.collection("chats").insertOne(chat);
  await db.collection("chat_members").insertMany([
    { chat_id: chatId, user_id: me, role: "member", joined_at: now, created_at: now },
    { chat_id: chatId, user_id: otherUserId, role: "member", joined_at: now, created_at: now }
  ]);

  emitChatUpdated(req, [me, otherUserId], chatId);
  return res.json(chat);
});

export default router;
