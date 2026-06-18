import { getDb } from "../db.js";
import { verifyToken } from "../services/tokens.js";
import { computeIsAdmin, isSuperAdminPhone } from "../models/User.js";

const DEFAULT_SETTINGS = {
  compactMode: false,
  showOnlineStatus: true,
  enterToSend: true,
  soundEffects: true,
  notificationsEnabled: true
};

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

function extractToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  return req.cookies?.access_token || bearerToken || null;
}

export async function requireUser(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    console.log("[AUTH] TOKEN MISSING", {
      cookies: req.cookies,
      authorization: req.headers?.authorization
    });
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = verifyToken(token);
    console.log("[AUTH] TOKEN VERIFIED", {
      userId: payload?.uid,
      sessionId: payload?.sid,
      type: payload?.typ
    });
    if (payload.typ !== "access") {
      console.log("[AUTH] TOKEN INVALID", { reason: "Invalid token type", tokenType: payload.typ });
      return res.status(401).json({ message: "Unauthorized" });
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({ id: payload.uid });
    const session = await db.collection("sessions").findOne({ id: payload.sid, user_id: payload.uid });

    if (!user || !session || session.revoked_at) {
      return res.status(401).json({ message: "Session revoked" });
    }
    if (user.is_blocked) return res.status(403).json({ message: "User blocked" });
    if (!user.is_verified) return res.status(403).json({ message: "User not verified" });

    const normalizedPhone = (user.phone || user.mobile || "").toString().trim();
    const shouldBeSuperAdmin = isSuperAdminPhone(normalizedPhone);
    const computedIsAdmin = computeIsAdmin(user);

    const userSet = {};
    if (!user.phone && user.mobile) userSet.phone = user.mobile;
    if (shouldBeSuperAdmin && !user.is_admin) userSet.is_admin = true;
    if (Object.keys(userSet).length) {
      await db.collection("users").updateOne({ id: user.id }, { $set: userSet });
      Object.assign(user, userSet);
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      phone: user.phone || user.mobile || null,
      avatar_url: user.avatar_url,
      about_bio: user.about_bio || "",
      status: user.status,
      last_seen: user.last_seen,
      auth_provider: user.auth_provider || "local",
      generated_password: user.generated_password_plain || null,
      settings: parseSettings(user.settings_json),
      isAdmin: computedIsAdmin,
      isSuperAdmin: shouldBeSuperAdmin,
      publicKey: user.public_key || null
    };
    req.sessionId = session.id;
    next();
  } catch (err) {
    if (err?.name === "TokenExpiredError") {
      console.log("[AUTH] TOKEN EXPIRED", { message: err.message, tokenPreview: token?.slice(0, 20) });
    } else {
      console.log("[AUTH] TOKEN INVALID", { message: err.message, tokenPreview: token?.slice(0, 20) });
    }
    res.status(401).json({ message: "Invalid token" });
  }
}
