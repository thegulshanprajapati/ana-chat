import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  contactUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, default: "" },
  createdAt: { type: Date, default: () => new Date() }
});

ContactSchema.index({ userId: 1, contactUserId: 1 }, { unique: true });

export const ContactModel = mongoose.models.Contact || mongoose.model("Contact", ContactSchema);
