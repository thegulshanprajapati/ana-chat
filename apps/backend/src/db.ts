import mongoose from "mongoose";
import { config } from "./config.js";

const connectionOptions = {
  autoIndex: true,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000
};

export async function connectDatabase() {
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI is required for backend startup.");
  }

  await mongoose.connect(config.mongoUri, connectionOptions);
  console.log("[Backend] Connected to MongoDB.");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
