import mongoose from "mongoose";
import { config } from "../../config.js";
import logger from "../logger/index.js";

const connectionOptions = {
  autoIndex: true,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 50 // Connection pool size scaled for load
};

export async function connectDatabase() {
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI is required for backend startup.");
  }

  mongoose.connection.on("connected", () => {
    logger.info("[Database] Connected to MongoDB.");
  });

  mongoose.connection.on("error", (err) => {
    logger.error("[Database] MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("[Database] MongoDB disconnected.");
  });

  await mongoose.connect(config.mongoUri, connectionOptions);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
