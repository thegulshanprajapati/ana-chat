import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { getOrCreateRsaKeyPair } from "../utils/e2ee";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get("/me");
      if (data?.id) setUser(data);
      else setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // no-op
    }
    setUser(null);
  }, []);

  useEffect(() => {
    reload();
  }, []);

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

  const value = useMemo(() => ({ user, loading, reload, logout }), [logout, reload, user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
