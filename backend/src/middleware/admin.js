import { getDb } from "../db.js";
import { verifyToken } from "../services/tokens.js";

export async function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ message: "Admin auth required" });

  try {
    const payload = verifyToken(token);
    if (payload.typ !== "admin") return res.status(401).json({ message: "Invalid admin token" });

    const db = await getDb();
    const admin = await db.collection("admins").findOne({ id: payload.aid }, { projection: { id: 1, name: 1, username: 1, email: 1, role: 1 } });
    if (!admin) return res.status(401).json({ message: "Admin not found" });

    req.admin = admin;
    next();
  } catch {
    res.status(401).json({ message: "Invalid admin token" });
  }
}

// RBAC for the main chat app (phone-based admin on `users` collection).
// Must be used *after* `requireUser` middleware.
export function requireAppAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!req.user.isAdmin) return res.status(403).json({ message: "Admin access required" });
  return next();
}
