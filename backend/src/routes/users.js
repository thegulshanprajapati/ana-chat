import express from "express";
import fs from "node:fs";
import multer from "multer";
import path from "path";import bcrypt from "bcryptjs";import { getDb, getNextSequence } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { writeUserActivity } from "../services/userActivity.js";
import { v2 as cloudinary } from "cloudinary";

import { fileURLToPath } from "node:url";

// Configure Cloudinary if credentials exist in .env
if (process.env.CLOUDINARY_URL) {
  cloudinary.config();
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "..", "uploads");
const DEFAULT_SETTINGS = {
  compactMode: false,
  showOnlineStatus: true,
  enterToSend: true,
  soundEffects: true,
  notificationsEnabled: true
};
const ALLOWED_REPORT_REASONS = new Set([
  "spam",
  "abuse",
  "harassment",
  "fake_profile",
  "scam",
  "other"
]);

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Avatar must be an image"));
    }
    return cb(null, true);
  }
});

function avatarUpload(req, res, next) {
  upload.single("avatar")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Avatar must be 5MB or less" });
    }
    return res.status(400).json({ message: err.message || "Avatar upload failed" });
  });
}

function parseSettings(rawValue) {
  if (!rawValue) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };
    return {
      ...DEFAULT_SETTINGS,
      compactMode: Boolean(parsed.compactMode),
      showOnlineStatus: parsed.showOnlineStatus !== false,
      enterToSend: parsed.enterToSend !== false,
      soundEffects: parsed.soundEffects !== false,
      notificationsEnabled: parsed.notificationsEnabled !== false
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function normalizePin(value) {
  return (value || "").toString().trim();
}

function pinLooksValid(pin) {
  if (!pin) return false;
  if (!/^\d+$/.test(pin)) return false;
  return pin.length >= 4 && pin.length <= 8;
}

function profilePayload(row) {
  const phone = row.phone || row.mobile || null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    phone,
    avatar_url: row.avatar_url,
    about_bio: row.about_bio || "",
    status: row.status,
    last_seen: row.last_seen,
    is_verified: Boolean(row.is_verified),
    auth_provider: row.auth_provider || "local",
    generated_password: row.generated_password_plain || null,
    settings: parseSettings(row.settings_json),
    isAdmin: Boolean(row.is_admin) || (phone && phone === (process.env.SUPER_ADMIN || "").toString().trim()),
    publicKey: row.public_key || null,
    anaSecurityPinEnabled: Boolean(row.security_pin_hash),
    anaSecurityPinSetAt: row.security_pin_set_at || null
  };
}

async function getDirectChatId(userA, userB) {
  const [first, second] = Number(userA) < Number(userB)
    ? [Number(userA), Number(userB)]
    : [Number(userB), Number(userA)];
  const db = await getDb();
  const row = await db.collection("chats").findOne({
    chat_type: "direct",
    $or: [
      { user1_id: first, user2_id: second },
      { user1_id: second, user2_id: first }
    ]
  });
  return row?.id || null;
}

function emitChatUpdatedForPair(req, userA, userB, chatId = null) {
  const io = req.app.get("io");
  const payload = { chatId };
  io.to(`user_${userA}`).emit("chat_updated", payload);
  io.to(`user_${userB}`).emit("chat_updated", payload);
}

router.get("/", requireUser, async (req, res) => {
  const q = (req.query.q || "").toString();
  const db = await getDb();

  const blockRows = await db.collection("user_blocks").find({
    $or: [
      { blocker_user_id: req.user.id },
      { blocked_user_id: req.user.id }
    ]
  }).toArray();

  const blockedIds = new Set();
  blockRows.forEach((entry) => {
    blockedIds.add(entry.blocker_user_id);
    blockedIds.add(entry.blocked_user_id);
  });

  const excluded = new Set([req.user.id, ...Array.from(blockedIds)]);
  const filter = {
    id: { $nin: Array.from(excluded) },
    is_verified: true,
    is_blocked: false
  };

  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { mobile: { $regex: q, $options: "i" } }
    ];
  }

  const rows = await db.collection("users").find(filter, {
    projection: {
      _id: 0,
      id: 1,
      name: 1,
      email: 1,
      mobile: 1,
      phone: 1,
      avatar_url: 1,
      about_bio: 1,
      status: 1,
      last_seen: 1,
      is_verified: 1,
      auth_provider: 1,
      public_key: 1,
      is_admin: 1
    }
  }).sort({ status: -1, last_seen: -1 }).toArray();
  res.json(rows);
});

router.patch("/:userId/rename", requireUser, async (req, res) => {
  const targetUserId = Number(req.params.userId);
  const newName = (req.body.name || "").trim();
  if (!targetUserId || !newName) {
    return res.status(400).json({ message: "userId and name are required" });
  }

  const db = await getDb();
  await db.collection("users").updateOne(
    { id: targetUserId },
    { $set: { name: newName, updated_at: new Date() } }
  );

  res.json({ success: true, name: newName });
});

router.patch("/me", requireUser, avatarUpload, async (req, res) => {
  const userId = req.user.id;
  const name = (req.body.name || "").toString().trim();
  const email = (req.body.email || "").toString().trim();
  const mobile = (req.body.mobile || "").toString().trim();
  const aboutProvided = Object.prototype.hasOwnProperty.call(req.body || {}, "about");
  const aboutBio = aboutProvided ? (req.body.about || "").toString().trim().slice(0, 500) : null;
  const password = req.body.password ? (req.body.password || "").toString().trim() : null;

  if (!name) return res.status(400).json({ message: "Name is required" });
  if (!email) return res.status(400).json({ message: "Email is required" });
  if (!mobile) return res.status(400).json({ message: "Mobile is required" });

  const db = await getDb();
  const current = await db.collection("users").findOne({ id: userId }, { projection: { id: 1, name: 1, email: 1, mobile: 1, avatar_url: 1, about_bio: 1 } });
  if (!current) return res.status(404).json({ message: "User not found" });

  const conflict = await db.collection("users").findOne({ id: { $ne: userId }, $or: [{ email }, { mobile }] });
  if (conflict) return res.status(409).json({ message: "Email or mobile already in use" });

  let avatarUrl = current.avatar_url;
  if (req.file) {
    if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "anachat_avatars",
          transformation: [{ width: 500, height: 500, crop: "limit" }]
        });
        avatarUrl = uploadResult.secure_url;
        // clean up temporary local file asynchronously
        fs.unlink(req.file.path, () => {});
      } catch (err) {
        console.error("Cloudinary upload failed:", err);
        // fallback to local if Cloudinary fails
        avatarUrl = `/uploads/${req.file.filename}`;
      }
    } else {
      avatarUrl = `/uploads/${req.file.filename}`;
    }
  }

  await db.collection("users").updateOne({ id: userId }, {
    $set: {
      name,
      email,
      mobile,
      phone: mobile,
      ...(mobile && mobile === (process.env.SUPER_ADMIN || "").toString().trim() ? { is_admin: true } : {}),
      about_bio: aboutBio !== null ? aboutBio : current.about_bio,
      avatar_url: avatarUrl,
      ...(password ? {
        password_hash: await bcrypt.hash(password, 10),
        generated_password_plain: null
      } : {})
    }
  });

  const updated = await db.collection("users").findOne({ id: userId });

  const changedFields = [];
  if (current.name !== updated.name) changedFields.push("name");
  if (current.email !== updated.email) changedFields.push("email");
  if (current.mobile !== updated.mobile) changedFields.push("mobile");
  if ((current.about_bio || "") !== (updated.about_bio || "")) changedFields.push("about_bio");
  if (req.file && current.avatar_url !== updated.avatar_url) changedFields.push("avatar_url");
  if (changedFields.length) {
    await writeUserActivity({
      actorUserId: userId,
      targetUserId: userId,
      type: "PROFILE_UPDATE",
      metadata: { changed_fields: changedFields }
    });
  }

  const io = req.app.get("io");
  io.emit("user_profile_updated", {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    mobile: updated.mobile,
    avatar_url: updated.avatar_url,
    about_bio: updated.about_bio || "",
    status: updated.status,
    last_seen: updated.last_seen,
    is_verified: Boolean(updated.is_verified)
  });

  res.json(profilePayload(updated));
});

// E2EE: client uploads public key (private key never leaves the browser).
router.put("/me/public-key", requireUser, async (req, res) => {
  const publicKey = req.body?.publicKey;
  if (!publicKey || typeof publicKey !== "object") {
    return res.status(400).json({ message: "publicKey (JWK object) required" });
  }

  const db = await getDb();
  await db.collection("users").updateOne(
    { id: Number(req.user.id) },
    { $set: { public_key: publicKey } }
  );

  const updated = await db.collection("users").findOne(
    { id: Number(req.user.id) },
    { projection: { _id: 0, id: 1, public_key: 1 } }
  );

  res.json({ success: true, id: updated?.id, publicKey: updated?.public_key || null });
});

router.put("/me/private-key-backup", requireUser, async (req, res) => {
  const encryptedPrivateKey = req.body?.encryptedPrivateKey;
  const pin = (req.body?.pin || "").toString().trim();
  if (!encryptedPrivateKey || typeof encryptedPrivateKey !== "object") {
    return res.status(400).json({ message: "encryptedPrivateKey required" });
  }
  if (!/^[0-9]{4,8}$/.test(pin)) {
    return res.status(400).json({ message: "PIN must be 4 to 8 digits" });
  }

  const db = await getDb();
  const pinHash = await bcrypt.hash(pin, 10);
  await db.collection("users").updateOne(
    { id: Number(req.user.id) },
    { $set: { private_key_backup: encryptedPrivateKey, private_key_backup_pin_hash: pinHash } }
  );

  res.json({ success: true });
});

router.get("/:userId/public-key", requireUser, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid userId" });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { id: userId, is_verified: true, is_blocked: false },
    { projection: { _id: 0, id: 1, public_key: 1 } }
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ id: user.id, publicKey: user.public_key || null });
});

router.post("/public-keys", requireUser, async (req, res) => {
  const raw = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
  const userIds = [...new Set(raw.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];
  if (!userIds.length) return res.json({ keys: {} });

  const db = await getDb();
  const rows = await db.collection("users")
    .find({ id: { $in: userIds }, is_verified: true, is_blocked: false }, { projection: { _id: 0, id: 1, public_key: 1 } })
    .toArray();

  const keys = {};
  rows.forEach((row) => {
    keys[String(row.id)] = row.public_key || null;
  });

  res.json({ keys });
});

router.patch("/me/settings", requireUser, async (req, res) => {
  const incoming = (req.body?.settings && typeof req.body.settings === "object")
    ? req.body.settings
    : (typeof req.body === "object" ? req.body : {});

  const current = {
    ...DEFAULT_SETTINGS,
    ...(req.user.settings || {})
  };
  const next = {
    ...current,
    compactMode: typeof incoming.compactMode === "boolean" ? incoming.compactMode : current.compactMode,
    showOnlineStatus: typeof incoming.showOnlineStatus === "boolean" ? incoming.showOnlineStatus : current.showOnlineStatus,
    enterToSend: typeof incoming.enterToSend === "boolean" ? incoming.enterToSend : current.enterToSend,
    soundEffects: typeof incoming.soundEffects === "boolean" ? incoming.soundEffects : current.soundEffects,
    notificationsEnabled: typeof incoming.notificationsEnabled === "boolean"
      ? incoming.notificationsEnabled
      : current.notificationsEnabled
  };

  const db = await getDb();
  await db.collection("users").updateOne({ id: req.user.id }, { $set: { settings_json: JSON.stringify(next) } });

  const changedSettings = Object.keys(next).filter((key) => next[key] !== current[key]);
  if (changedSettings.length) {
    await writeUserActivity({
      actorUserId: req.user.id,
      targetUserId: req.user.id,
      type: "SETTINGS_UPDATE",
      metadata: { changed_settings: changedSettings }
    });
  }

  res.json({ success: true, settings: next });
});

router.post("/me/security-pin", requireUser, async (req, res) => {
  const pin = normalizePin(req.body?.pin);
  const currentPin = normalizePin(req.body?.currentPin);
  if (!pinLooksValid(pin)) {
    return res.status(400).json({ message: "PIN must be 4-8 digits" });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ id: req.user.id });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.security_pin_hash) {
    if (!pinLooksValid(currentPin)) {
      return res.status(400).json({ message: "currentPin is required to change PIN" });
    }
    const ok = await bcrypt.compare(currentPin, user.security_pin_hash);
    if (!ok) return res.status(401).json({ message: "Invalid current PIN" });
  }

  const hash = await bcrypt.hash(pin, 10);
  await db.collection("users").updateOne(
    { id: req.user.id },
    { $set: { security_pin_hash: hash, security_pin_set_at: new Date() } }
  );

  await writeUserActivity({
    actorUserId: req.user.id,
    targetUserId: req.user.id,
    type: "SETTINGS_UPDATE",
    metadata: { changed_settings: ["anaSecurityPinEnabled"] }
  });

  res.json({ success: true, anaSecurityPinEnabled: true });
});

router.delete("/me/security-pin", requireUser, async (req, res) => {
  const currentPin = normalizePin(req.body?.currentPin);
  if (!pinLooksValid(currentPin)) {
    return res.status(400).json({ message: "currentPin is required" });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ id: req.user.id });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (!user.security_pin_hash) return res.status(400).json({ message: "Ana Security PIN not enabled" });

  const ok = await bcrypt.compare(currentPin, user.security_pin_hash);
  if (!ok) return res.status(401).json({ message: "Invalid current PIN" });

  await db.collection("users").updateOne(
    { id: req.user.id },
    { $unset: { security_pin_hash: "", security_pin_set_at: "", security_pin_last_used_at: "" } }
  );

  await writeUserActivity({
    actorUserId: req.user.id,
    targetUserId: req.user.id,
    type: "SETTINGS_UPDATE",
    metadata: { changed_settings: ["anaSecurityPinEnabled"] }
  });

  res.json({ success: true, anaSecurityPinEnabled: false });
});

router.post("/:userId/block", requireUser, async (req, res) => {
  const me = Number(req.user.id);
  const targetUserId = Number(req.params.userId);
  if (!targetUserId) return res.status(400).json({ message: "Valid userId is required" });
  if (targetUserId === me) return res.status(400).json({ message: "You cannot block yourself" });

  const db = await getDb();
  const target = await db.collection("users").findOne({ id: targetUserId, is_verified: true });
  if (!target) return res.status(404).json({ message: "User not found" });

  await db.collection("user_blocks").updateOne(
    { blocker_user_id: me, blocked_user_id: targetUserId },
    { $set: { created_at: new Date() } },
    { upsert: true }
  );
  await writeUserActivity({
    actorUserId: me,
    targetUserId,
    type: "BLOCK_USER",
    metadata: {}
  });

  const directChatId = await getDirectChatId(me, targetUserId);
  emitChatUpdatedForPair(req, me, targetUserId, directChatId);

  return res.json({
    success: true,
    blocked_user_id: targetUserId
  });
});

router.delete("/:userId/block", requireUser, async (req, res) => {
  const me = Number(req.user.id);
  const targetUserId = Number(req.params.userId);
  if (!targetUserId) return res.status(400).json({ message: "Valid userId is required" });
  if (targetUserId === me) return res.status(400).json({ message: "You cannot unblock yourself" });

  const db = await getDb();
  await db.collection("user_blocks").deleteOne({ blocker_user_id: me, blocked_user_id: targetUserId });
  await writeUserActivity({
    actorUserId: me,
    targetUserId,
    type: "UNBLOCK_USER",
    metadata: {}
  });

  const directChatId = await getDirectChatId(me, targetUserId);
  emitChatUpdatedForPair(req, me, targetUserId, directChatId);

  return res.json({
    success: true,
    blocked_user_id: targetUserId
  });
});

router.post("/:userId/report", requireUser, async (req, res) => {
  const me = Number(req.user.id);
  const targetUserId = Number(req.params.userId);
  if (!targetUserId) return res.status(400).json({ message: "Valid userId is required" });
  if (targetUserId === me) return res.status(400).json({ message: "You cannot report yourself" });

  const reasonRaw = (req.body?.reason || "other").toString().trim().toLowerCase().replace(/\s+/g, "_");
  const reason = ALLOWED_REPORT_REASONS.has(reasonRaw) ? reasonRaw : "other";
  const details = (req.body?.details || "").toString().trim().slice(0, 1000);

  const db = await getDb();
  const target = await db.collection("users").findOne({ id: targetUserId }, { projection: { id: 1 } });
  if (!target) return res.status(404).json({ message: "User not found" });

  await db.collection("user_reports").insertOne({
    reporter_user_id: me,
    reported_user_id: targetUserId,
    reason,
    details: details || null,
    status: "open",
    created_at: new Date()
  });
  await writeUserActivity({
    actorUserId: me,
    targetUserId,
    type: "REPORT_USER",
    metadata: {
      reason,
      details: details || ""
    }
  });

  return res.json({
    success: true,
    reported_user_id: targetUserId
  });
});

// Call logs endpoints
router.post("/call-logs", requireUser, async (req, res) => {
  const userId = Number(req.user.id);
  const {
    direction,
    status,
    callType,
    mode,
    peerUserId,
    peerName,
    peerAvatar,
    chatId,
    started_at,
    ended_at
  } = req.body || {};

  if (!direction || !status || !callType) {
    return res.status(400).json({ message: "direction, status, and callType are required" });
  }

  const db = await getDb();
  const now = new Date();
  const logId = await getNextSequence("callLogs");

  const callLog = {
    id: logId,
    user_id: userId,
    direction: direction.toString(),
    status: status.toString(),
    callType: callType.toString(),
    mode: mode?.toString() || "standard",
    peer_user_id: Number(peerUserId) || null,
    peer_name: (peerName || "").toString().slice(0, 100),
    peer_avatar: (peerAvatar || "").toString().slice(0, 255),
    chat_id: Number(chatId) || null,
    started_at: started_at ? new Date(started_at) : null,
    ended_at: ended_at ? new Date(ended_at) : null,
    created_at: now
  };

  try {
    await db.collection("callLogs").insertOne(callLog);
    res.json({ id: logId, ...callLog });
  } catch (err) {
    return res.status(500).json({ message: "Unable to save call log" });
  }
});

// Get call logs for the current user
router.get("/call-logs", requireUser, async (req, res) => {
  const userId = Number(req.user.id);
  const db = await getDb();

  try {
    const logs = await db.collection("callLogs")
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(200)
      .toArray();

    res.json(logs || []);
  } catch (err) {
    return res.status(500).json({ message: "Unable to fetch call logs" });
  }
});

// Update call log
router.patch("/call-logs/:logId", requireUser, async (req, res) => {
  const userId = Number(req.user.id);
  const logId = Number(req.params.logId);
  const { status, ended_at } = req.body || {};

  if (!logId) {
    return res.status(400).json({ message: "Log ID is required" });
  }

  const db = await getDb();
  const existing = await db.collection("callLogs").findOne({ id: logId, user_id: userId });

  if (!existing) {
    return res.status(404).json({ message: "Call log not found" });
  }

  const updateData = {};
  if (status) updateData.status = status.toString();
  if (ended_at) updateData.ended_at = new Date(ended_at);

  try {
    await db.collection("callLogs").updateOne(
      { id: logId, user_id: userId },
      { $set: updateData }
    );
    res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: "Unable to update call log" });
  }
});

const statusStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `status-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const statusMulter = multer({
  storage: statusStorage,
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.post("/statuses", requireUser, statusMulter.single("media"), async (req, res) => {
  const db = await getDb();
  const now = new Date();
  
  let mediaUrl = "";
  let mediaType = "";
  if (req.file) {
    mediaUrl = `/api/uploads/${req.file.filename}`;
    mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";
  }

  const text = req.body.text || "";
  let textStyles = null;
  if (req.body.textStyles) {
    try {
      textStyles = typeof req.body.textStyles === "string" 
        ? JSON.parse(req.body.textStyles) 
        : req.body.textStyles;
    } catch (e) {
      // ignore
    }
  }

  const statusId = await getNextSequence("statuses");
  const newStatus = {
    id: statusId,
    user_id: Number(req.user.id),
    user_name: req.user.name,
    user_avatar: req.user.avatar_url || null,
    text,
    mediaType,
    mediaUrl,
    textStyles,
    created_at: now
  };

  await db.collection("statuses").insertOne(newStatus);

  const io = req.app.get("io");
  if (io) {
    io.emit("status_updated", { userId: req.user.id });
  }

  return res.json({ status: "ok", update: newStatus });
});

router.get("/statuses", requireUser, async (req, res) => {
  const db = await getDb();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const statuses = await db.collection("statuses").find({
    created_at: { $gte: twentyFourHoursAgo }
  }).sort({ created_at: -1 }).toArray();

  const grouped = {};
  statuses.forEach((item) => {
    const uid = item.user_id;
    if (!grouped[uid]) {
      grouped[uid] = {
        id: `status-${uid}`,
        userId: uid,
        name: item.user_name,
        avatar: item.user_avatar,
        unseen: true,
        items: []
      };
    }
    grouped[uid].items.push({
      id: item.id.toString(),
      created_at: item.created_at,
      text: item.text,
      mediaType: item.mediaType,
      mediaUrl: item.mediaUrl,
      textStyles: item.textStyles
    });
  });

  return res.json(Object.values(grouped));
});

export default router;
