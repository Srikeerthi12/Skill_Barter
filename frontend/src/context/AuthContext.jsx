import { createContext, useEffect, useMemo, useState } from 'react';
import { meApi } from '../api/auth.api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const { data } = await meApi();
        if (!cancelled) setUser(data?.user || null);
      } catch {
        if (!cancelled) setUser(null);
      }
    }
    loadMe();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      login: (newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
      },
      logout: () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      },
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
