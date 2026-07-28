import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";

// Lazy import all socket utilities inside functions to avoid TDZ/scope-shadowing
// when Vite/Rollup minifies the bundle. This is the only safe pattern.
async function getSocketUtils() {
  return await import("../utils/socket");
}

const SocketContext = createContext(null);

export function useSocket() {
  // Return null instead of throwing — consumers must handle null safely
  return useContext(SocketContext);
}

const CONNECTION_STATES = {
  UNINITIALIZED: "uninitialized",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  ERROR: "error",
  RECONNECTING: "reconnecting",
};

export function SocketProvider({ children }) {
  const { user, token } = useAuth();

  const [connectionState, setConnectionState] = useState(
    CONNECTION_STATES.UNINITIALIZED
  );
  const [reconnectionStatus, setReconnectionStatus] = useState({
    attempts: 0,
    maxAttempts: 25,
    hasReachedMax: false,
  });

  const initializationRef = useRef(false);
  const unsubscribeRef = useRef(null);
  const lastTokenRef = useRef(token);
  const socketUtilsRef = useRef(null);

  // Pre-load socket utils once
  useEffect(() => {
    getSocketUtils().then((utils) => {
      socketUtilsRef.current = utils;
    });
  }, []);

  // Update token ref when it changes
  useEffect(() => {
    lastTokenRef.current = token;
  }, [token]);

  // Initialize socket when user logs in, cleanup on logout
  useEffect(() => {
    if (!user) {
      // Cleanup on logout
      initializationRef.current = false;
      setConnectionState(CONNECTION_STATES.DISCONNECTED);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (socketUtilsRef.current) {
        socketUtilsRef.current.disconnect();
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

        const utils = await getSocketUtils();
        socketUtilsRef.current = utils;

        await utils.initializeSocket();

        const unsubscribe = utils.subscribe((state) => {
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

          const status = utils.getReconnectionStatus();
          setReconnectionStatus({
            attempts: status.reconnectAttempts,
            maxAttempts: status.maxAttempts,
            hasReachedMax: status.hasReachedMaxAttempts,
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

  // Re-authenticate on token change
  useEffect(() => {
    if (!socketUtilsRef.current) return;
    const utils = socketUtilsRef.current;
    if (lastTokenRef.current !== token && token && utils.isConnected()) {
      console.log("[SocketProvider] Token changed, re-authenticating");
      utils.reauthenticate();
    }
  }, [token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Build the stable API object
  const socketAPI = useMemo(() => {
    const utils = socketUtilsRef.current;
    const rawSocket = utils ? utils.getSocket() : null;

    return {
      isConnected: utils ? utils.isConnected() : false,
      connectionState,
      reconnectionStatus,

      emit: (...args) => rawSocket?.emit?.(...args),
      on: (...args) => rawSocket?.on?.(...args),
      once: (...args) => rawSocket?.once?.(...args),
      off: (...args) => rawSocket?.off?.(...args),

      joinRoom: (room) => {
        console.log("[SocketProvider] joinRoom", room);
        utils?.joinRoom?.(room);
      },
      leaveRoom: (room) => {
        console.log("[SocketProvider] leaveRoom", room);
        utils?.leaveRoom?.(room);
      },

      disconnect: () => {
        utils?.disconnect?.();
        setConnectionState(CONNECTION_STATES.DISCONNECTED);
      },
      reconnect: () => {
        utils?.reconnect?.();
        setConnectionState(CONNECTION_STATES.RECONNECTING);
      },
      reauthenticate: () => {
        utils?.reauthenticate?.();
      },

      raw: rawSocket,
    };
  }, [connectionState, reconnectionStatus]);

  return (
    <SocketContext.Provider value={socketAPI}>
      {children}
    </SocketContext.Provider>
  );
}

export default SocketProvider;
