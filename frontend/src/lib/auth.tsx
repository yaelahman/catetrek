"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";

export type Business = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  role: "OWNER" | "ADMIN" | "STAFF";
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isSuperAdmin?: boolean;
  businesses: Business[];
};

type AuthContextValue = {
  user: User | null;
  business: Business | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    businessName: string;
  }) => Promise<void>;
  logout: () => void;
  setBusinessId: (id: string) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [businessId, setBusinessIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = localStorage.getItem("catetrek_token");
    if (!t) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }
    setToken(t);
    try {
      const me = await api<User>("/api/auth/me");
      setUser(me);
      const stored = localStorage.getItem("catetrek_business_id");
      const nextId =
        stored && me.businesses.some((b) => b.id === stored)
          ? stored
          : me.businesses[0]?.id || null;
      if (nextId) {
        localStorage.setItem("catetrek_business_id", nextId);
        setBusinessIdState(nextId);
      }
    } catch {
      localStorage.removeItem("catetrek_token");
      localStorage.removeItem("catetrek_business_id");
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await api<{
      token: string;
      user: Omit<User, "businesses">;
      businesses: Business[];
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("catetrek_token", data.token);
    if (data.businesses[0]) {
      localStorage.setItem("catetrek_business_id", data.businesses[0].id);
      setBusinessIdState(data.businesses[0].id);
    }
    setToken(data.token);
    setUser({ ...data.user, businesses: data.businesses });
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    businessName: string;
  }) => {
    const data = await api<{
      token: string;
      user: Omit<User, "businesses">;
      business: Business;
    }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    localStorage.setItem("catetrek_token", data.token);
    localStorage.setItem("catetrek_business_id", data.business.id);
    setToken(data.token);
    setBusinessIdState(data.business.id);
    setUser({
      ...data.user,
      businesses: [{ ...data.business, role: "OWNER" }],
    });
  };

  const logout = () => {
    localStorage.removeItem("catetrek_token");
    localStorage.removeItem("catetrek_business_id");
    setToken(null);
    setUser(null);
    setBusinessIdState(null);
  };

  const setBusinessId = (id: string) => {
    localStorage.setItem("catetrek_business_id", id);
    setBusinessIdState(id);
  };

  const business = useMemo(
    () => user?.businesses.find((b) => b.id === businessId) || null,
    [user, businessId]
  );

  const value = useMemo(
    () => ({
      user,
      business,
      token,
      loading,
      login,
      register,
      logout,
      setBusinessId,
      refresh,
    }),
    [user, business, token, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
