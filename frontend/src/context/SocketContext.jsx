import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_BASE_URL } from "../api/client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) socket.disconnect();
      setSocket(null);
      return;
    }

    let s;
    try {
      s = io(SOCKET_BASE_URL, {
        withCredentials: true,
        transports: ["websocket"]
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[socket] init failed:", err);
      setSocket(null);
      return undefined;
    }

    setSocket(s);
    return () => s.disconnect();
  }, [user]);

  const value = useMemo(() => socket, [socket]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
