function normalizeBase64(value) {
  return (value || "").toString().trim();
}

function normalizeAlg(value) {
  return (value || "").toString().trim().slice(0, 80);
}

function normalizeKeys(value) {
  if (!value || typeof value !== "object") return null;
  const out = {};
  Object.entries(value).forEach(([userId, encryptedKey]) => {
    const key = normalizeBase64(encryptedKey);
    if (key) out[String(userId)] = key;
  });
  return Object.keys(out).length ? out : null;
}

function normalizeTextPayload(value) {
  if (!value || typeof value !== "object") return null;
  const iv = normalizeBase64(value.iv);
  const ciphertext = normalizeBase64(value.ciphertext);
  if (!iv || !ciphertext) return null;
  return { iv, ciphertext };
}

function normalizeMediaPayload(value) {
  if (!value || typeof value !== "object") return null;
  const iv = normalizeBase64(value.iv);
  if (!iv) return null;
  const kind = (value.kind || "").toString().trim().slice(0, 24) || null;
  const mime = (value.mime || "").toString().trim().slice(0, 120) || null;
  const size = Number.isFinite(Number(value.size)) ? Number(value.size) : null;
  return {
    iv,
    kind,
    mime,
    size
  };
}

export function parseE2EE(raw) {
  if (!raw) return null;
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;

  const v = Number.isFinite(Number(value.v)) ? Number(value.v) : 1;
  const alg = normalizeAlg(value.alg || "RSA-OAEP-256/AES-GCM-256");
  const keys = normalizeKeys(value.keys);
  const text = normalizeTextPayload(value.text);
  const media = normalizeMediaPayload(value.media);

  if (!keys) return null;
  if (!text && !media) return null;

  return {
    v,
    alg,
    keys,
    text,
    media
  };
}

export function e2eeForUser(e2ee, userId) {
  if (!e2ee) return null;
  const key = e2ee.keys?.[String(userId)] || null;
  return {
    v: e2ee.v || 1,
    alg: e2ee.alg || "RSA-OAEP-256/AES-GCM-256",
    key,
    text: e2ee.text || null,
    media: e2ee.media || null
  };
}

