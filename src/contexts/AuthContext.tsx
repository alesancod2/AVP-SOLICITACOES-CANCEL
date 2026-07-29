"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, PageName } from "@/lib/types";
import type { Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  canAccess: (page: PageName) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  // Fetch user profile from the usuarios table
  const fetchUserProfile = useCallback(async (session: Session) => {
    try {
      const response = await fetch("/api/auth", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setUser(data.data);
        setToken(session.access_token);
      } else {
        // User is authenticated but not registered in our system
        setUser(null);
        setToken(null);
      }
    } catch {
      setUser(null);
      setToken(null);
    }
  }, []);

  // Initialize: check for existing session
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetchUserProfile(session);
        }
      } catch {
        // No session
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          await fetchUserProfile(session);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setToken(null);
        } else if (event === "TOKEN_REFRESHED" && session) {
          setToken(session.access_token);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Mensagens amigaveis em portugues
        if (error.message.includes("Invalid login")) {
          return { success: false, error: "Email ou senha incorretos" };
        }
        if (error.message.includes("Email not confirmed")) {
          return { success: false, error: "Email nao confirmado. Verifique sua caixa de entrada." };
        }
        return { success: false, error: error.message };
      }

      if (data.session) {
        await fetchUserProfile(data.session);
      }

      return { success: true };
    } catch {
      return { success: false, error: "Erro de conexao" };
    }
  }, [supabase.auth, fetchUserProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setToken(null);
  }, [supabase.auth]);

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
