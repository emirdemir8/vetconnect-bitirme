import React, { createContext, useContext, useEffect, useState } from "react";
import { api, setToken, clearToken, getToken } from "../lib/apiClient";

type Role = "vet" | "pet_owner" | "admin";

interface User {
  email: string;
  role: Role;
  full_name?: string | null;
  clinic_id?: string | null;
  clinic_name?: string | null;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (fullName: string | null) => Promise<void>;
  /** Change own password while logged in */
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  /** Pet owner: clinic membership (clinic_id ObjectId or null to clear) */
  updateClinic: (clinicId: string | null) => Promise<void>;
  /** Refresh user from /auth/me (e.g. after role approval) */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapMe(data: Record<string, unknown>): User {
  return {
    email: String(data.email),
    role: data.role as Role,
    full_name: (data.full_name as string | null | undefined) ?? null,
    clinic_id: (data.clinic_id as string | null | undefined) ?? null,
    clinic_name: (data.clinic_name as string | null | undefined) ?? null,
  };
}

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
          if (!cancelled && res.data) setUser(mapMe(res.data));
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
    setUser(mapMe(me.data));
  }

  async function register(email: string, password: string, fullName?: string) {
    await api.post("/auth/register", { email, password, full_name: fullName || undefined });
  }

  function logout() {
    clearToken();
    setUser(null);
    setTokenState(null);
  }

  async function updateProfile(fullName: string | null) {
    const res = await api.patch("/auth/me", { full_name: fullName || null });
    setUser(mapMe(res.data));
  }

  async function changePassword(oldPassword: string, newPassword: string) {
    await api.post("/auth/change-password", { old_password: oldPassword, new_password: newPassword });
  }

  async function updateClinic(clinicId: string | null) {
    const res = await api.patch("/auth/me", { clinic_id: clinicId });
    setUser(mapMe(res.data));
  }

  async function refreshUser() {
    const t = getToken();
    if (!t) return;
    const me = await api.get("/auth/me", { headers: { Authorization: `Bearer ${t}` } });
    setUser(mapMe(me.data));
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, updateProfile, changePassword, updateClinic, refreshUser }}
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
