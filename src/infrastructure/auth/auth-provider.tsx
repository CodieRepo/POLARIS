"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { AppRole, UserContext } from "@/core/types/auth-context.types";
import { isActionPermitted, type PolarisAction } from "@/core/auth/rbac-permissions";

interface AuthContextValue {
  user: UserContext | null;
  role: AppRole | null;
  isAuthenticated: boolean;
  loading: boolean;
  can: (action: PolarisAction) => boolean;
  hasRole: (...roles: AppRole[]) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  isAuthenticated: false,
  loading: true,
  can: () => false,
  hasRole: () => false,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        if (json.authenticated && json.user) {
          setUser(json.user);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const can = useCallback(
    (action: PolarisAction): boolean => {
      if (!user || !user.role) return false;
      return isActionPermitted(user.role, action);
    },
    [user]
  );

  const hasRole = useCallback(
    (...roles: AppRole[]): boolean => {
      if (!user || !user.role) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value: AuthContextValue = {
    user,
    role: user?.role ?? null,
    isAuthenticated: !!user,
    loading,
    can,
    hasRole,
    refresh: fetchSession,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
