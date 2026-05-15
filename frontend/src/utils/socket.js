import { io } from "socket.io-client";
import { getStoredAccessToken } from "../api/client";
import { logSocketTokenAttached, log401Detected, dispatchAuthLogout } from "./authLogger";

/**
 * ===== CRITICAL FIX: Singleton Socket Instance =====
 * 
 * This module creates a single, persistent Socket.IO instance
 * that is NOT managed by React. This prevents socket recreation
 * on component re-renders, which causes connection floods.
 * 
 * The socket is created ONCE at module load time, and reused
 * throughout the application lifecycle.
 * 
 * Reconnection is handled manually with exponential backoff,
 * not by Socket.IO's automatic reconnection.
 */

let socketInstance = null;
let socketPromise = null;
let initializationError = null;

// Track reconnection state
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 25; // ~5 minutes with exponential backoff
const INITIAL_RECONNECT_DELAY = 1000; // 1 second

// Callbacks for component subscriptions
const connectionListeners = new Set();

/**
 * Get the Socket.IO URL based on environment
 */
function getSocketUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:5000";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = window.location.hostname;
  
  // In development, use localhost
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const port = window.location.port || (protocol === "wss:" ? "443" : "80");
    return `${protocol.replace("ws", "http")}//${hostname}:${port}`;
  }
  
  // In production, use same host as frontend
  return `${protocol.replace("ws", "http")}//${window.location.host}`;
}

/**
 * Get authentication token
 */
/**
 * Create socket instance with production-grade configuration
 */
function createSocket(token) {
  const socketUrl = getSocketUrl();

  console.log(`[Socket] Initializing at ${socketUrl}`);
  logSocketTokenAttached(token);

  const socketConfig = {
    // ===== CRITICAL FIX 12: Connection configuration =====
    auth: {
      token: token
    },
    
    // ===== CRITICAL FIX 13: Transport configuration =====
    transports: ["websocket", "polling"],
    
    // ===== CRITICAL FIX 14: Manual reconnection control =====
    reconnection: false,        // We handle reconnection manually
    autoConnect: false,         // Don't auto-connect, we'll do it manually
    
    // ===== CRITICAL FIX 15: Socket options =====
    forceNew: false,            // Reuse existing connection
    multiplex: true,            // Allow multiple connections on same page
    
    // ===== CRITICAL FIX 16: Upgrade configuration =====
    upgrade: true,              // Upgrade from polling to websocket
    withCredentials: true,      // Send cookies with requests
    
    // ===== CRITICAL FIX 17: Timeout settings =====
    timeout: 20000,             // 20 second timeout for initial connection
    
    // ===== CRITICAL FIX 18: Reconnect settings =====
    reconnectionAttempts: 1,    // Don't let Socket.IO manage reconnects
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    
    // ===== CRITICAL FIX 19: Path consistency =====
    path: "/socket.io/",        // Must match backend/NGINX config
  };

  const socket = io(socketUrl, socketConfig);

  // ===== CRITICAL FIX 20: Error handling =====
  socket.on("connect", () => {
    console.log("[Socket] ✓ Connected successfully", { socketId: socket.id });
    reconnectAttempts = 0; // Reset on success
    notifyListeners("connected");
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] ✗ Disconnected:", reason);
    if (reason === "io client disconnect") {
      // Manual disconnect via .disconnect()
      notifyListeners("disconnected");
    } else if (reason === "io server disconnect") {
      // Server kicked us out
      console.warn("[Socket] Server forcefully disconnected (may need re-auth)");
      notifyListeners("error");
    } else {
      // Network error or other disconnection
      console.warn("[Socket] Unexpected disconnect:", reason);
      notifyListeners("disconnected");
    }
  });

  socket.on("connect_error", (error) => {
    console.error("[Socket] Connection error:", error?.message || error);
    if (typeof error?.message === "string" && /unauthorized|invalid token/i.test(error.message)) {
      log401Detected("socket_connect_error", error.message);
      dispatchAuthLogout("socket_unauthorized");
    }
    notifyListeners("error");
  });

  // Handle authentication errors
  socket.on("error", (error) => {
    console.error("[Socket] Error event:", error);
    if (typeof error?.message === "string" && /unauthorized|invalid token/i.test(error.message)) {
      log401Detected("socket_error", error.message);
      dispatchAuthLogout("socket_unauthorized");
    }
    notifyListeners("error");
  });

  // Support for older Socket.IO versions
  if (socket.io?.engine) {
    socket.io.engine.on("upgrade", (transport) => {
      console.log("[Socket] Transport upgraded to:", transport.name);
    });

    socket.io.engine.on("packet", ({ type, data }) => {
      if (type === "ping") {
        console.debug("[Socket] Ping received, sending pong");
      }
    });
  }

  return socket;
}

/**
 * Notify all listeners of connection state change
 */
function notifyListeners(state) {
  connectionListeners.forEach((listener) => {
    try {
      listener(state);
    } catch (err) {
      console.error("[Socket] Error in listener:", err);
    }
  });
}

/**
 * Calculate exponential backoff delay
 */
function getReconnectDelay() {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ...
  const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
  return delay;
}

/**
 * Attempt to reconnect with exponential backoff
 */
async function reconnect() {
  const token = getStoredAccessToken();
  if (!token) {
    console.warn("[Socket] Cannot reconnect - auth token missing");
    logSocketTokenAttached(null);
    dispatchAuthLogout("missing_socket_token");
    return false;
  }

  if (!socketInstance) {
    console.warn("[Socket] Cannot reconnect - socket not initialized");
    return false;
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`[Socket] Max reconnection attempts reached (${MAX_RECONNECT_ATTEMPTS})`);
    notifyListeners("error");
    return false;
  }

  reconnectAttempts++;
  const delay = getReconnectDelay();

  console.log(
    `[Socket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
  );

  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("[Socket] Attempting reconnection...");
      socketInstance.auth = { token };
      socketInstance.connect();
      resolve(true);
    }, delay);
  });
}

/**
 * Initialize socket (called once at app startup)
 * Returns a promise that resolves when socket is initialized
 */
export async function initializeSocket() {
  if (socketInstance) {
    console.log("[Socket] Socket already initialized");
    return socketInstance;
  }

  if (socketPromise) {
    console.log("[Socket] Socket initialization in progress, waiting...");
    return socketPromise;
  }

  const token = getStoredAccessToken();
  if (!token) {
    console.warn("[Socket] No auth token available, socket initialization aborted");
    logSocketTokenAttached(null);
    dispatchAuthLogout("missing_socket_token");
    return null;
  }

  socketPromise = (async () => {
    try {
      if (!socketInstance) {
        socketInstance = createSocket(token);

        // Wait for initial connection attempt (but don't fail if it times out)
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn("[Socket] Initial connection timeout - will retry");
            resolve(); // Don't reject, connection is happening in background
          }, 5000);

          const onConnect = () => {
            clearTimeout(timeout);
            socketInstance.off("connect", onConnect);
            socketInstance.off("connect_error", onConnectError);
            resolve();
          };

          const onConnectError = (error) => {
            console.warn("[Socket] Initial connection failed:", error?.message);
            if (typeof error?.message === "string" && /unauthorized|invalid token/i.test(error.message)) {
              log401Detected("socket_connect", error.message);
              dispatchAuthLogout("socket_unauthorized");
            }
            resolve();
          };

          socketInstance.on("connect", onConnect);
          socketInstance.on("connect_error", onConnectError);

          // ===== CRITICAL FIX 21: Manual connection trigger =====
          socketInstance.connect();
        });
      }

      return socketInstance;
    } catch (error) {
      initializationError = error;
      console.error("[Socket] Initialization error:", error);
      throw error;
    } finally {
      socketPromise = null;
    }
  })();

  return socketPromise;
}

/**
 * Export the singleton socket instance
 * Don't call this directly - use getSocket() instead
 */
export function getSocket() {
  if (!socketInstance) {
    console.warn("[Socket] Socket not yet initialized. Call initializeSocket() first.");
    return null;
  }
  return socketInstance;
}

export function resetSocket() {
  console.log("[Socket] Resetting socket connection");
  disconnect();
  socketPromise = null;
  initializationError = null;
  reconnectAttempts = 0;
}

/**
 * Subscribe to connection state changes
 */
export function subscribe(listener) {
  connectionListeners.add(listener);
  
  // Immediately notify of current state
  const currentState = socketInstance?.connected
    ? "connected"
    : "disconnected";
  listener(currentState);

  // Return unsubscribe function
  return () => {
    connectionListeners.delete(listener);
  };
}

/**
 * Get connection state
 */
export function isConnected() {
  return socketInstance?.connected ?? false;
}

/**
 * Get reconnection status
 */
export function getReconnectionStatus() {
  return {
    isConnected: socketInstance?.connected ?? false,
    reconnectAttempts,
    maxAttempts: MAX_RECONNECT_ATTEMPTS,
    hasReachedMaxAttempts: reconnectAttempts >= MAX_RECONNECT_ATTEMPTS,
    socketId: socketInstance?.id ?? null,
    error: initializationError
  };
}

/**
 * Manually disconnect
 */
export function disconnect() {
  if (socketInstance) {
    console.log("[Socket] Manually disconnecting");
    socketInstance.disconnect();
    socketInstance = null;
    reconnectAttempts = 0;
  }
}

/**
 * Reset socket (for token refresh, etc.)
 */
/**
 * Re-authenticate socket (when token refreshes)
 */
export async function reauthenticate() {
  const token = getStoredAccessToken();
  
  if (!token) {
    console.warn("[Socket] Cannot reauthenticate - token missing");
    logSocketTokenAttached(null);
    dispatchAuthLogout("missing_socket_token");
    return;
  }

  if (socketInstance) {
    socketInstance.auth = { token };
    console.log("[Socket] Re-authenticating with new token");
    
    if (socketInstance.connected) {
      socketInstance.disconnect();
    }
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    reconnectAttempts = 0; // Reset attempts for manual reauthentication
    socketInstance.connect();
  }
}

export default {
  initializeSocket,
  getSocket,
  subscribe,
  isConnected,
  getReconnectionStatus,
  disconnect,
  resetSocket,
  reauthenticate,
  reconnect
};
