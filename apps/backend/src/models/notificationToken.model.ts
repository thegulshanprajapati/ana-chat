import mongoose from "mongoose";

const NotificationTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true },
  platform: { type: String, default: "web" },
  createdAt: { type: Date, default: () => new Date() }
});

export const NotificationTokenModel = mongoose.models.NotificationToken || mongoose.model("NotificationToken", NotificationTokenSchema);
