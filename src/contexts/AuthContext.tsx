"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User, PageName } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  canAccess: (page: PageName) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("avp_token");
    const savedUser = localStorage.getItem("avp_user");
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setToken(savedToken);
      } catch {
        localStorage.removeItem("avp_token");
        localStorage.removeItem("avp_user");
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (data.success && data.data) {
        const { user: userData, token: tokenData } = data.data;
        setUser(userData);
        setToken(tokenData);
        localStorage.setItem("avp_token", tokenData);
        localStorage.setItem("avp_user", JSON.stringify(userData));
        return { success: true };
      }
      return { success: false, error: data.error || "Erro ao fazer login" };
    } catch {
      return { success: false, error: "Erro de conexao" };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("avp_token");
    localStorage.removeItem("avp_user");
  }, []);

  const isAdmin = user?.perfil === "Admin";

  const canAccess = useCallback(
    (page: PageName): boolean => {
      if (!user) return false;
      if (user.perfil === "Admin") return true;
      if (page === "usuarios" || page === "logs") return false;
      const permKey = page as keyof typeof user.permissoes;
      if (permKey in user.permissoes) {
        return user.permissoes[permKey];
      }
      return false;
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, canAccess, isAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
