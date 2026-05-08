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

export const API_BASE_URL = runtimeBaseUrl(import.meta.env.VITE_API_URL, "5000", true);
export const SOCKET_BASE_URL = runtimeBaseUrl(import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api$/, ""), "5000");

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

let refreshingPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const url = original.url || "";

    const skipRefresh =
      url.startsWith("/admin") ||
      url.startsWith("/auth/login") ||
      url.startsWith("/auth/signup") ||
      url.startsWith("/auth/google") ||
      url.startsWith("/auth/refresh") ||
      url.startsWith("/auth/logout");

    if (status !== 401 || original._retry || skipRefresh) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshingPromise) {
        refreshingPromise = api.post("/auth/refresh").finally(() => {
          refreshingPromise = null;
        });
      }

      await refreshingPromise;
      return api(original);
    } catch (refreshErr) {
      return Promise.reject(refreshErr);
    }
  }
);
