import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const ADMIN_TTL = process.env.ADMIN_TOKEN_TTL || "7d";

export function signAccessToken(userId, sessionId) {
  return jwt.sign({ typ: "access", uid: userId, sid: sessionId }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(userId, sessionId) {
  // Intentionally no expiry to support manual-logout-only rule.
  return jwt.sign({ typ: "refresh", uid: userId, sid: sessionId }, JWT_SECRET);
}

export function signAdminToken(adminId) {
  return jwt.sign({ typ: "admin", aid: adminId, role: "admin" }, JWT_SECRET, { expiresIn: ADMIN_TTL });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
