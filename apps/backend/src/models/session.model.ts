import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  refreshTokenHash: { type: String, required: true },
  deviceId: { type: String, default: "" },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: () => new Date() },
  lastUsedAt: { type: Date, default: () => new Date() }
});

export const SessionModel = mongoose.models.Session || mongoose.model("Session", SessionSchema);
