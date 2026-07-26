import { config } from "../config.js";
import { storageClient } from "./storage.service.js";

export async function uploadEncryptedBackup(userId: string, encryptedPayload: string) {
  const key = `backups/${userId}/${Date.now()}.enc`;
  const url = await storageClient.upload(key, encryptedPayload);
  return { key, url };
}

export async function fetchBackupUrl(userId: string) {
  const metadata = await storageClient.getLatestBackup(userId);
  return metadata;
}
