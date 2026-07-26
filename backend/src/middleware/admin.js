import { getDb } from "../db.js";
import { verifyToken } from "../services/tokens.js";

import { computeIsAdmin, isSuperAdminPhone } from "../models/User.js";

export async function requireAdmin(req, res, next) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const accessCookie = req.cookies?.access_token;
  const userToken = bearerToken || accessCookie;
  const adminCookie = req.cookies?.admin_token;

  const db = await getDb();

  // 1. Try verifying admin cookie first
  if (adminCookie) {
    try {
      const payload = verifyToken(adminCookie);
      if (payload.typ === "admin") {
        const admin = await db.collection("admins").findOne({ id: payload.aid }, { projection: { id: 1, name: 1, username: 1, email: 1, role: 1 } });
        if (admin) {
          req.admin = admin;
          return next();
        }
      }
    } catch (err) {
      console.warn("[requireAdmin] Admin cookie verification failed, checking user token fallback...", err.message);
    }
  }

  // 2. Try verifying user access token as fallback
  if (userToken) {
    try {
      const payload = verifyToken(userToken);
      if (payload.typ === "access") {
        const user = await db.collection("users").findOne({ id: payload.uid });
        const session = await db.collection("sessions").findOne({ id: payload.sid, user_id: payload.uid });
        if (user && session && !session.revoked_at && !user.is_blocked && user.is_verified) {
          const computedIsAdmin = computeIsAdmin(user);
          if (computedIsAdmin) {
            req.admin = {
              id: user.id,
              name: user.name,
              username: user.email ? user.email.split("@")[0] : `user_${user.id}`,
              email: user.email || "",
              role: isSuperAdminPhone(user.phone || user.mobile) ? "super_admin" : "admin"
            };
            return next();
          }
        }
      }
    } catch (err) {
      console.warn("[requireAdmin] User access token verification failed:", err.message);
    }
  }

  return res.status(401).json({ message: "Admin auth required" });
}

// RBAC for the main chat app (phone-based admin on `users` collection).
// Must be used *after* `requireUser` middleware.
export function requireAppAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!req.user.isAdmin) return res.status(403).json({ message: "Admin access required" });
  return next();
}
