import React, { createContext, useContext, useEffect, useState } from "react";
import { api, setToken, clearToken, getToken } from "../lib/apiClient";

type Role = "vet" | "pet_owner" | "admin";

interface User {
  email: string;
  role: Role;
  full_name?: string | null;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role: Role, fullName?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (fullName: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const existing = getToken();
    setTokenState(existing);
    if (existing) {
      api
        .get("/auth/me")
        .then((res) => {
          if (!cancelled && res.data)
            setUser({ email: res.data.email, role: res.data.role, full_name: res.data.full_name ?? null });
        })
        .catch(() => {
          if (!cancelled) {
            clearToken();
            setTokenState(null);
            setUser(null);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    const t = res.data.access_token as string;
    setToken(t);
    setTokenState(t);
    const me = await api.get("/auth/me", {
      headers: { Authorization: `Bearer ${t}` },
    });
    setUser({ email: me.data.email, role: me.data.role, full_name: me.data.full_name ?? null });
  }

  async function register(email: string, password: string, role: Role, fullName?: string) {
    await api.post("/auth/register", { email, password, role, full_name: fullName || undefined });
  }

  function logout() {
    clearToken();
    setUser(null);
    setTokenState(null);
  }

  async function updateProfile(fullName: string | null) {
    const res = await api.patch("/auth/me", { full_name: fullName || null });
    setUser((prev) => (prev ? { ...prev, full_name: res.data.full_name ?? null } : null));
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}