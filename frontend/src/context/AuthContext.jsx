import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, getStoredAccessToken, clearStoredAccessToken } from "../api/client";
import {
  logUserAuthenticated,
  logUserLoggedOut,
  log401Detected,
  dispatchAuthLogout,
  onAuthLogout,
  logTokenHit,
  logTokenMiss
} from "../utils/authLogger";
import { getOrCreateRsaKeyPair } from "../utils/e2ee";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => getStoredAccessToken());
  const reloadRequestRef = useRef(0);

  const logoutLocal = useCallback(() => {
    clearStoredAccessToken();
    setToken(null);
    setUser(null);
    logUserLoggedOut();
    dispatchAuthLogout("logout");
  }, []);

  const reload = useCallback(async () => {
    const requestId = ++reloadRequestRef.current;
    setLoading(true);
    try {
      const { data } = await api.get("/auth/me");
      if (requestId !== reloadRequestRef.current) return;
      if (data?.id) {
        setUser(data);
        const storedToken = getStoredAccessToken();
        if (storedToken) {
          logTokenHit(storedToken);
          setToken(storedToken);
        } else {
          logTokenMiss();
        }
        logUserAuthenticated(data);
      } else {
        // If session lookup fails unexpectedly, avoid forcing logout unless
        // there is no existing authenticated user in memory.
        setUser((prev) => (prev?.id ? prev : null));
      }
    } catch (err) {
      if (requestId !== reloadRequestRef.current) return;
      if (err?.name === "CanceledError" || err?.name === "AbortError") {
        return;
      }
      const status = err.response?.status;
      if (status === 401) {
        log401Detected("/auth/me", err.response?.data?.message || "Unauthorized");
        // Don't auto-logout on 401. Keep the last-known user until they explicitly logout.
        setUser((prev) => (prev?.id ? prev : null));
      } else {
        setUser(null);
      }
    } finally {
      if (requestId === reloadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [logoutLocal]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // no-op
    }
    logoutLocal();
  }, [logoutLocal]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const unsubscribe = onAuthLogout((event) => {
      const reason = event?.detail?.reason || "";
      // Only honor explicit user-initiated logout.
      if (reason !== "logout") {
        console.warn("[AUTH] Logout event ignored (non-user initiated):", reason);
        return;
      }

      // logoutLocal() already cleared local state before dispatching this event.
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.href = "/";
      }
    });
    return () => unsubscribe();
  }, [logoutLocal]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let canceled = false;

    async function ensureE2EEKeys() {
      try {
        const { publicJwk } = await getOrCreateRsaKeyPair(user.id);
        const serverKey = user.publicKey;
        const same =
          serverKey
          && publicJwk
          && serverKey.kty === publicJwk.kty
          && serverKey.n === publicJwk.n
          && serverKey.e === publicJwk.e;

        if (!same) {
          await api.put("/users/me/public-key", { publicKey: publicJwk });
          if (!canceled) await reload();
        }
      } catch (err) {
        console.warn("[E2EE] Key setup failed:", err);
      }
    }

    ensureE2EEKeys();
    return () => {
      canceled = true;
    };
  }, [reload, user?.id]);

  const value = useMemo(
    () => ({ user, token, loading, reload, logout }),
    [logout, reload, token, user, loading]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
