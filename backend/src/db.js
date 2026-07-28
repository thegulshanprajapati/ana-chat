import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/anachat";
const dbName = process.env.MONGO_DB_NAME || "anachat";

let client = null;
let dbInstance = null;

export async function connectDb() {
  if (!dbInstance) {
    console.log("[MongoDB] Connecting to database...");
    client = new MongoClient(uri);
    await client.connect();
    dbInstance = client.db(dbName);
    console.log("[MongoDB] Connected successfully to database:", dbName);
  }
  return dbInstance;
}

export function getDb() {
  if (!dbInstance) {
    throw new Error("Database is not connected. Call connectDb() first.");
  }
  return dbInstance;
}

export async function withDb(cb) {
  const db = getDb();
  return await cb(db);
}

export async function getNextSequence(name) {
  const db = getDb();
  const res = await db.collection("counters").findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );
  const doc = res.value || res;
  return doc.seq;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    dbInstance = null;
    console.log("[MongoDB] Database connection closed.");
  }
}
