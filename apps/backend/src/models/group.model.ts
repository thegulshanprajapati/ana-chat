import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  avatarUrl: { type: String, default: "" },
  roles: { type: [String], default: ["member"] },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

export const GroupModel = mongoose.models.Group || mongoose.model("Group", GroupSchema);
