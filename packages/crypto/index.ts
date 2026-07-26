import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

export function createEncryptionKey() {
  return randomBytes(32).toString("hex");
}

export function encryptPayload(payload: string, hexKey: string) {
  const key = Buffer.from(hexKey, "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

export function decryptPayload(payload: string, hexKey: string) {
  const [ivHex, encryptedHex, tagHex] = payload.split(":");
  const key = Buffer.from(hexKey, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
