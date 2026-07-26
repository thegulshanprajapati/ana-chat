import { config } from "../config.js";

export const storageClient = {
  async upload(key: string, payload: string) {
    if (!config.storageBucket) {
      throw new Error("Storage bucket is not configured.");
    }
    // In production, replace with Cloudflare R2 or S3-compatible upload logic.
    console.log(`[Storage] Upload placeholder for key=${key}`);
    return `https://storage.example.com/${key}`;
  },

  async getLatestBackup(userId: string) {
    console.log(`[Storage] Lookup latest backup for ${userId}`);
    return null;
  }
};
