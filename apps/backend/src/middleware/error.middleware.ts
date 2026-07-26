import { NextFunction, Request, Response } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[Backend] Error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
}
