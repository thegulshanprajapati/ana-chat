import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Normalizes the user input key (PIN, Emojis, or PIN+Emoji combo)
 * to ensure consistent lookup and hashing.
 */
export function normalizeKey(key) {
  if (!key) return "";
  return String(key).trim().normalize("NFC");
}

/**
 * Generates a secure HMAC-based identifier for same-key searching.
 * This allows the database to query matching records without storing the key or its hash in a searchable way.
 */
export function generateKeyIdentifier(userId, key) {
  const normalized = normalizeKey(key);
  const secret = process.env.JWT_SECRET || "anachat_fallback_hmac_secret_key_123!";
  return crypto
    .createHmac("sha256", secret)
    .update(`${Number(userId)}:${normalized}`)
    .digest("hex");
}

/**
 * Hashes the key using bcryptjs.
 */
export function hashKey(key) {
  const normalized = normalizeKey(key);
  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(normalized, salt);
  return { hash, salt };
}

/**
 * Verifies a key against a stored bcrypt hash.
 */
export function verifyKey(key, hash) {
  const normalized = normalizeKey(key);
  try {
    return bcrypt.compareSync(normalized, hash);
  } catch (err) {
    console.error("[HiddenMessagesHelper] Verification failed:", err);
    return false;
  }
}
