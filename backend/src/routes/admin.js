import express from "express";
import bcrypt from "bcryptjs";
import { getDb, getNextSequence } from "../db.js";
import { requireAdmin, requireAppAdmin } from "../middleware/admin.js";
import { requireUser } from "../middleware/auth.js";
import { signAdminToken } from "../services/tokens.js";
import { writeAuditLog } from "../services/audit.js";
import { revokeAllUserSessions } from "../services/session.js";
import { getSocketMonitoringData } from "../socket.js";

const router = express.Router();

function userRoom(userId) {
  return `user_${userId}`;
}

function normalizeUsername(value) {
  return (value || "").toString().trim().toLowerCase();
}

function normalizeEmail(value) {
  return (value || "").toString().trim().toLowerCase();
}

function isSuperAdmin(req) {
  return req.admin?.role === "super_admin";
}

function ensureSuperAdmin(req, res) {
  if (!isSuperAdmin(req)) {
    res.status(403).json({ message: "Only super admin can manage admins" });
    return false;
  }
  return true;
}

async function superAdminCount() {
  const db = await getDb();
  return await db.collection("admins").countDocuments({ role: "super_admin" });
}

function isUserOnline(io, userId) {
  const room = io?.sockets?.adapter?.rooms?.get?.(userRoom(userId));
  return Boolean(room && room.size > 0);
}

function liveOnlineUsersCount(io) {
  const rooms = io?.sockets?.adapter?.rooms;
  if (!rooms || typeof rooms.entries !== "function") return null;
  let count = 0;
  for (const [roomName, socketIds] of rooms.entries()) {
    if (roomName.startsWith("user_") && socketIds?.size > 0) {
      count += 1;
    }
  }
  return count;
}

function adminCookieOptions() {
  const secureCookies = process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIES === "true";
  return {
    httpOnly: true,
    sameSite: secureCookies ? "none" : "lax",
    secure: secureCookies,
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/"
  };
}

async function audit(req, action, metadata = {}) {
  if (req.admin?.id) {
    await writeAuditLog(req.admin.id, action, metadata);
  }
}

// Phone-based admin promotion for the main chat app.
// POST /admin/make-admin  { phone: "..." }
router.post("/make-admin", requireUser, requireAppAdmin, async (req, res) => {
  const phone = (req.body?.phone || req.body?.mobile || "").toString().trim();
  if (!phone) return res.status(400).json({ message: "phone required" });

  const db = await getDb();
  const target = await db.collection("users").findOne(
    { $or: [{ phone }, { mobile: phone }] },
    { projection: { _id: 0, id: 1, mobile: 1, phone: 1, is_admin: 1 } }
  );
  if (!target) return res.status(404).json({ message: "User not found" });

  await db.collection("users").updateOne(
    { id: Number(target.id) },
    { $set: { is_admin: true, phone: target.phone || target.mobile || phone } }
  );

  res.json({ success: true, userId: target.id, phone: target.phone || target.mobile || phone, isAdmin: true });
});

router.post("/login", async (req, res) => {
  const { password } = req.body;
  const identifierRaw = (req.body?.email_or_username || req.body?.email || req.body?.username || "").toString().trim();
  if (!identifierRaw || !password) {
    return res.status(400).json({ message: "email_or_username and password required" });
  }

  const email = normalizeEmail(identifierRaw);
  const username = normalizeUsername(identifierRaw);

  const db = await getDb();
  const admin = await db.collection("admins").findOne({ $or: [{ email }, { username }] });
  if (!admin) return res.status(400).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return res.status(400).json({ message: "Invalid credentials" });

  const token = signAdminToken(admin.id);
  res.cookie("admin_token", token, adminCookieOptions());
  res.json({
    success: true,
    admin: {
      id: admin.id,
      name: admin.name || admin.username || admin.email,
      username: admin.username || null,
      email: admin.email,
      role: admin.role || "admin"
    }
  });
});

router.post("/logout", requireAdmin, async (req, res) => {
  await audit(req, "ADMIN_LOGOUT");
  res.clearCookie("admin_token", adminCookieOptions());
  res.json({ success: true });
});

router.get("/me", requireAdmin, async (req, res) => {
  await audit(req, "ADMIN_ME");
  res.json({
    id: req.admin.id,
    name: req.admin.name || req.admin.username || req.admin.email,
    username: req.admin.username || null,
    email: req.admin.email,
    role: req.admin.role || "admin"
  });
});

router.get("/dashboard", requireAdmin, async (req, res) => {
  const io = req.app.get("io");
  const db = await getDb();
  const totalUsers = await db.collection("users").countDocuments();
  const dbOnlineUsers = await db.collection("users").countDocuments({ status: "online" });
  const totalMessages = await db.collection("messages").countDocuments();
  const onlineUsers = liveOnlineUsersCount(io) ?? dbOnlineUsers;

  await audit(req, "VIEW_DASHBOARD");
  res.json({ totalUsers, onlineUsers, totalMessages });
});

router.get("/admins", requireAdmin, async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const db = await getDb();
  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { username: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } }
        ]
      }
    : {};

  const rows = await db.collection("admins")
    .find(filter, { projection: { id: 1, name: 1, username: 1, email: 1, role: 1, created_at: 1 } })
    .sort({ id: -1 })
    .toArray();

  await audit(req, "VIEW_ADMINS", { q });
  res.json(rows);
});

router.post("/admins", requireAdmin, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  const name = (req.body?.name || "").toString().trim();
  const username = normalizeUsername(req.body?.username);
  const password = (req.body?.password || "").toString();
  const incomingEmail = normalizeEmail(req.body?.email);
  const role = req.body?.role === "super_admin" ? "super_admin" : "admin";
  const email = incomingEmail || `${username}@anach.at`;

  if (!name) return res.status(400).json({ message: "name is required" });
  if (!username) return res.status(400).json({ message: "username is required" });
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return res.status(400).json({ message: "username must be 3-32 chars (a-z, 0-9, _, ., -)" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ message: "password must be at least 6 characters" });
  }

  const db = await getDb();
  const conflict = await db.collection("admins").findOne({ $or: [{ username }, { email }] });
  if (conflict) {
    return res.status(409).json({ message: "Admin username or email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const adminId = await getNextSequence("admins");
  const now = new Date();

  await db.collection("admins").insertOne({
    id: adminId,
    name,
    username,
    email,
    role,
    password_hash: passwordHash,
    created_at: now
  });

  const createdAdmin = await db.collection("admins").findOne({ id: adminId }, { projection: { id: 1, name: 1, username: 1, email: 1, role: 1, created_at: 1 } });

  await audit(req, "CREATE_ADMIN", {
    createdAdminId: createdAdmin.id,
    username: createdAdmin.username,
    email: createdAdmin.email,
    role: createdAdmin.role
  });

  res.status(201).json({ success: true, admin: createdAdmin });
});

router.post("/users/:id/promote", requireAdmin, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ id: userId });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const existingAdmin = await db.collection("admins").findOne({ $or: [{ email: user.email }, { username: user.mobile }, { mobile: user.mobile }] });
  if (existingAdmin) {
    return res.status(409).json({ message: "This user is already an admin" });
  }

  const generatedPassword = user.password_hash ? "" : "";
  const adminId = await getNextSequence("admins");
  const now = new Date();

  const adminDoc = {
    id: adminId,
    name: user.name || user.mobile || "Admin",
    username: user.mobile ? `user_${user.mobile}` : `user_${user.id}`,
    email: user.email || `user${user.id}@anach.at`,
    mobile: user.mobile || null,
    role: "admin",
    password_hash: user.password_hash || await bcrypt.hash(process.env.ADMIN_DEFAULT_PASSWORD, 10),
    created_at: now
  };

  await db.collection("admins").insertOne(adminDoc);

  await audit(req, "PROMOTE_USER_TO_ADMIN", { userId, adminId, username: adminDoc.username });

  res.status(201).json({ success: true, admin: {
      id: adminId,
      name: adminDoc.name,
      username: adminDoc.username,
      email: adminDoc.email,
      role: adminDoc.role
  }});
});

router.patch("/admins/:id", requireAdmin, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  const adminId = Number(req.params.id);
  if (!Number.isInteger(adminId) || adminId <= 0) {
    return res.status(400).json({ message: "Invalid admin id" });
  }

  const db = await getDb();
  const target = await db.collection("admins").findOne({ id: adminId }, { projection: { id: 1, name: 1, username: 1, email: 1, role: 1 } });
  if (!target) return res.status(404).json({ message: "Admin not found" });

  const update = {};

  if (typeof req.body?.name === "string") {
    const name = req.body.name.trim();
    if (!name) return res.status(400).json({ message: "name cannot be empty" });
    update.name = name;
  }

  if (typeof req.body?.username === "string") {
    const username = normalizeUsername(req.body.username);
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      return res.status(400).json({ message: "username must be 3-32 chars (a-z, 0-9, _, ., -)" });
    }
    if (username !== target.username) {
      const conflictUsername = await db.collection("admins").findOne({ username, id: { $ne: adminId } });
      if (conflictUsername) {
        return res.status(409).json({ message: "Admin username already exists" });
      }
    }
    update.username = username;
  }

  if (typeof req.body?.role === "string") {
    const role = req.body.role === "super_admin" ? "super_admin" : "admin";
    if (target.role === "super_admin" && role !== "super_admin") {
      const count = await superAdminCount();
      if (count <= 1) {
        return res.status(400).json({ message: "Cannot demote the last super admin" });
      }
    }
    update.role = role;
  }

  if (typeof req.body?.password === "string" && req.body.password.length) {
    const password = req.body.password;
    if (password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }
    update.password_hash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  await db.collection("admins").updateOne({ id: adminId }, { $set: update });

  const updated = await db.collection("admins").findOne({ id: adminId }, { projection: { id: 1, name: 1, username: 1, email: 1, role: 1, created_at: 1 } });

  await audit(req, "UPDATE_ADMIN", {
    targetAdminId: adminId,
    updatedFields: Object.keys(update)
  });

  res.json({ success: true, admin: updated });
});

router.delete("/admins/:id", requireAdmin, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  const adminId = Number(req.params.id);
  if (!Number.isInteger(adminId) || adminId <= 0) {
    return res.status(400).json({ message: "Invalid admin id" });
  }
  if (adminId === req.admin.id) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  const db = await getDb();
  const target = await db.collection("admins").findOne({ id: adminId }, { projection: { id: 1, username: 1, email: 1, role: 1 } });
  if (!target) return res.status(404).json({ message: "Admin not found" });

  if (target.role === "super_admin") {
    const count = await superAdminCount();
    if (count <= 1) {
      return res.status(400).json({ message: "Cannot delete the last super admin" });
    }
  }

  await db.collection("admins").deleteOne({ id: adminId });

  await audit(req, "DELETE_ADMIN", {
    deletedAdminId: adminId,
    username: target.username,
    email: target.email,
    role: target.role
  });

  res.json({ success: true });
});

router.get("/users", requireAdmin, async (req, res) => {
  const q = (req.query.q || "").toString();
  const io = req.app.get("io");
  const db = await getDb();
  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { mobile: { $regex: q, $options: "i" } }
        ]
      }
    : {};

  const rows = await db.collection("users")
    .find(filter, { projection: { id: 1, name: 1, email: 1, mobile: 1, about_bio: 1, status: 1, last_seen: 1, is_blocked: 1, is_verified: 1, created_at: 1, security_pin_hash: 1, security_pin_set_at: 1 } })
    .sort({ id: -1 })
    .toArray();

  const normalizedRows = rows.map((row) => {
    const liveOnline = !row.is_blocked && isUserOnline(io, row.id);
    return {
      ...row,
      anaSecurityPinEnabled: Boolean(row.security_pin_hash),
      anaSecurityPinSetAt: row.security_pin_set_at || null,
      security_pin_hash: undefined,
      live_online: liveOnline,
      status: row.is_blocked ? "blocked" : (liveOnline ? "online" : "offline")
    };
  });

  await audit(req, "VIEW_USERS", { q });
  res.json(normalizedRows);
});

router.post("/notify-user", requireAdmin, async (req, res) => {
  const userId = Number(req.body?.userId);
  const title = (req.body?.title || "Notification").toString().trim().slice(0, 120);
  const message = (req.body?.message || "").toString().trim().slice(0, 1000);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ message: "Valid userId required" });
  if (!message) return res.status(400).json({ message: "message required" });

  const io = req.app.get("io");
  if (io) {
    io.to(userRoom(userId)).emit("admin_notification", {
      title,
      message,
      sentAt: new Date().toISOString()
    });
  }

  const db = await getDb();
  await db.collection("admin_notifications").insertOne({
    scope: "user",
    user_id: userId,
    title,
    message,
    admin_id: req.admin.id,
    created_at: new Date()
  });

  await audit(req, "SEND_USER_NOTIFICATION", { userId, title });
  res.json({ success: true });
});

router.post("/broadcast", requireAdmin, async (req, res) => {
  const title = (req.body?.title || "Announcement").toString().trim().slice(0, 120);
  const message = (req.body?.message || "").toString().trim().slice(0, 1000);
  if (!message) return res.status(400).json({ message: "message required" });

  const io = req.app.get("io");
  if (io) {
    io.emit("admin_broadcast", {
      title,
      message,
      sentAt: new Date().toISOString()
    });
  }

  const db = await getDb();
  await db.collection("admin_notifications").insertOne({
    scope: "broadcast",
    title,
    message,
    admin_id: req.admin.id,
    created_at: new Date()
  });

  await audit(req, "SEND_BROADCAST", { title });
  res.json({ success: true });
});

router.patch("/users/:id/block", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const io = req.app.get("io");
  const db = await getDb();
  await db.collection("users").updateOne({ id: userId }, { $set: { is_blocked: true, status: "offline", last_seen: new Date() } });
  await revokeAllUserSessions(userId);
  if (io) {
    io.to(userRoom(userId)).emit("session_revoked", { reason: "blocked" });
    io.to(userRoom(userId)).disconnectSockets(true);
    io.emit("user_status", { userId, status: "offline", last_seen: new Date() });
  }

  await audit(req, "BLOCK_USER", { userId });
  res.json({ success: true });
});

router.patch("/users/:id/unblock", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const db = await getDb();
  await db.collection("users").updateOne({ id: userId }, { $set: { is_blocked: false } });

  await audit(req, "UNBLOCK_USER", { userId });
  res.json({ success: true });
});

router.post("/users/:id/force-logout", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const io = req.app.get("io");
  const db = await getDb();
  await revokeAllUserSessions(userId);
  await db.collection("users").updateOne({ id: userId }, { $set: { status: "offline", last_seen: new Date() } });
  if (io) {
    io.to(userRoom(userId)).emit("session_revoked", { reason: "force_logout" });
    io.to(userRoom(userId)).disconnectSockets(true);
    io.emit("user_status", { userId, status: "offline", last_seen: new Date() });
  }

  await audit(req, "FORCE_LOGOUT_USER", { userId });
  res.json({ success: true });
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ id: userId }, { projection: { id: 1, name: 1, email: 1 } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  await db.collection("users").deleteOne({ id: userId });

  await audit(req, "DELETE_USER", {
    deletedUserId: userId,
    name: user.name,
    email: user.email
  });

  res.json({ success: true });
});

router.get("/chats", requireAdmin, async (req, res) => {
  const q = (req.query.q || "").toString();
  const [rows] = await pool.query(
    `SELECT c.id, c.user1_id, c.user2_id, c.last_message_at,
            u1.name AS user1_name, u2.name AS user2_name
     FROM chats c
     JOIN users u1 ON u1.id = c.user1_id
     JOIN users u2 ON u2.id = c.user2_id
     WHERE (? = '' OR u1.name LIKE CONCAT('%', ?, '%') OR u2.name LIKE CONCAT('%', ?, '%'))
     ORDER BY c.last_message_at DESC, c.id DESC`,
    [q, q, q]
  );

  await audit(req, "VIEW_CHAT", { q });
  res.json(rows);
});

router.get("/chats/:chatId/messages", requireAdmin, async (req, res) => {
  const chatId = Number(req.params.chatId);
  const q = (req.query.q || "").toString();

  const [rows] = await pool.query(
    `SELECT m.*, u.name AS sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id=? AND (? = '' OR m.body LIKE CONCAT('%', ?, '%'))
     ORDER BY m.created_at ASC`,
    [chatId, q, q]
  );

  await audit(req, "VIEW_MESSAGES", { chatId, q });
  res.json(rows);
});

router.get("/audit-logs", requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT al.*, a.email AS admin_email
     FROM audit_logs al
     LEFT JOIN admins a ON a.id = al.admin_id
     ORDER BY al.id DESC
     LIMIT 500`
  );

  await audit(req, "VIEW_AUDIT_LOGS");
  res.json(rows);
});

router.get("/user-activity", requireAdmin, async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const rawType = (req.query.type || "all").toString().trim().toUpperCase();
  const typeFilter = rawType === "ALL" ? "" : rawType;
  const rawLimit = Number(req.query.limit || 500);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 1000)) : 500;

  const where = [
    `(? = '' OR actor.name LIKE CONCAT('%', ?, '%')
          OR actor.email LIKE CONCAT('%', ?, '%')
          OR actor.mobile LIKE CONCAT('%', ?, '%')
          OR target.name LIKE CONCAT('%', ?, '%')
          OR target.email LIKE CONCAT('%', ?, '%')
          OR target.mobile LIKE CONCAT('%', ?, '%'))`
  ];
  const params = [q, q, q, q, q, q, q];

  if (typeFilter) {
    where.push("ual.activity_type=?");
    params.push(typeFilter);
  }

  params.push(limit);
  const [rows] = await pool.query(
    `SELECT ual.id, ual.actor_user_id, ual.target_user_id, ual.activity_type, ual.metadata_json, ual.created_at,
            actor.name AS actor_name, actor.email AS actor_email, actor.mobile AS actor_mobile,
            target.name AS target_name, target.email AS target_email, target.mobile AS target_mobile
     FROM user_activity_logs ual
     LEFT JOIN users actor ON actor.id = ual.actor_user_id
     LEFT JOIN users target ON target.id = ual.target_user_id
     WHERE ${where.join(" AND ")}
     ORDER BY ual.id DESC
     LIMIT ?`,
    params
  );

  const payload = rows.map((row) => {
    let metadata = row.metadata_json;
    if (typeof metadata === "string") {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        // keep raw string fallback
      }
    }
    return {
      ...row,
      metadata_json: metadata || {}
    };
  });

  await audit(req, "VIEW_USER_ACTIVITY", { q, type: typeFilter || "ALL", limit });
  res.json(payload);
});

router.get("/monitoring", requireAdmin, async (req, res) => {
  const io = req.app.get("io");
  const db = await getDb();

  // Get socket monitoring data
  const socketMonitoring = io ? getSocketMonitoringData() : {
    connectionMetrics: { totalConnections: 0, activeConnections: 0, totalDisconnects: 0, totalReconnects: 0, connectionErrors: 0 },
    recentEvents: [],
    activeSockets: []
  };

  // Get database stats
  const userCount = await db.collection("users").countDocuments();
  const messageCount = await db.collection("messages").countDocuments();
  const chatCount = await db.collection("chats").countDocuments();

  // Get recent errors from database (if we add error logging)
  const recentErrors = await db.collection("error_logs")
    .find({})
    .sort({ timestamp: -1 })
    .limit(50)
    .toArray();

  // Get system health
  const health = {
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform
    },
    database: {
      connected: true, // Assume connected if we got here
      userCount,
      messageCount,
      chatCount
    },
    sockets: socketMonitoring
  };

  const socketStatus = socketMonitoring.connectionMetrics?.activeConnections > 0 ? 'online' : 'offline';

  await audit(req, "VIEW_MONITORING");
  res.json({
    health,
    socketStatus,
    recentErrors: recentErrors.map(err => ({
      id: err._id,
      type: err.type,
      message: err.message,
      stack: err.stack,
      userId: err.userId,
      path: err.path,
      method: err.method,
      timestamp: err.timestamp
    }))
  });
});

// ─────────────────────────────────────────────────────────────
// EMAIL TEMPLATES ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────

/** GET /admin/email-templates — list all templates */
router.get("/email-templates", requireAdmin, async (req, res) => {
  const { getAllTemplates } = await import("../services/emailTemplate.js");
  const templates = await getAllTemplates();
  res.json({ templates });
});

/** GET /admin/email-templates/:key — get one template */
router.get("/email-templates/:key", requireAdmin, async (req, res) => {
  const { getTemplate } = await import("../services/emailTemplate.js");
  const tpl = await getTemplate(req.params.key);
  if (!tpl) return res.status(404).json({ message: "Template not found" });
  res.json({ template: tpl });
});

/** PUT /admin/email-templates/:key — create or update a template */
router.put("/email-templates/:key", requireAdmin, async (req, res) => {
  const { upsertTemplate } = await import("../services/emailTemplate.js");
  const { query: pgQuery } = await import("../dbPostgres.js");
  const key = req.params.key;
  const fields = req.body || {};

  const updated = await upsertTemplate(key, { ...fields });
  if (!updated) return res.status(500).json({ message: "Failed to save template" });

  await audit(req, "EMAIL_TEMPLATE_EDITED", { key });
  await pgQuery(
    "INSERT INTO audit_logs (admin_id, action, metadata, ip) VALUES ($1,$2,$3,$4)",
    [req.admin?.id || null, "EMAIL_TEMPLATE_EDITED", JSON.stringify({ key }), req.ip || null]
  ).catch(() => {});

  res.json({ template: updated });
});

/** POST /admin/email-templates/test — send test email */
router.post("/email-templates/test", requireAdmin, async (req, res) => {
  const { composeEmail } = await import("../services/emailTemplate.js");
  const { sendEmail } = await import("../services/mailer.js");
  const { query: pgQuery } = await import("../dbPostgres.js");

  const { to, template_key } = req.body || {};
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ message: "A valid recipient email is required." });
  }
  if (!template_key) {
    return res.status(400).json({ message: "template_key is required." });
  }

  try {
    const { subject, html, text, replyTo } = await composeEmail(template_key, {
      user_name: "Test User",
      user_email: to,
      reset_link: "https://chat.myana.site/reset-password?token=test-token",
      expiry_time: "15 minutes"
    });

    await sendEmail({ to, subject: `[TEST] ${subject}`, html, text, replyTo });

    await pgQuery(
      "INSERT INTO audit_logs (admin_id, action, metadata, ip) VALUES ($1,$2,$3,$4)",
      [req.admin?.id || null, "TEST_EMAIL_SENT", JSON.stringify({ to, template_key }), req.ip || null]
    ).catch(() => {});

    res.json({ message: `Test email sent to ${to}` });
  } catch (err) {
    console.error("[Admin/TestEmail]", err.message);
    res.status(500).json({ message: `Failed to send test email: ${err.message}` });
  }
});

// ─────────────────────────────────────────────────────────────
// EMAIL SETTINGS ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────

/** GET /admin/email-settings */
router.get("/email-settings", requireAdmin, async (req, res) => {
  const { query: pgQuery } = await import("../dbPostgres.js");
  const result = await pgQuery("SELECT * FROM email_settings ORDER BY id DESC LIMIT 1");
  const settings = result.rows[0] || null;
  // Mask SMTP password and API key
  if (settings) {
    if (settings.smtp_pass) settings.smtp_pass = "••••••••";
    if (settings.resend_api_key) settings.resend_api_key = "re_" + "•".repeat(20);
  }
  res.json({ settings });
});

/** PUT /admin/email-settings */
router.put("/email-settings", requireAdmin, async (req, res) => {
  const { query: pgQuery } = await import("../dbPostgres.js");
  const { clearMailerCache } = await import("../services/mailer.js");

  const {
    provider, smtp_host, smtp_port, smtp_user, smtp_pass,
    smtp_encryption, sender_email, sender_name, reply_to, resend_api_key
  } = req.body || {};

  // Don't overwrite password with masked value
  const isPasswordMasked = (v) => v && v.includes("•");

  // Get current settings to preserve masked fields
  const current = await pgQuery("SELECT * FROM email_settings ORDER BY id DESC LIMIT 1");
  const cur = current.rows[0] || {};

  const finalSmtpPass = isPasswordMasked(smtp_pass) ? cur.smtp_pass || "" : (smtp_pass || "");
  const finalResendKey = isPasswordMasked(resend_api_key) ? cur.resend_api_key || "" : (resend_api_key || "");

  await pgQuery(
    `INSERT INTO email_settings
       (id, provider, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_encryption,
        sender_email, sender_name, reply_to, resend_api_key, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       provider = EXCLUDED.provider,
       smtp_host = EXCLUDED.smtp_host,
       smtp_port = EXCLUDED.smtp_port,
       smtp_user = EXCLUDED.smtp_user,
       smtp_pass = EXCLUDED.smtp_pass,
       smtp_encryption = EXCLUDED.smtp_encryption,
       sender_email = EXCLUDED.sender_email,
       sender_name = EXCLUDED.sender_name,
       reply_to = EXCLUDED.reply_to,
       resend_api_key = EXCLUDED.resend_api_key,
       updated_at = CURRENT_TIMESTAMP`,
    [
      provider || "smtp",
      smtp_host || "",
      Number(smtp_port) || 587,
      smtp_user || "",
      finalSmtpPass,
      smtp_encryption || "tls",
      sender_email || "",
      sender_name || "AnaChat",
      reply_to || "",
      finalResendKey
    ]
  );

  clearMailerCache();

  await pgQuery(
    "INSERT INTO audit_logs (admin_id, action, metadata, ip) VALUES ($1,$2,$3,$4)",
    [req.admin?.id || null, "EMAIL_SETTINGS_UPDATED", JSON.stringify({ provider }), req.ip || null]
  ).catch(() => {});

  res.json({ message: "Email settings saved." });
});

export default router;

