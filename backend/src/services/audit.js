import { getDb } from "../db.js";

export async function writeAuditLog(adminId, action, metadata = {}) {
  const db = await getDb();
  await db.collection("audit_logs").insertOne({
    admin_id: adminId,
    action,
    metadata,
    created_at: new Date()
  });
}
