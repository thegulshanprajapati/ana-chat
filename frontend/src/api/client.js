import axios from "axios";
import { useCallback, useEffect, useRef } from "react";
import {
  logTokenStored,
  logTokenFetched,
  logTokenHit,
  logTokenMiss,
  logUserLoggedOut,
  log401Detected,
  dispatchAuthLogout
} from "../utils/authLogger";

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

const PRODUCTION_API_FALLBACK = "https://api.chat.myana.site/api";
const PRODUCTION_SOCKET_FALLBACK = "https://api.chat.myana.site";

const isProductionHost = import.meta.env.PROD && typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);

const rawApiUrl = import.meta.env.VITE_API_URL || (
  isProductionHost ? PRODUCTION_API_FALLBACK : ""
);

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || (
  rawApiUrl ? rawApiUrl.replace(/\/api$/, "") : ""
) || (
  isProductionHost ? PRODUCTION_SOCKET_FALLBACK : ""
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

// Request deduplication cache
const pendingRequests = new Map();

function generateRequestKey(config) {
  return `${config.method?.toUpperCase()}_${config.url}_${JSON.stringify(config.params || {})}_${JSON.stringify(config.data || {})}`;
}

function isRequestPending(key) {
  return pendingRequests.has(key);
}

function addPendingRequest(key, abortController) {
  pendingRequests.set(key, abortController);
}

function removePendingRequest(key) {
  pendingRequests.delete(key);
}

function cancelPendingRequests() {
  pendingRequests.forEach((controller) => controller.abort());
  pendingRequests.clear();
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000, // 30 seconds timeout
  headers: {
    "Content-Type": "application/json"
  }
});

let refreshingPromise = null;

function getStoredAccessToken() {
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null;
    if (token) {
      logTokenFetched(token);
      logTokenHit(token);
    } else {
      logTokenFetched(null);
      logTokenMiss();
    }
    return token;
  } catch {
    logTokenMiss();
    return null;
  }
}

function setStoredAccessToken(token) {
  try {
    if (typeof localStorage !== "undefined" && token) {
      localStorage.setItem("access_token", token);
      logTokenStored(token);
    }
  } catch {
    console.warn("[AUTH] Failed to store access token");
  }
}

function clearStoredAccessToken() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("access_token");
      logUserLoggedOut();
    }
  } catch {
    console.warn("[AUTH] Failed to clear access token");
  }
}

// Request interceptor with deduplication
api.interceptors.request.use((config) => {
  // Add AbortController for cancellation
  const controller = new AbortController();
  config.signal = controller.signal;

  // Generate request key for deduplication
  const requestKey = generateRequestKey(config);

  // Check if request is already pending
  if (isRequestPending(requestKey)) {
    console.warn('[API] Duplicate request detected, cancelling:', requestKey);
    controller.abort();
    return config;
  }

  // Add to pending requests
  addPendingRequest(requestKey, controller);

  // Add fingerprint
  const fingerprint = getDeviceFingerprint();
  if (fingerprint) {
    config.headers = {
      ...config.headers,
      "x-device-fingerprint": fingerprint
    };
  }

  // Add auth token
  const authToken = getStoredAccessToken();
  if (authToken) {
    if (!config.headers?.Authorization) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${authToken}`
      };
    }
  } else {
    logTokenMiss();
  }

  return config;
});

// Response interceptor with retry logic
api.interceptors.response.use(
  (response) => {
    // Remove from pending requests
    const requestKey = generateRequestKey(response.config);
    removePendingRequest(requestKey);

    const token = response?.data?.accessToken;
    if (token) {
      setStoredAccessToken(token);
    }
    return response;
  },
  async (error) => {
    const original = error.config || {};
    const requestKey = generateRequestKey(original);

    // Remove from pending requests on error
    removePendingRequest(requestKey);

    const status = error.response?.status;
    const url = original.url || "";
    const isRefreshRequest = url.startsWith("/auth/refresh");
    const isAuthMeRequest = url === "/auth/me";

    // Don't retry aborted requests
    if (error.name === 'AbortError') {
      return Promise.reject(error);
    }

    // Don't retry certain requests
    if (status !== 401 || original._retry || isRefreshRequest) {
      if (status === 401) {
        log401Detected(url, error.response?.data?.message || "Unauthorized");

        // Only force a global logout for auth-state endpoints.
        // IMPORTANT: Don't logout for /auth/login failures, etc. — let the UI handle it.
        if (isRefreshRequest || isAuthMeRequest) {
          clearStoredAccessToken();
          dispatchAuthLogout("unauthorized");
        }
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
      dispatchAuthLogout("refresh_failed");
      return Promise.reject(refreshErr);
    }
  }
);

// Utility functions
export { getStoredAccessToken, setStoredAccessToken, clearStoredAccessToken, cancelPendingRequests };

// Hook for using API with loading states and cancellation
export function useApi() {
  const abortControllerRef = useRef(null);

  const makeRequest = useCallback(async (config) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new controller
    abortControllerRef.current = new AbortController();
    config.signal = abortControllerRef.current.signal;

    try {
      const response = await api(config);
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[API] Request cancelled');
        return null;
      }
      throw error;
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return { makeRequest, cancel };
}
