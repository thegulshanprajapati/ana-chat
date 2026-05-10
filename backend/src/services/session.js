import { getDb } from "../db.js";
import { signAccessToken, signRefreshToken } from "./tokens.js";
import { sha256 } from "../utils/hash.js";

const secureCookies = process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIES === "true";
const sameSitePolicy = secureCookies ? "none" : "lax";
const MAX_ACTIVE_DEVICES = Number(process.env.MAX_ACTIVE_DEVICES || 4);

const cookieOptions = {
  httpOnly: true,
  sameSite: sameSitePolicy,
  secure: secureCookies,
  path: "/"
};

export async function getActiveSessions(userId) {
  const db = await getDb();
  return db.collection("sessions")
    .find({ user_id: Number(userId), revoked_at: null })
    .sort({ last_used_at: -1 })
    .toArray();
}

async function findActiveSessionByFingerprint(userId, fingerprint) {
  if (!fingerprint) return null;
  const activeSessions = await getActiveSessions(userId);
  return activeSessions.find((session) => session.device_fingerprint === fingerprint) || null;
}

export async function revokeSessionById(userId, sessionId) {
  const db = await getDb();
  await db.collection("sessions").updateOne(
    { id: Number(sessionId), user_id: Number(userId), revoked_at: null },
    { $set: { revoked_at: new Date() } }
  );
}

function requestMeta(req) {
  return {
    fingerprint: req.headers["x-device-fingerprint"] || null,
    ip: req.ip || null,
    userAgent: req.headers["user-agent"] || null
  };
}

export function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("access_token", accessToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 15
  });
  res.cookie("refresh_token", refreshToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 365
  });
}

export function clearAuthCookies(res) {
  res.clearCookie("access_token", cookieOptions);
  res.clearCookie("refresh_token", cookieOptions);
}

export async function createSessionForUser(userId, req) {
  const meta = requestMeta(req);
  const db = await getDb();
  const existingSession = await findActiveSessionByFingerprint(userId, meta.fingerprint);
  let sessionId;

  if (existingSession) {
    sessionId = existingSession.id;
  } else {
    const activeSessions = await getActiveSessions(userId);
    if (activeSessions.length >= MAX_ACTIVE_DEVICES) {
      throw new Error("Maximum active devices reached");
    }
    sessionId = Date.now();
    await db.collection("sessions").insertOne({
      id: sessionId,
      user_id: userId,
      refresh_token_hash: "",
      device_fingerprint: meta.fingerprint,
      ip: meta.ip,
      user_agent: meta.userAgent,
      revoked_at: null,
      created_at: new Date(),
      last_used_at: new Date()
    });
  }

  const refreshToken = signRefreshToken(userId, sessionId);
  const refreshTokenHash = sha256(refreshToken);

  await db.collection("sessions").updateOne({ id: sessionId }, {
    $set: {
      refresh_token_hash: refreshTokenHash,
      last_used_at: new Date(),
      ip: meta.ip,
      user_agent: meta.userAgent,
      device_fingerprint: meta.fingerprint
    }
  });

  const accessToken = signAccessToken(userId, sessionId);

  return { sessionId, accessToken, refreshToken };
}

export async function rotateRefreshSession({ sessionId, userId, currentRefreshToken, req }) {
  const db = await getDb();
  const sessionRow = await db.collection("sessions").findOne({ id: sessionId, user_id: userId, revoked_at: null });
  if (!sessionRow) return null;

  if (sessionRow.refresh_token_hash !== sha256(currentRefreshToken)) return null;

  const nextRefreshToken = signRefreshToken(userId, sessionId);
  const nextRefreshHash = sha256(nextRefreshToken);
  const meta = requestMeta(req);

  await db.collection("sessions").updateOne({ id: sessionId }, {
    $set: {
      refresh_token_hash: nextRefreshHash,
      last_used_at: new Date(),
      ip: meta.ip,
      user_agent: meta.userAgent,
      device_fingerprint: meta.fingerprint
    }
  });

  const nextAccessToken = signAccessToken(userId, sessionId);

  return { accessToken: nextAccessToken, refreshToken: nextRefreshToken };
}

export async function revokeSessionByRefreshToken(refreshToken) {
  const refreshHash = sha256(refreshToken);
  const db = await getDb();
  await db.collection("sessions").updateMany(
    { refresh_token_hash: refreshHash, revoked_at: null },
    { $set: { revoked_at: new Date() } }
  );
}

export async function revokeAllUserSessions(userId) {
  const db = await getDb();
  await db.collection("sessions").updateMany(
    { user_id: userId, revoked_at: null },
    { $set: { revoked_at: new Date() } }
  );
}
