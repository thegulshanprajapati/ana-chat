import mongoose from "mongoose";

const BackupMetadataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  backupKey: { type: String, required: true },
  url: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

export const BackupMetadataModel = mongoose.models.BackupMetadata || mongoose.model("BackupMetadata", BackupMetadataSchema);
