"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  subscription: string;
}

type RegisterPayload = Record<string, unknown>;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchSession(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: User | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    const u = await fetchSession();
    setUser(u);
  }, []);

  useEffect(() => {
    // Hydrate depuis /api/auth/session — le seul cookie est httpOnly + signé.
    (async () => {
      await refresh();
      setIsLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur de connexion");

    setUser(data.user);
    window.location.href = "/dashboard";
  }, []);

  const register = useCallback(async (formData: RegisterPayload) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur d'inscription");

    setUser(data.user);
    window.location.href = "/dashboard";
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        refresh,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
