import path from "node:path";
import dotenv from "dotenv";
import { getDb } from "../src/db.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export async function runMigrations() {
  const db = await getDb();
  const collections = [
    "admins",
    "users",
    "sessions",
    "chats",
    "chat_members",
    "messages",
    "message_user_state",
    "message_reactions",
    "user_blocks",
    "user_hidden_chats",
    "user_chat_pin_settings",
    "audit_logs",
    "user_activity_logs",
    "counters"
  ];

  for (const name of collections) {
    const exists = await db.listCollections({ name }).hasNext();
    if (!exists) {
      await db.createCollection(name);
    }
  }

  await db.collection("admins").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ mobile: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ key: 1 }, { unique: true });
  await db.collection("chat_members").createIndex({ chat_id: 1, user_id: 1 }, { unique: true });
  await db.collection("message_reactions").createIndex({ message_id: 1, user_id: 1 }, { unique: true });
  await db.collection("user_hidden_chats").createIndex({ user_id: 1, chat_id: 1 }, { unique: true });

  console.log("Migrations complete");
}

if (process.argv[1] && process.argv[1].endsWith("dbMigrate.js")) {
  runMigrations()
    .then(() => {
      console.log("Migrations complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed", err);
      process.exit(1);
    });
}
