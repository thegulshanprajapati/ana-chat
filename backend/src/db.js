import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chat_secure";
const dbName = process.env.MONGO_DB_NAME || "chat_secure";

mongoose.set("strictQuery", false);

function buildConnectionUri() {
  const hasDatabase = /\/[^/?]+/.test(mongoUri.replace(/^mongodb(\+srv)?:\/\//, ""));
  if (hasDatabase) {
    return mongoUri;
  }
  return mongoUri.replace(/\/?$/, "") + "/" + dbName;
}

export async function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection.db;
  }

  const uri = buildConnectionUri();
  await mongoose.connect(uri, {
    autoIndex: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000
  });

  console.log("[MongoDB] Connected to database", mongoose.connection.name);
  return mongoose.connection.db;
}

export function getDb() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB is not connected. Call connectDb() before using getDb().");
  }
  return db;
}

export async function withDb(cb) {
  const d = getDb();
  const result = await cb(d);
  console.log("[MongoDB] Data operation executed.");
  return result;
}

export async function getNextSequence(name) {
  const d = getDb();
  const result = await d.collection("counters").findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return result.value.seq;
}

export async function closeDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

