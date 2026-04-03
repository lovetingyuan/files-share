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
