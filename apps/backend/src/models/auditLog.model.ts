import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  action: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: "" },
  createdAt: { type: Date, default: () => new Date() }
});

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
