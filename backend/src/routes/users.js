import express from "express";
import fs from "node:fs";
import multer from "multer";
import path from "path";
import { getDb } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { writeUserActivity } from "../services/userActivity.js";

const router = express.Router();
const uploadDir = path.resolve(process.cwd(), "src", "uploads");
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
    publicKey: row.public_key || null
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

router.patch("/me", requireUser, avatarUpload, async (req, res) => {
  const userId = req.user.id;
  const name = (req.body.name || "").toString().trim();
  const email = (req.body.email || "").toString().trim();
  const mobile = (req.body.mobile || "").toString().trim();
  const aboutProvided = Object.prototype.hasOwnProperty.call(req.body || {}, "about");
  const aboutBio = aboutProvided ? (req.body.about || "").toString().trim().slice(0, 500) : null;
  const avatarFile = req.file?.filename || null;

  if (!name) return res.status(400).json({ message: "Name is required" });
  if (!email) return res.status(400).json({ message: "Email is required" });
  if (!mobile) return res.status(400).json({ message: "Mobile is required" });

  const db = await getDb();
  const current = await db.collection("users").findOne({ id: userId }, { projection: { id: 1, name: 1, email: 1, mobile: 1, avatar_url: 1, about_bio: 1 } });
  if (!current) return res.status(404).json({ message: "User not found" });

  const conflict = await db.collection("users").findOne({ id: { $ne: userId }, $or: [{ email }, { mobile }] });
  if (conflict) return res.status(409).json({ message: "Email or mobile already in use" });

  await db.collection("users").updateOne({ id: userId }, {
    $set: {
      name,
      email,
      mobile,
      phone: mobile,
      ...(mobile && mobile === (process.env.SUPER_ADMIN || "").toString().trim() ? { is_admin: true } : {}),
      about_bio: aboutBio !== null ? aboutBio : current.about_bio,
      avatar_url: avatarFile !== null ? avatarFile : current.avatar_url
    }
  });

  const updated = await db.collection("users").findOne({ id: userId });

  const changedFields = [];
  if (current.name !== updated.name) changedFields.push("name");
  if (current.email !== updated.email) changedFields.push("email");
  if (current.mobile !== updated.mobile) changedFields.push("mobile");
  if ((current.about_bio || "") !== (updated.about_bio || "")) changedFields.push("about_bio");
  if (avatarFile && current.avatar_url !== updated.avatar_url) changedFields.push("avatar_url");
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

export default router;
