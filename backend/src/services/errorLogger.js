import { getDb } from "../db.js";

export async function logError(error, req = {}) {
  try {
    const db = await getDb();
    const document = {
      type: error.name || "Error",
      message: error.message || "Unknown error",
      stack: error.stack || null,
      route: req.originalUrl || req.url || null,
      method: req.method || null,
      userId: req.user?.id || null,
      headers: {
        origin: req.headers?.origin || null,
        referer: req.headers?.referer || null,
        "user-agent": req.headers?.["user-agent"] || null
      },
      body: req.body ? (typeof req.body === "object" ? req.body : null) : null,
      timestamp: new Date()
    };

    await db.collection("error_logs").insertOne(document);
  } catch (err) {
    console.error("[ErrorLogger] Failed to record error:", err?.message || err);
  }
}
