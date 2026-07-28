import { NextFunction, Request, Response } from "express";
import logger from "../shared/logger/index.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error(err, "[Backend] Express unhandled route error");
  res.status(500).json({ error: err.message || "Internal server error" });
}
