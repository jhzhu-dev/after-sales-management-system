import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface AuthUser {
  username: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'auth_token';
const USERNAME_KEY = 'auth_username';
const ROLE_KEY = 'auth_role';
const API_BASE = process.env.REACT_APP_API_URL || '/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查 localStorage 中的 token
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUsername = localStorage.getItem(USERNAME_KEY);
    const storedRole = localStorage.getItem(ROLE_KEY) || 'user';
    if (storedToken && storedUsername) {
      // 验证 token 有效性
      axios
        .get(`${API_BASE}/auth/verify`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
        .then((res) => {
          setToken(storedToken);
          setUser({ username: storedUsername, role: res.data.role || storedRole });
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USERNAME_KEY);
          localStorage.removeItem(ROLE_KEY);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await axios.post(`${API_BASE}/auth/login`, { username, password });
    const { token: newToken, username: returnedUsername, role } = res.data;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USERNAME_KEY, returnedUsername);
    localStorage.setItem(ROLE_KEY, role || 'user');
    setToken(newToken);
    setUser({ username: returnedUsername, role: role || 'user' });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(ROLE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
