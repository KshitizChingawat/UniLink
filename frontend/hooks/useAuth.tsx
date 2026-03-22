
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  plan?: "free" | "pro";
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null; shouldRedirect?: boolean }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (email: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ success?: boolean; error?: Error }>;
  updateProfile: (profile: Partial<User>) => Promise<void>;
  subscribeToPro: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const rememberedAccountsKey = "saved_login_accounts";
const settingsKey = "unilink_settings";

const applyStoredTheme = () => {
  // Dark mode is only allowed when a user is actively logged in.
  // On login / register pages (no token) always force light mode.
  const token = localStorage.getItem("auth_token");
  if (!token) {
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme-color", "blue");
    return;
  }
  const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
  const darkModeEnabled = saved.darkModeEnabled ?? false;
  const themeColor = saved.themeColor ?? "blue";
  document.documentElement.classList.toggle("dark", darkModeEnabled);
  document.documentElement.setAttribute("data-theme-color", themeColor);
};

const persistRememberedAccount = (email: string, password: string) => {
  const existing = JSON.parse(localStorage.getItem(rememberedAccountsKey) || "[]") as Array<{
    email: string;
    password: string;
    lastUsed: string;
  }>;

  const filtered = existing.filter((account) => account.email !== email);
  filtered.unshift({
    email,
    password,
    lastUsed: new Date().toISOString(),
  });

  localStorage.setItem(rememberedAccountsKey, JSON.stringify(filtered.slice(0, 5)));
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const bootstrap = async () => {
      applyStoredTheme();
      const token = localStorage.getItem("auth_token");
      const userData = localStorage.getItem("user_data");

      if (!token) {
        setLoading(false);
        return;
      }

      if (userData) {
        try {
          setUser(JSON.parse(userData));
        } catch {
          localStorage.removeItem("user_data");
        }
      }

      try {
        const data = await apiFetch<{ user: User }>("/api/auth/me");
        setUser(data.user);
        localStorage.setItem("user_data", JSON.stringify(data.user));
      } catch {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_data");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const persistRememberedEmail = (email: string, rememberMe: boolean) => {
    if (rememberMe) {
      localStorage.setItem("remembered_email", email);
      localStorage.setItem("remember-me", "true");
      return;
    }

    localStorage.removeItem("remembered_email");
    localStorage.removeItem("remember-me");
  };

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      const data = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe }),
      });

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_data", JSON.stringify(data.user));
      persistRememberedEmail(email, rememberMe);
      if (rememberMe) {
        persistRememberedAccount(email, password);
      }

      setUser(data.user);
      setTimeout(() => navigate("/dashboard"), 100);
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Sign in failed");
      if (err instanceof ApiError && err.message === "Invalid credentials") {
        toast.error("Invalid email or password. Please try again or sign up.");
        return { error, shouldRedirect: false };
      }
      toast.error(error.message || "Sign in failed");
      return { error };
    }
  };

  const signInWithGoogle = async (email: string, rememberMe: boolean = true) => {
    try {
      const data = await apiFetch<{ token: string; user: User }>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ email, rememberMe }),
      });

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_data", JSON.stringify(data.user));
      persistRememberedEmail(email, rememberMe);
      setUser(data.user);
      toast.success("Signed in with Google successfully!");
      setTimeout(() => navigate("/dashboard"), 100);
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Google sign-in failed");
      toast.error(error.message || "Google sign-in failed");
      return { error };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const data = await apiFetch<{ token?: string; user?: User; error?: string; duplicateEmail?: boolean }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      if (data.duplicateEmail || !data.token || !data.user) {
        const error = new Error(data.error || "Registration failed");
        toast.error(
          data.error === "Email is already registered"
            ? "This email is already registered. Please sign in instead."
            : data.error || "Registration failed",
        );
        return { error };
      }

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_data", JSON.stringify(data.user));
      setUser(data.user);
      toast.success("Account created and signed in successfully!");
      setTimeout(() => navigate("/dashboard"), 100);
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Registration failed");
      toast.error(error.message || "Sign up failed");
      return { error };
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_data");
      localStorage.removeItem(settingsKey);
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme-color", "blue");
      setUser(null);
      toast.success("Signed out successfully");
      navigate("/login");
      return { success: true };
    } catch (error: any) {
      toast.error("Sign out failed");
      return { error };
    }
  };

  const updateProfile = async (profile: Partial<User>) => {
    const current = user;
    if (!current) return;

    const next = { ...current, ...profile };
    setUser(next);
    localStorage.setItem("user_data", JSON.stringify(next));

    try {
      const data = await apiFetch<{ user: User }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(profile),
      });
      setUser(data.user);
      localStorage.setItem("user_data", JSON.stringify(data.user));
    } catch (error) {
      setUser(current);
      localStorage.setItem("user_data", JSON.stringify(current));
      throw error instanceof Error ? error : new Error("Failed to update profile");
    }
  };

  const subscribeToPro = async () => {
    try {
      const data = await apiFetch<{ user: User; message?: string }>("/api/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({ plan: "pro" }),
      });

      setUser(data.user);
      localStorage.setItem("user_data", JSON.stringify(data.user));
      toast.success(data.message || "Pro activated successfully!");
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to activate Pro");
      toast.error(error.message || "Failed to activate Pro");
      return { error };
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      updateProfile,
      subscribeToPro,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
