import axios from "axios";

function runtimeBaseUrl(rawBaseUrl, fallbackPort = "5173", isApiUrl = false) {
  if (typeof window === "undefined") {
    return rawBaseUrl || `http://localhost:${fallbackPort}`;
  }

  const protocol = window.location.protocol || "http:";
  const hostname = window.location.hostname || "";
  const hasHost = Boolean(hostname && hostname.trim().length);
  const isFile = protocol === "file:";

  // For API URLs, if no custom URL is provided and not in localhost, use relative path
  const fallback = (!hasHost || isFile)
    ? `http://localhost:${fallbackPort}`
    : isApiUrl
      ? "/api" // Default to relative path for API
      : hostname === "localhost" || hostname === "127.0.0.1"
        ? `${protocol}//${hostname}:${fallbackPort}`
        : `${protocol}//${hostname}`;
    
  if (!rawBaseUrl) return fallback;
  if (rawBaseUrl.startsWith("/")) return rawBaseUrl.replace(/\/$/, "");

  try {
    const parsed = new URL(rawBaseUrl);
    const parsedProtocol = parsed.protocol === "ws:" ? "http:" : (parsed.protocol === "wss:" ? "https:" : parsed.protocol);
    const currentHost = window.location.hostname;
    const parsedIsLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

    // Keep frontend and backend on the same host label to avoid SameSite cookie drops
    // (localhost vs 127.0.0.1 is treated as cross-site by browsers).
    if (parsedIsLocal && parsed.hostname !== currentHost) {
      const port = parsed.port || fallbackPort;
      return `${parsedProtocol}//${currentHost}:${port}`;
    }

    if (parsedProtocol !== parsed.protocol) {
      parsed.protocol = parsedProtocol;
      return parsed.toString().replace(/\/$/, "");
    }

    return rawBaseUrl.replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

const PRODUCTION_API_FALLBACK = "https://ana-chat.onrender.com/api";
const PRODUCTION_SOCKET_FALLBACK = "https://ana-chat.onrender.com";

const rawApiUrl = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD && typeof window !== "undefined" && window.location.hostname === "chat.myana.site"
    ? PRODUCTION_API_FALLBACK
    : ""
);

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || (
  rawApiUrl ? rawApiUrl.replace(/\/api$/, "") : ""
) || (
  import.meta.env.PROD && typeof window !== "undefined" && window.location.hostname === "chat.myana.site"
    ? PRODUCTION_SOCKET_FALLBACK
    : ""
);

export const API_BASE_URL = runtimeBaseUrl(rawApiUrl, "5000", true);
export const SOCKET_BASE_URL = runtimeBaseUrl(rawSocketUrl, "5000");

const DEVICE_FINGERPRINT_KEY = "anach_device_fingerprint_v1";

function getDeviceFingerprint() {
  try {
    if (typeof localStorage !== "undefined") {
      let fingerprint = localStorage.getItem(DEVICE_FINGERPRINT_KEY);
      if (!fingerprint) {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        fingerprint = Array.from(array).map((byte) => byte.toString(16).padStart(2, "0")).join("");
        localStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint);
      }
      return fingerprint;
    }
  } catch {
    // ignore localStorage failures
  }
  return null;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

let refreshingPromise = null;

function getStoredAccessToken() {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null;
  } catch {
    return null;
  }
}

function setStoredAccessToken(token) {
  try {
    if (typeof localStorage !== "undefined" && token) {
      localStorage.setItem("access_token", token);
    }
  } catch {
    // ignore storage failures
  }
}

function clearStoredAccessToken() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("access_token");
    }
  } catch {
    // ignore storage failures
  }
}

api.interceptors.request.use((config) => {
  const fingerprint = getDeviceFingerprint();
  if (fingerprint) {
    config.headers = {
      ...config.headers,
      "x-device-fingerprint": fingerprint
    };
  }

  const authToken = getStoredAccessToken();
  if (authToken && !config.headers?.Authorization) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${authToken}`
    };
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    const token = response?.data?.accessToken;
    if (token) {
      setStoredAccessToken(token);
    }
    return response;
  },
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const url = original.url || "";
    const isAuthRequest = url.startsWith("/auth/");

    if (status !== 401 || original._retry || isAuthRequest) {
      if (status === 401 && isAuthRequest) {
        clearStoredAccessToken();
      }
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshingPromise) {
        refreshingPromise = api.post("/auth/refresh").finally(() => {
          refreshingPromise = null;
        });
      }

      const refreshResponse = await refreshingPromise;
      const refreshedToken = refreshResponse?.data?.accessToken;
      if (refreshedToken) {
        setStoredAccessToken(refreshedToken);
      }
      return api(original);
    } catch (refreshErr) {
      clearStoredAccessToken();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
      return Promise.reject(refreshErr);
    }
  }
);

export { getStoredAccessToken, setStoredAccessToken, clearStoredAccessToken };
