import { getDb } from "../db.js";

async function persistBackendError(err, req) {
  try {
    const db = await getDb();
    await db.collection("error_logs").insertOne({
      type: err.type || err.name || "api_error",
      message: err.message || "Internal server error",
      stack: err.stack?.toString?.() || "",
      path: req?.path || "",
      method: req?.method || "",
      userId: req?.user?.id || req?.admin?.id || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Error Logger] Failed to persist backend error:', error?.message || error);
  }
}

export default function errorHandler(err, req, res, next) {
  console.error("[API Error]", err.stack || err);
  void persistBackendError(err, req);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    error: err.message || "Internal server error"
  });
}
