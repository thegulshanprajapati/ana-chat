import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback
} from "react";
import {
  initializeSocket,
  getSocket,
  subscribe,
  isConnected,
  getReconnectionStatus,
  disconnect,
  reauthenticate,
  reconnect
} from "../utils/socket";
import { useAuth } from "./AuthContext";

/**
 * ===== CRITICAL FIX 22: Socket Context with Singleton =====
 * 
 * This provider uses the global socket singleton created in utils/socket.js
 * It does NOT create or manage sockets directly - it only wraps access
 * to the singleton with React state for component re-renders.
 * 
 * Key principles:
 * - Socket is created ONCE at app startup
 * - Socket persists across page navigations and re-renders
 * - Provider only tracks connection state for React re-renders
 * - Reconnection logic is handled by socket.js, not here
 */

const SocketContext = createContext(null);

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}

const CONNECTION_STATES = {
  UNINITIALIZED: "uninitialized",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  ERROR: "error",
  RECONNECTING: "reconnecting"
};

export function SocketProvider({ children }) {
  const { user, token } = useAuth();

  // ===== CRITICAL FIX 23: Connection state (for React re-renders only) =====
  const [connectionState, setConnectionState] = useState(
    CONNECTION_STATES.UNINITIALIZED
  );
  const [reconnectionStatus, setReconnectionStatus] = useState({
    attempts: 0,
    maxAttempts: 25,
    hasReachedMax: false
  });

  // ===== CRITICAL FIX 24: Track if we've initialized =====
  const initializationRef = useRef(false);
  const unsubscribeRef = useRef(null);
  const lastTokenRef = useRef(token);

  // Update token ref when it changes
  useEffect(() => {
    lastTokenRef.current = token;
  }, [token]);

  // ===== CRITICAL FIX 25: Initialize socket only when authenticated =====
  useEffect(() => {
    if (!user) {
      disconnect();
      initializationRef.current = false;
      setConnectionState(CONNECTION_STATES.DISCONNECTED);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    if (initializationRef.current) {
      return;
    }

    initializationRef.current = true;

    const init = async () => {
      try {
        console.log("[SocketProvider] Initializing socket for user:", user.id);
        setConnectionState(CONNECTION_STATES.CONNECTING);

        await initializeSocket();

        const unsubscribe = subscribe((state) => {
          console.log("[SocketProvider] Socket state changed:", state);

          if (state === "connected") {
            setConnectionState(CONNECTION_STATES.CONNECTED);
          } else if (state === "disconnected") {
            setConnectionState(CONNECTION_STATES.DISCONNECTED);
          } else if (state === "error") {
            setConnectionState(CONNECTION_STATES.ERROR);
          } else if (state === "reconnecting") {
            setConnectionState(CONNECTION_STATES.RECONNECTING);
          }

          const status = getReconnectionStatus();
          setReconnectionStatus({
            attempts: status.reconnectAttempts,
            maxAttempts: status.maxAttempts,
            hasReachedMax: status.hasReachedMaxAttempts
          });
        });

        unsubscribeRef.current = unsubscribe;
      } catch (error) {
        console.error("[SocketProvider] Initialization error:", error);
        setConnectionState(CONNECTION_STATES.ERROR);
      }
    };

    init();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user]);

  // ===== CRITICAL FIX 26: Handle token refresh =====
  useEffect(() => {
    if (lastTokenRef.current !== token && token && isConnected()) {
      console.log("[SocketProvider] Token changed, re-authenticating");
      reauthenticate();
    }
  }, [token]);

  // ===== CRITICAL FIX 27: Cleanup on unmount =====
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // ===== CRITICAL FIX 28: Provide stable socket API =====
  const socketAPI = useMemo(() => {
    const socket = getSocket();
    if (!socket) {
      return null;
    }

    return {
      // Connection state
      isConnected: isConnected(),
      connectionState,
      reconnectionStatus,

      // Socket methods (from singleton)
      emit: (...args) => socket.emit(...args),
      on: (...args) => socket.on(...args),
      once: (...args) => socket.once(...args),
      off: (...args) => socket.off(...args),

      // Utility methods
      disconnect: () => {
        disconnect();
        setConnectionState(CONNECTION_STATES.DISCONNECTED);
      },
      reconnect: () => {
        reconnect();
        setConnectionState(CONNECTION_STATES.RECONNECTING);
      },
      reauthenticate: () => {
        reauthenticate();
      },

      // Raw socket for advanced usage
      raw: socket
    };
  }, [connectionState, reconnectionStatus]);

  return (
    <SocketContext.Provider value={socketAPI}>
      {children}
    </SocketContext.Provider>
  );
}

export default SocketProvider;
