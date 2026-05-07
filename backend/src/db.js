import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGO_DB_NAME || "chat_secure";

let client;
let db;

async function getClient() {
  if (!client) {
    client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    console.log("[MongoDB] Database connected!");
  }
  return client;
}

export async function getDb() {
  if (!db) {
    const c = await getClient();
    db = c.db(dbName);
  }
  return db;
}

export async function withDb(cb) {
  const d = await getDb();
  const result = await cb(d);
  console.log("[MongoDB] Data operation (store/fetch) executed.");
  return result;
}

export async function getNextSequence(name) {
  const d = await getDb();
  const result = await d.collection("counters").findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  console.log("[MongoDB] Sequence updated and fetched.");
  return result.value.seq;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export const mongodb = { getDb, withDb, getNextSequence, closeDb };

