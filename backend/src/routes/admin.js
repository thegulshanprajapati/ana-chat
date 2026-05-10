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
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30
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
    password_hash: user.password_hash || await bcrypt.hash("QuickPing@0716", 10),
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
    .find(filter, { projection: { id: 1, name: 1, email: 1, mobile: 1, about_bio: 1, status: 1, last_seen: 1, is_blocked: 1, is_verified: 1, created_at: 1 } })
    .sort({ id: -1 })
    .toArray();

  const normalizedRows = rows.map((row) => {
    const liveOnline = !row.is_blocked && isUserOnline(io, row.id);
    return {
      ...row,
      live_online: liveOnline,
      status: row.is_blocked ? "blocked" : (liveOnline ? "online" : "offline")
    };
  });

  await audit(req, "VIEW_USERS", { q });
  res.json(normalizedRows);
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

  await audit(req, "VIEW_MONITORING");
  res.json({
    connectionMetrics: socketMonitoring.connectionMetrics,
    recentEvents: socketMonitoring.recentEvents,
    activeSockets: socketMonitoring.activeSockets,
    health,
    recentErrors: recentErrors.map(err => ({
      id: err._id,
      type: err.type,
      message: err.message,
      stack: err.stack,
      userId: err.userId,
      timestamp: err.timestamp
    }))
  });
});

export default router;
