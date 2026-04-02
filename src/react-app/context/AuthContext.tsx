import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  type User,
  useAuthUser,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
} from "../hooks/useAuthApi";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  register: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  const { user, error: authError, isLoading: isAuthLoading, mutate } = useAuthUser();
  const { login: triggerLogin, isMutating: isLoggingIn } = useLoginMutation();
  const { logout: triggerLogout, isMutating: isLoggingOut } = useLogoutMutation();
  const { register: triggerRegister, isMutating: isRegistering } = useRegisterMutation();

  const loading = isAuthLoading || isLoggingIn || isRegistering || isLoggingOut;

  const checkAuth = async () => {
    setError(null);
    await mutate();
  };

  useEffect(() => {
    if (authError) {
      setError(authError.message);
    }
  }, [authError]);

  const login = async (email: string, password: string) => {
    setError(null);

    try {
      await triggerLogin(email, password);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await triggerLogout();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Logout failed";
      setError(message);
    }
  };

  const register = async (email: string, password: string) => {
    setError(null);

    try {
      const data = await triggerRegister(email, password);
      return { success: true, message: data.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, register, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
