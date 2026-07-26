import { getDb } from "../db.js";

function truthy(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const text = (value || "").toString().trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "y";
}

async function getUserChatIds(db, userId) {
  const uid = Number(userId);
  if (!uid) return [];

  const [membershipRows, directRows] = await Promise.all([
    db.collection("chat_members")
      .find({ user_id: uid }, { projection: { _id: 0, chat_id: 1 } })
      .toArray(),
    db.collection("chats")
      .find(
        { $or: [{ user1_id: uid }, { user2_id: uid }, { created_by_user_id: uid }] },
        { projection: { _id: 0, id: 1 } }
      )
      .toArray()
  ]);

  const ids = new Set();
  membershipRows.forEach((row) => ids.add(Number(row.chat_id)));
  directRows.forEach((row) => ids.add(Number(row.id)));

  return [...ids].filter((id) => Number.isFinite(id) && id > 0);
}

export async function wipeUserChats({ userId, deleteChats }) {
  const uid = Number(userId);
  if (!uid) return { wiped: false, reason: "invalid_user_id" };
  if (!truthy(deleteChats)) return { wiped: false, reason: "delete_chats_false" };

  const db = await getDb();
  const now = new Date();
  const chatIds = await getUserChatIds(db, uid);

  // Wipe per-user message metadata & reactions so that restoring is not trivial.
  // Messages themselves are not deleted (to avoid deleting data for other participants).
  await Promise.all([
    db.collection("message_user_state").deleteMany({ user_id: uid }),
    db.collection("message_reactions").deleteMany({ user_id: uid }),
    db.collection("user_hidden_chats").deleteMany({ user_id: uid })
  ]);

  if (!chatIds.length) return { wiped: true, hiddenChats: 0 };

  // Hide all chats for this user (acts as "delete chats for me").
  await db.collection("user_hidden_chats").insertMany(
    chatIds.map((chatId) => ({ user_id: uid, chat_id: chatId, hidden_at: now })),
    { ordered: false }
  ).catch(() => {
    // ignore duplicate-key errors if any (depends on indexes in the environment)
  });

  return { wiped: true, hiddenChats: chatIds.length };
}

