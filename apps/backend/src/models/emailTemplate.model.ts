import mongoose from "mongoose";

const EmailTemplateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  subject: { type: String, required: true },
  htmlContent: { type: String, default: "" },
  textContent: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

export const EmailTemplateModel = mongoose.models.EmailTemplate || mongoose.model("EmailTemplate", EmailTemplateSchema);
