import { createContext } from "react";
import type { User } from "../hooks/useAuthApi";

interface AuthContextType {
  user: User | null;
  authLoading: boolean;
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

export const AuthContext = createContext<AuthContextType | null>(null);
