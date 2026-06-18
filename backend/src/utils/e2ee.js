const DB_NAME = "anach_e2ee";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const LS_PREFIX = "anach_e2ee_keys_v1:";

const inMemoryKeyCache = new Map();

function assertWebCrypto() {
  const subtle = globalThis?.crypto?.subtle;
  if (subtle) return;

  const secureContextHint = (typeof window !== "undefined" && window && window.isSecureContext === false)
    ? "Open the app on HTTPS (or http://localhost). E2EE will not work on plain HTTP over a LAN/IP."
    : "Your browser may not support WebCrypto.";

  throw new Error(`End-to-end encryption requires WebCrypto (crypto.subtle). ${secureContextHint}`);
}

function toUserKey(userId) {
  return `${LS_PREFIX}${Number(userId)}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB not available"));

    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

async function idbGet(key) {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error || new Error("IndexedDB set failed"));
  });
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function loadStoredKeyPair(userId) {
  const key = toUserKey(userId);
  try {
    const record = await idbGet(key);
    if (record?.publicJwk && record?.privateJwk) return record;
  } catch {
    // ignore and fall back to localStorage
  }

  if (typeof localStorage === "undefined") return null;
  const parsed = safeJsonParse(localStorage.getItem(key));
  if (parsed?.publicJwk && parsed?.privateJwk) return parsed;
  return null;
}

export async function getStoredRsaKeyPair(userId) {
  return await loadStoredKeyPair(userId);
}

async function persistKeyPair(userId, record) {
  const key = toUserKey(userId);
  try {
    await idbSet(key, record);
    return;
  } catch {
    // fall back to localStorage
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(key, JSON.stringify(record));
  }
}

export async function persistRsaKeyPair(userId, record) {
  return await persistKeyPair(userId, record);
}

async function importPinKey(pin) {
  if (!pin) throw new Error("PIN is required");
  const encoded = new TextEncoder().encode(pin.toString());
  return await crypto.subtle.importKey(
    "raw",
    encoded,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
}

async function deriveKeyFromPin(pin, salt) {
  const baseKey = await importPinKey(pin);
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 250000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptPrivateKeyBackup(privateJwk, pin) {
  if (!privateJwk || typeof privateJwk !== "object") throw new Error("privateJwk required");
  if (!pin || typeof pin !== "string") throw new Error("PIN required");
  const raw = new TextEncoder().encode(JSON.stringify(privateJwk));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPin(pin, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, raw);
  return {
    v: 1,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext)
  };
}

export async function decryptPrivateKeyBackup(payload, pin) {
  if (!payload || typeof payload !== "object") throw new Error("Encrypted payload required");
  if (!pin || typeof pin !== "string") throw new Error("PIN required");
  const salt = base64ToArrayBuffer(payload.salt || "");
  const iv = base64ToArrayBuffer(payload.iv || "");
  const ciphertext = base64ToArrayBuffer(payload.ciphertext || "");
  if (!salt || !iv || !ciphertext) throw new Error("Encrypted payload is invalid");
  const key = await deriveKeyFromPin(pin, new Uint8Array(salt));
  const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, ciphertext);
  const json = new TextDecoder().decode(raw);
  return JSON.parse(json);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function randomIv() {
  assertWebCrypto();
  return crypto.getRandomValues(new Uint8Array(12));
}

async function importPublicKey(publicJwk) {
  return await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

async function importPrivateKey(privateJwk) {
  return await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
}

async function importAesKey(raw) {
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function getOrCreateRsaKeyPair(userId) {
  assertWebCrypto();
  const normalizedUserId = Number(userId);
  if (!normalizedUserId) throw new Error("userId required");

  const cached = inMemoryKeyCache.get(normalizedUserId);
  if (cached?.publicJwk && cached?.privateJwk) return cached;

  const stored = await loadStoredKeyPair(normalizedUserId);
  if (stored?.publicJwk && stored?.privateJwk) {
    inMemoryKeyCache.set(normalizedUserId, stored);
    return stored;
  }

  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["encrypt", "decrypt"]
  );

  const [publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", keyPair.publicKey),
    crypto.subtle.exportKey("jwk", keyPair.privateKey)
  ]);

  const record = { publicJwk, privateJwk, createdAt: Date.now() };
  await persistKeyPair(normalizedUserId, record);
  inMemoryKeyCache.set(normalizedUserId, record);
  return record;
}

export async function encryptOutgoingMessage({
  plaintext = "",
  file = null,
  recipients = []
}) {
  assertWebCrypto();
  const normalizedPlaintext = (plaintext || "").toString();
  const hasText = Boolean(normalizedPlaintext.trim().length);
  const hasFile = Boolean(file);
  if (!hasText && !hasFile) throw new Error("Nothing to encrypt");

  const recipientList = Array.isArray(recipients) ? recipients : [];
  if (!recipientList.length) throw new Error("Recipients required");

  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);

  const keys = {};
  await Promise.all(recipientList.map(async (entry) => {
    const userId = Number(entry?.id);
    const publicKey = entry?.publicKey;
    if (!userId) throw new Error("Recipient id required");
    if (!publicKey) throw new Error(`Missing public key for user ${userId}`);
    const cryptoPublicKey = await importPublicKey(publicKey);
    const encryptedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, cryptoPublicKey, rawAesKey);
    keys[String(userId)] = arrayBufferToBase64(encryptedKey);
  }));

  let text = null;
  if (hasText) {
    const iv = randomIv();
    const encoded = new TextEncoder().encode(normalizedPlaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoded);
    text = { iv: arrayBufferToBase64(iv), ciphertext: arrayBufferToBase64(ciphertext) };
  }

  let media = null;
  let encryptedFile = null;
  if (hasFile) {
    const iv = randomIv();
    const fileBytes = await file.arrayBuffer();
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, fileBytes);
    encryptedFile = new Blob([ciphertext], { type: "application/octet-stream" });

    const rawMime = (file.type || "").toString().trim();
    const mime = rawMime || "application/octet-stream";
    const kind = rawMime.startsWith("image/") ? "image" : (rawMime.startsWith("video/") ? "video" : "file");

    media = {
      iv: arrayBufferToBase64(iv),
      mime,
      kind,
      size: file.size
    };
  }

  return {
    e2ee: {
      v: 1,
      alg: "RSA-OAEP-256/AES-GCM-256",
      keys,
      text,
      media
    },
    encryptedFile
  };
}

export async function decryptTextFromMessage({ e2ee, privateJwk }) {
  assertWebCrypto();
  if (!e2ee?.key || !e2ee?.text?.iv || !e2ee?.text?.ciphertext) return null;

  const privateKey = await importPrivateKey(privateJwk);
  const rawAesKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToArrayBuffer(e2ee.key)
  );

  const aesKey = await importAesKey(rawAesKey);
  const plainBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(e2ee.text.iv)) },
    aesKey,
    base64ToArrayBuffer(e2ee.text.ciphertext)
  );

  return new TextDecoder().decode(plainBytes);
}

export async function decryptMediaToObjectUrl({
  e2ee,
  privateJwk,
  encryptedBytes
}) {
  assertWebCrypto();
  if (!e2ee?.key || !e2ee?.media?.iv || !encryptedBytes) return null;

  const privateKey = await importPrivateKey(privateJwk);
  const rawAesKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToArrayBuffer(e2ee.key)
  );
  const aesKey = await importAesKey(rawAesKey);

  const plainBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(e2ee.media.iv)) },
    aesKey,
    encryptedBytes
  );

  const mime = (e2ee.media.mime || "application/octet-stream").toString();
  const blob = new Blob([plainBytes], { type: mime });
  const url = URL.createObjectURL(blob);
  return { url, mime, kind: e2ee.media.kind || null, size: e2ee.media.size || null };
}

export async function reencryptAesKeyForRecipients({
  e2ee,
  privateJwk,
  recipients = []
}) {
  assertWebCrypto();
  if (!e2ee?.key) throw new Error("e2ee.key required");

  const recipientList = Array.isArray(recipients) ? recipients : [];
  if (!recipientList.length) throw new Error("Recipients required");

  const privateKey = await importPrivateKey(privateJwk);
  const rawAesKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToArrayBuffer(e2ee.key)
  );

  const keys = {};
  await Promise.all(recipientList.map(async (entry) => {
    const userId = Number(entry?.id);
    const publicKey = entry?.publicKey;
    if (!userId) throw new Error("Recipient id required");
    if (!publicKey) throw new Error(`Missing public key for user ${userId}`);
    const cryptoPublicKey = await importPublicKey(publicKey);
    const encryptedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, cryptoPublicKey, rawAesKey);
    keys[String(userId)] = arrayBufferToBase64(encryptedKey);
  }));

  return keys;
}
