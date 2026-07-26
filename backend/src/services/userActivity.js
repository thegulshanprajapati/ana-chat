import { getDb } from "../db.js";

export async function writeUserActivity({
  actorUserId = null,
  targetUserId = null,
  type,
  metadata = {}
}) {
  if (!type) return;
  const db = await getDb();
  await db.collection("user_activity_logs").insertOne({
    actor_user_id: actorUserId ? Number(actorUserId) : null,
    target_user_id: targetUserId ? Number(targetUserId) : null,
    activity_type: type,
    metadata_json: metadata || {},
    created_at: new Date()
  });
}
