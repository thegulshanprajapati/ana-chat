import express from "express";
import { getDb } from "../db.js";
import { query } from "../dbPostgres.js";
import { requireUser } from "../middleware/auth.js";
import { getChatMembership } from "../utils/chatDb.js";
import { e2eeForUser } from "../models/Message.js";
import {
  hashKey,
  verifyKey,
  generateKeyIdentifier
} from "../utils/hiddenMessagesHelper.js";

const router = express.Router();

// Rate limiting state for wrong keys (in-memory lockouts)
const failedAttempts = new Map(); // key: userId -> { count, cooldownUntil }

function checkRateLimit(userId) {
  const state = failedAttempts.get(userId);
  if (state && state.cooldownUntil > Date.now()) {
    return {
      blocked: true,
      timeLeft: Math.ceil((state.cooldownUntil - Date.now()) / 1000)
    };
  }
  return { blocked: false };
}

function registerFailedAttempt(userId) {
  const state = failedAttempts.get(userId) || { count: 0, cooldownUntil: 0 };
  state.count += 1;
  if (state.count >= 5) {
    state.cooldownUntil = Date.now() + 60 * 1000; // 1 minute lockout
    state.count = 0; // reset after applying cooldown
  }
  failedAttempts.set(userId, state);
}

function resetFailedAttempts(userId) {
  failedAttempts.delete(userId);
}

/**
 * Helper to check IDOR: Validate user belongs to chat & message belongs to that chat
 */
async function validateMessageAccess(db, userId, chatId, messageId) {
  const chat = await getChatMembership(db, Number(chatId), userId);
  if (!chat) return { valid: false, error: "Not authorized for this chat" };

  const message = await db.collection("messages").findOne({ id: Number(messageId), chat_id: Number(chatId) });
  if (!message) return { valid: false, error: "Message not found in this chat" };

  return { valid: true, message, chat };
}

/**
 * 1. POST /api/messages/:messageId/hide
 */
router.post("/messages/:messageId/hide", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const { chatId, keyType, key } = req.body;

  if (!chatId || !keyType || !key) {
    return res.status(400).json({ message: "chatId, keyType, and key are required" });
  }

  try {
    const db = await getDb();
    const access = await validateMessageAccess(db, req.user.id, chatId, messageId);
    if (!access.valid) return res.status(403).json({ message: access.error });

    const { hash, salt } = hashKey(key);
    const keyIdentifier = generateKeyIdentifier(req.user.id, key);

    const now = new Date();
    await db.collection("hidden_messages").updateOne(
      { user_id: req.user.id, message_id: messageId },
      {
        $set: {
          chat_id: Number(chatId),
          key_type: keyType,
          key_hash: hash,
          key_salt: salt,
          key_identifier: keyIdentifier,
          is_hidden: true,
          hidden_at: now,
          updated_at: now
        }
      },
      { upsert: true }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("[HiddenMessages] Hide failed:", err);
    return res.status(500).json({ message: "Failed to hide message" });
  }
});

/**
 * 2. POST /api/messages/:messageId/unhide
 */
router.post("/messages/:messageId/unhide", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const { chatId } = req.body;

  if (!chatId) {
    return res.status(400).json({ message: "chatId is required" });
  }

  try {
    const db = await getDb();
    const access = await validateMessageAccess(db, req.user.id, chatId, messageId);
    if (!access.valid) return res.status(403).json({ message: access.error });

    await db.collection("hidden_messages").deleteOne({
      user_id: req.user.id,
      message_id: messageId
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("[HiddenMessages] Unhide failed:", err);
    return res.status(500).json({ message: "Failed to remove protection" });
  }
});

/**
 * 3. POST /api/messages/:messageId/verify-key
 */
router.post("/messages/:messageId/verify-key", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const { key, chatId } = req.body;

  if (!key || !chatId) {
    return res.status(400).json({ message: "key and chatId are required" });
  }

  const rate = checkRateLimit(req.user.id);
  if (rate.blocked) {
    return res.status(429).json({ message: `Too many failed attempts. Try again in ${rate.timeLeft} seconds.` });
  }

  try {
    const db = await getDb();
    const access = await validateMessageAccess(db, req.user.id, chatId, messageId);
    if (!access.valid) return res.status(403).json({ message: access.error });

    const record = await db.collection("hidden_messages").findOne({
      user_id: req.user.id,
      message_id: messageId
    });

    if (!record || !record.is_hidden) {
      return res.status(404).json({ message: "No protection record found" });
    }

    const match = verifyKey(key, record.key_hash);
    if (!match) {
      registerFailedAttempt(req.user.id);
      return res.status(401).json({ message: "❌ Incorrect unlock key" });
    }

    resetFailedAttempts(req.user.id);

    // Fetch reactions for the message to return along with unmasked payload
    const reactionsMap = {};
    let myReaction = null;
    try {
      const rxRes = await query(
        "SELECT user_id, reaction FROM message_reactions WHERE message_id = $1",
        [String(messageId)]
      );
      rxRes.rows.forEach((row) => {
        reactionsMap[row.reaction] = (reactionsMap[row.reaction] || 0) + 1;
        if (Number(row.user_id) === Number(req.user.id)) {
          myReaction = row.reaction;
        }
      });
    } catch (dbErr) {
      console.error("Failed to load message reactions for single unmask:", dbErr.message);
    }

    const unmaskedMsg = {
      ...access.message,
      e2ee: access.message.e2ee ? e2eeForUser(access.message.e2ee, req.user.id) : null,
      reactions: reactionsMap,
      my_reaction: myReaction
    };

    return res.json({ success: true, message: unmaskedMsg });
  } catch (err) {
    console.error("[HiddenMessages] Verification failed:", err);
    return res.status(500).json({ message: "Verification error" });
  }
});

/**
 * 4. POST /api/messages/:messageId/change-key
 */
router.post("/messages/:messageId/change-key", requireUser, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const { oldKey, newKey, newKeyType, chatId } = req.body;

  if (!oldKey || !newKey || !newKeyType || !chatId) {
    return res.status(400).json({ message: "oldKey, newKey, newKeyType, and chatId are required" });
  }

  const rate = checkRateLimit(req.user.id);
  if (rate.blocked) {
    return res.status(429).json({ message: `Too many failed attempts. Try again in ${rate.timeLeft} seconds.` });
  }

  try {
    const db = await getDb();
    const access = await validateMessageAccess(db, req.user.id, chatId, messageId);
    if (!access.valid) return res.status(403).json({ message: access.error });

    const record = await db.collection("hidden_messages").findOne({
      user_id: req.user.id,
      message_id: messageId
    });

    if (!record) {
      return res.status(404).json({ message: "No hidden message record found" });
    }

    const match = verifyKey(oldKey, record.key_hash);
    if (!match) {
      registerFailedAttempt(req.user.id);
      return res.status(401).json({ message: "❌ Incorrect current unlock key" });
    }

    const { hash, salt } = hashKey(newKey);
    const keyIdentifier = generateKeyIdentifier(req.user.id, newKey);

    await db.collection("hidden_messages").updateOne(
      { user_id: req.user.id, message_id: messageId },
      {
        $set: {
          key_type: newKeyType,
          key_hash: hash,
          key_salt: salt,
          key_identifier: keyIdentifier,
          updated_at: new Date()
        }
      }
    );

    resetFailedAttempts(req.user.id);
    return res.json({ success: true });
  } catch (err) {
    console.error("[HiddenMessages] Key update failed:", err);
    return res.status(500).json({ message: "Failed to change key" });
  }
});

/**
 * 5. POST /api/hidden-messages/unlock
 * Same-key search: matches HMAC key_identifier first, then validates each hash.
 */
router.post("/hidden-messages/unlock", requireUser, async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ message: "key is required" });
  }

  const rate = checkRateLimit(req.user.id);
  if (rate.blocked) {
    return res.status(429).json({ message: `Too many failed attempts. Try again in ${rate.timeLeft} seconds.` });
  }

  try {
    const db = await getDb();
    const keyIdentifier = generateKeyIdentifier(req.user.id, key);

    // Find all hidden records for the user matching this identifier
    const records = await db.collection("hidden_messages").find({
      user_id: req.user.id,
      key_identifier: keyIdentifier,
      is_hidden: true
    }).toArray();

    if (!records.length) {
      // Do not reveal if correct or incorrect format, just return empty list
      return res.json({ unlockedIds: [] });
    }

    const unlockedIds = [];
    for (const record of records) {
      if (verifyKey(key, record.key_hash)) {
        unlockedIds.push(record.message_id);
      }
    }

    if (unlockedIds.length === 0) {
      registerFailedAttempt(req.user.id);
      return res.status(401).json({ message: "❌ Incorrect unlock key" });
    }

    resetFailedAttempts(req.user.id);
    return res.json({ unlockedIds });
  } catch (err) {
    console.error("[HiddenMessages] Batch unlock failed:", err);
    return res.status(500).json({ message: "Unlock error occurred" });
  }
});

/**
 * 6. GET /api/hidden-messages
 * Central management Vault: list entries *without* body/media contents.
 */
router.get("/hidden-messages", requireUser, async (req, res) => {
  try {
    const db = await getDb();
    const records = await db.collection("hidden_messages")
      .find({ user_id: req.user.id, is_hidden: true })
      .sort({ hidden_at: -1 })
      .toArray();

    if (!records.length) {
      return res.json([]);
    }

    const msgIds = records.map((r) => r.message_id);
    const messages = await db.collection("messages")
      .find({ id: { $in: msgIds } })
      .toArray();

    const msgMap = new Map(messages.map((m) => [m.id, m]));

    // Build unique participant IDs to fetch names
    const participantIds = new Set();
    const chatIds = new Set();

    messages.forEach((m) => {
      participantIds.add(m.sender_id);
      chatIds.add(m.chat_id);
    });

    const [users, chats] = await Promise.all([
      db.collection("users").find({ id: { $in: [...participantIds] } }).toArray(),
      db.collection("chats").find({ id: { $in: [...chatIds] } }).toArray()
    ]);

    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const chatMap = new Map(chats.map((c) => [c.id, c]));

    const result = [];
    for (const record of records) {
      const msg = msgMap.get(record.message_id);
      if (!msg) continue;

      const chat = chatMap.get(msg.chat_id);
      let conversationName = "Conversation";

      if (chat) {
        if (chat.chat_type === "group") {
          conversationName = chat.group_name || "Group Chat";
        } else {
          // Resolve direct chat partner name
          const partnerId = Number(chat.user1_id) === req.user.id ? Number(chat.user2_id) : Number(chat.user1_id);
          const partnerName = userMap.get(partnerId);
          conversationName = partnerName || "Direct Chat";
        }
      }

      result.push({
        id: record._id,
        message_id: record.message_id,
        chat_id: msg.chat_id,
        conversation_name: conversationName,
        sender_name: userMap.get(msg.sender_id) || "Unknown",
        hidden_at: record.hidden_at,
        created_at: msg.created_at,
        key_type: record.key_type
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("[HiddenMessages] GET failed:", err);
    return res.status(500).json({ message: "Failed to load hidden messages list" });
  }
});

export default router;
