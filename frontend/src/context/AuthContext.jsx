import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import client from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('saas_token'));
  const [loading, setLoading] = useState(true);

  // Restore the session on mount if a token is stored.
  useEffect(() => {
    const stored = localStorage.getItem('saas_token');
    if (!stored) {
      setLoading(false);
      return;
    }
    client
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        setToken(stored);
      })
      .catch(() => {
        localStorage.removeItem('saas_token');
        setUser(null);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await client.post('/auth/login', { email, password });
    localStorage.setItem('saas_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async ({ name, email, password, password_confirmation }) => {
    const res = await client.post('/auth/register', { name, email, password, password_confirmation });
    localStorage.setItem('saas_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    // Best-effort: the session is cleared locally no matter what.
    try {
      await client.post('/auth/logout');
    } catch {
      // Ignore — token is being discarded either way.
    }
    localStorage.removeItem('saas_token');
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
