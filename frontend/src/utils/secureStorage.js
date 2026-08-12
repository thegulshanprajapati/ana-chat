const DEVICE_FINGERPRINT_KEY = "anach_device_fingerprint_v1";

function getFingerprint() {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(DEVICE_FINGERPRINT_KEY) || "default_ana_key_seed";
    }
  } catch {
    // ignore
  }
  return "default_ana_key_seed";
}

function xorEncryptDecrypt(input, key) {
  let output = "";
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

export function secureSetItem(key, value) {
  try {
    if (typeof localStorage === "undefined") return;
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
      return;
    }
    const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
    const keySeed = getFingerprint();
    const encrypted = xorEncryptDecrypt(stringValue, keySeed);
    // Safe base64 conversion
    const base64 = btoa(
      encodeURIComponent(encrypted).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      })
    );
    localStorage.setItem(key, base64);
  } catch (err) {
    console.warn("[SecureStorage] Failed to set item:", err);
  }
}

export function secureGetItem(key) {
  try {
    if (typeof localStorage === "undefined") return null;
    const base64 = localStorage.getItem(key);
    if (!base64) return null;
    
    // Check if the value is valid Base64 and not plaintext
    // Normal JWT tokens starts with eyJ and are longer, but could fail btoa check.
    // If decryption fails, we will catch the error and fall back to raw string.
    try {
      const encrypted = decodeURIComponent(
        Array.prototype.map
          .call(atob(base64), (c) => {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      const keySeed = getFingerprint();
      const decrypted = xorEncryptDecrypt(encrypted, keySeed);
      return decrypted;
    } catch {
      // Fallback if not encoded/encrypted yet (e.g. legacy plain values)
      return base64;
    }
  } catch (err) {
    return null;
  }
}

export function secureRemoveItem(key) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn("[SecureStorage] Failed to remove item:", err);
  }
}
