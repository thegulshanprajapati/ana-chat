import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Authentication required." });

    const payload = await verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required." });
    }
    next();
  });
}
