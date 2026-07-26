import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
  notifications: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

export const SettingsModel = mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
