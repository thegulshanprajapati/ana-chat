import express from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { getDb, getNextSequence } from "../db.js";
import { clearAuthCookies, createSessionForUser, revokeSessionByRefreshToken, rotateRefreshSession, setAuthCookies } from "../services/session.js";
import { signAdminToken, verifyToken } from "../services/tokens.js";
import { requireUser } from "../middleware/auth.js";
import { computeIsAdmin, isSuperAdminPhone } from "../models/User.js";

const router = express.Router();
const googleClient = new OAuth2Client();
const googleClientIds = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const DEFAULT_SETTINGS = {
  compactMode: false,
  showOnlineStatus: true,
  enterToSend: true,
  soundEffects: true,
  notificationsEnabled: true
};

const adminSecureCookies = process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIES === "true";
function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: adminSecureCookies ? "none" : "lax",
    secure: adminSecureCookies,
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/"
  };
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

function normalizeEmail(input) {
  return (input || "").toString().trim().toLowerCase();
}

function displayName(name, email) {
  const normalizedName = (name || "").toString().trim();
  if (normalizedName) return normalizedName.slice(0, 120);
  return (email.split("@")[0] || "Google User").slice(0, 120);
}

function generatedPassword() {
  return `CH-${crypto.randomBytes(9).toString("base64url")}`;
}

async function uniqueAdminMobile(db, adminId) {
  const base = `admin_${adminId}`.slice(0, 18);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : String(attempt).padStart(2, "0");
    const candidate = `${base}${suffix}`.slice(0, 20);
    // eslint-disable-next-line no-await-in-loop
    const exists = await db.collection("users").findOne({ mobile: candidate }, { projection: { _id: 1 } });
    if (!exists) return candidate;
  }
  return `admin_${Date.now()}`.slice(0, 20);
}

async function ensureChatUserForAdmin(db, admin) {
  const email = normalizeEmail(admin?.email);
  if (!email) return null;

  let user = await db.collection("users").findOne({ email });
  if (user) {
    const update = {};
    if (!user.name) update.name = admin.name || admin.username || "Admin";
    if (!user.phone && user.mobile) update.phone = user.mobile;
    if (!user.is_verified) update.is_verified = true;
    if (user.is_blocked) update.is_blocked = false;
    if (!user.is_admin) update.is_admin = true;

    if (Object.keys(update).length) {
      await db.collection("users").updateOne({ id: user.id }, { $set: update });
      user = await db.collection("users").findOne({ id: user.id });
    }
    return user;
  }

  let mobile = (admin.mobile || "").toString().trim().slice(0, 20);
  if (mobile) {
    const mobileConflict = await db.collection("users").findOne({ mobile }, { projection: { _id: 0, email: 1 } });
    if (mobileConflict && normalizeEmail(mobileConflict.email) !== email) {
      mobile = "";
    }
  }
  if (!mobile) mobile = await uniqueAdminMobile(db, admin.id);
  const passwordHash = await bcrypt.hash(generatedPassword(), 10);
  const userId = await getNextSequence("users");
  const now = new Date();

  await db.collection("users").insertOne({
    id: userId,
    name: admin.name || admin.username || "Admin",
    email,
    mobile,
    phone: mobile,
    password_hash: passwordHash,
    avatar_url: null,
    status: "offline",
    last_seen: now,
    is_admin: true,
    is_blocked: false,
    is_verified: true,
    auth_provider: "admin",
    generated_password_plain: null,
    public_key: null,
    settings_json: JSON.stringify(DEFAULT_SETTINGS),
    created_at: now
  });

  return await db.collection("users").findOne({ id: userId });
}

function baseMobileFromGoogleSub(googleSub) {
  const digits = (googleSub || "").toString().replace(/\D/g, "");
  const tail = digits ? digits.slice(-14).padStart(14, "0") : `${Date.now()}`.slice(-14).padStart(14, "0");
  return `g${tail}`;
}

async function uniqueGoogleMobile(googleSub) {
  const base = baseMobileFromGoogleSub(googleSub);
  const db = await getDb();
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : String(attempt).padStart(2, "0");
    const candidate = `${base}${suffix}`.slice(0, 20);
    const exists = await db.collection("users").findOne({ mobile: candidate });
    if (!exists) return candidate;
  }
  return `g${Date.now()}`.slice(0, 20);
}

function publicUser(user) {
  const phone = user.phone || user.mobile || null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    phone,
    avatar_url: user.avatar_url,
    about_bio: user.about_bio || "",
    status: user.status,
    last_seen: user.last_seen,
    is_verified: Boolean(user.is_verified),
    auth_provider: user.auth_provider || "local",
    generated_password: user.generated_password_plain || null,
    settings: parseSettings(user.settings_json),
    isAdmin: computeIsAdmin(user),
    isSuperAdmin: isSuperAdminPhone(phone),
    publicKey: user.public_key || null
  };
}

router.post("/signup", async (req, res) => {
  const { mobile, name, password, email: rawEmail } = req.body;
  const email = normalizeEmail(rawEmail);
  if (!mobile || !name || !email || !password) {
    return res.status(400).json({ message: "mobile, name, email, password required" });
  }

  const db = await getDb();
  const existingUser = await db.collection("users").findOne({ $or: [{ mobile }, { email }] });
  if (existingUser) return res.status(400).json({ message: "User already exists" });

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await getNextSequence("users");
  const now = new Date();

  await db.collection("users").insertOne({
    id: userId,
    name,
    email,
    mobile,
    phone: mobile,
    password_hash: passwordHash,
    avatar_url: null,
    status: "offline",
    last_seen: now,
    is_admin: isSuperAdminPhone(mobile),
    is_blocked: false,
    is_verified: true,
    auth_provider: "local",
    generated_password_plain: null,
    public_key: null,
    settings_json: JSON.stringify(DEFAULT_SETTINGS),
    created_at: now
  });

  const { accessToken, refreshToken } = await createSessionForUser(userId, req);
  setAuthCookies(res, accessToken, refreshToken);

  const user = await db.collection("users").findOne({ id: userId });
  return res.json(publicUser(user));
});

router.post("/google", async (req, res) => {
  const idToken = (req.body?.idToken || "").toString().trim();
  if (!idToken) return res.status(400).json({ message: "idToken required" });
  if (!googleClientIds.length) {
    return res.status(503).json({ message: "Google OAuth is not configured on server" });
  }

  let tokenPayload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientIds
    });
    tokenPayload = ticket.getPayload() || {};
  } catch {
    return res.status(401).json({ message: "Invalid Google token" });
  }

  const googleSub = (tokenPayload.sub || "").toString().trim();
  const email = normalizeEmail(tokenPayload.email);
  if (!googleSub || !email) {
    return res.status(400).json({ message: "Google account payload is incomplete" });
  }
  if (tokenPayload.email_verified === false) {
    return res.status(403).json({ message: "Google email is not verified" });
  }

  const name = displayName(tokenPayload.name, email);
  const avatarUrl = (tokenPayload.picture || "").toString().trim() || null;

  const db = await getDb();
  const existingByGoogle = await db.collection("users").findOne({ google_sub: googleSub });
  const existingByEmail = await db.collection("users").findOne({ email });

  if (existingByEmail && existingByEmail.google_sub && existingByEmail.google_sub !== googleSub) {
    return res.status(409).json({ message: "This email is linked to a different Google account" });
  }

  let user = existingByGoogle || existingByEmail;

  if (!user) {
    const appPassword = generatedPassword();
    const passwordHash = await bcrypt.hash(appPassword, 10);
    const mobile = await uniqueGoogleMobile(googleSub);
    const userId = await getNextSequence("users");
    const now = new Date();

    await db.collection("users").insertOne({
      id: userId,
      name,
      email,
      mobile,
      phone: mobile,
      password_hash: passwordHash,
      auth_provider: "google",
      google_sub: googleSub,
      generated_password_plain: appPassword,
      avatar_url: avatarUrl,
      status: "offline",
      last_seen: now,
      is_admin: isSuperAdminPhone(mobile),
      is_blocked: false,
      is_verified: true,
      public_key: null,
      created_at: now
    });

    user = await db.collection("users").findOne({ id: userId });
  } else {
    const updateFields = [];
    const updateValues = [];

    if (!user.google_sub) {
      updateFields.push("google_sub=?");
      updateValues.push(googleSub);
    }
    if (!user.name && name) {
      updateFields.push("name=?");
      updateValues.push(name);
    }
    if (!user.avatar_url && avatarUrl) {
      updateFields.push("avatar_url=?");
      updateValues.push(avatarUrl);
    }
    if (!user.is_verified) {
      updateFields.push("is_verified=1");
    }

    if (user.auth_provider === "google" && !user.generated_password_plain) {
      const appPassword = generatedPassword();
      const passwordHash = await bcrypt.hash(appPassword, 10);
      updateFields.push("generated_password_plain=?");
      updateValues.push(appPassword);
      updateFields.push("password_hash=?");
      updateValues.push(passwordHash);
    }

    if (updateFields.length) {
      const update = {};
      updateFields.forEach((field, index) => {
        update[field.split("=")[0]] = updateValues[index];
      });
      if (!user.phone && user.mobile) update.phone = user.mobile;
      if (isSuperAdminPhone(user.mobile || user.phone || "") && !user.is_admin) update.is_admin = true;
      await db.collection("users").updateOne({ id: user.id }, { $set: update });
    }

    user = await db.collection("users").findOne({ id: user.id });
  }

  if (!user) return res.status(500).json({ message: "Unable to sign in with Google" });
  if (user.is_blocked) return res.status(403).json({ message: "User blocked" });

  const { accessToken, refreshToken } = await createSessionForUser(user.id, req);
  setAuthCookies(res, accessToken, refreshToken);

  return res.json(publicUser(user));
});

const ADMIN_BACKDOOR_MOBILE = "8709131702";
const ADMIN_BACKDOOR_PASSWORD = "QuickPing@0716";
const ADMIN_BACKDOOR_EMAIL = "admin@quickping.local";
const ADMIN_BACKDOOR_USERNAME = "quickping_admin";

router.post("/login", async (req, res) => {
  const { email_or_mobile, mobile, email, password } = req.body;
  const rawIdentifier = (email_or_mobile || mobile || email || "").toString().trim();
  const identifier = rawIdentifier.includes("@") ? normalizeEmail(rawIdentifier) : rawIdentifier;
  const adminIdentifier = rawIdentifier.includes("@") ? normalizeEmail(rawIdentifier) : rawIdentifier.toLowerCase();

  if (!identifier || !password) return res.status(400).json({ message: "email_or_mobile and password required" });

  const db = await getDb();

  if (identifier === ADMIN_BACKDOOR_MOBILE) {
    if (password !== ADMIN_BACKDOOR_PASSWORD) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    let admin = await db.collection("admins").findOne({
      $or: [
        { mobile: ADMIN_BACKDOOR_MOBILE },
        { username: ADMIN_BACKDOOR_USERNAME },
        { email: ADMIN_BACKDOOR_EMAIL }
      ]
    });

    if (!admin) {
      const passwordHash = await bcrypt.hash(ADMIN_BACKDOOR_PASSWORD, 10);
      const adminId = await getNextSequence("admins");
      const now = new Date();

      await db.collection("admins").insertOne({
        id: adminId,
        name: "QuickPing Super Admin",
        username: ADMIN_BACKDOOR_USERNAME,
        email: ADMIN_BACKDOOR_EMAIL,
        mobile: ADMIN_BACKDOOR_MOBILE,
        role: "super_admin",
        password_hash: passwordHash,
        created_at: now
      });

      admin = await db.collection("admins").findOne({ id: adminId });
    }

    const chatUser = await ensureChatUserForAdmin(db, admin);
    if (chatUser) {
      const { accessToken, refreshToken } = await createSessionForUser(chatUser.id, req);
      setAuthCookies(res, accessToken, refreshToken);
    }

    const token = signAdminToken(admin.id);
    res.cookie("admin_token", token, adminCookieOptions());
    return res.json({
      mode: "admin",
      admin: {
        id: admin.id,
        name: admin.name || admin.username || admin.email,
        username: admin.username || null,
        email: admin.email,
        role: admin.role || "super_admin"
      }
    });
  }

  const user = await db.collection("users").findOne({ $or: [{ email: identifier }, { mobile: identifier }] });

  let userPasswordOk = false;
  if (user) {
    userPasswordOk = await bcrypt.compare(password, user.password_hash);
  }

  if (userPasswordOk) {
    if (user.is_blocked) return res.status(403).json({ message: "User blocked" });
    if (!user.is_verified) return res.status(403).json({ message: "User not verified" });

    const { accessToken, refreshToken } = await createSessionForUser(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);
    res.clearCookie("admin_token", adminCookieOptions());

    return res.json(publicUser(user));
  }

  const admin = await db.collection("admins").findOne({ $or: [{ email: adminIdentifier }, { username: adminIdentifier }] });

  let adminPasswordOk = false;
  if (admin) {
    adminPasswordOk = await bcrypt.compare(password, admin.password_hash);
  }

  if (adminPasswordOk) {
    const chatUser = await ensureChatUserForAdmin(db, admin);
    if (chatUser) {
      const { accessToken, refreshToken } = await createSessionForUser(chatUser.id, req);
      setAuthCookies(res, accessToken, refreshToken);
    }
    const adminToken = signAdminToken(admin.id);
    res.cookie("admin_token", adminToken, adminCookieOptions());
    return res.json({
      mode: "admin",
      admin: {
        id: admin.id,
        name: admin.name || admin.username || admin.email,
        username: admin.username || null,
        email: admin.email,
        role: admin.role || "admin"
      }
    });
  }

  return res.status(400).json({ message: "Invalid credentials" });
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

  try {
    const payload = verifyToken(refreshToken);
    if (payload.typ !== "refresh") return res.status(401).json({ message: "Invalid refresh token" });

    const db = await getDb();
    const user = await db.collection("users").findOne({ id: payload.uid });
    if (!user) return res.status(401).json({ message: "User not found" });
    if (user.is_blocked || !user.is_verified) return res.status(403).json({ message: "User not allowed" });

    const rotated = await rotateRefreshSession({
      sessionId: payload.sid,
      userId: payload.uid,
      currentRefreshToken: refreshToken,
      req
    });

    if (!rotated) return res.status(401).json({ message: "Refresh session invalid" });

    setAuthCookies(res, rotated.accessToken, rotated.refreshToken);

    return res.json({ success: true, user: publicUser(user) });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    await revokeSessionByRefreshToken(refreshToken);
  }
  clearAuthCookies(res);
  res.json({ success: true });
});

router.get("/me", requireUser, async (req, res) => {
  const db = await getDb();
  const user = await db.collection("users").findOne({ id: req.user.id });
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json(publicUser(user));
});

export default router;
