import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema({
  deviceId: String,
  platform: String,
  fingerprint: String,
  lastSeenAt: Date,
  userAgent: String
}, { _id: false });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile: { type: String, required: false, unique: true, sparse: true },
  passwordHash: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  publicKey: { type: String, default: "" },
  devices: { type: [DeviceSchema], default: [] },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

export const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
