export interface User {
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  verified: boolean;
  rootDirId?: string;
}

export interface Session {
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface VerificationToken {
  token: string;
  type: "email" | "password";
  createdAt: number;
  expiresAt: number;
}

export interface UserDOStorage {
  user: User;
  sessions: Map<string, Session>;
  verificationTokens: Map<string, VerificationToken>;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: {
    email: string;
    verified: boolean;
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type ApiResponse = AuthResponse | ErrorResponse;
