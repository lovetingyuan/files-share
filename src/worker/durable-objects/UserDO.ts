import { DurableObject } from "cloudflare:workers";
import type { Session, User, VerificationToken } from "../types";
import {
  generateSessionToken,
  generateVerificationToken,
  generateRootDirId,
  getSessionExpiry,
  getVerificationTokenExpiry,
} from "../utils/token";

/**
 * User Durable Object
 * One instance per email address, storing user data, sessions, and verification tokens
 */
export class UserDO extends DurableObject {
  private storage: DurableObjectStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;
  }

  /**
   * Handle fetch requests from the main worker
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case "/get-user":
          return this.handleGetUser();
        case "/create-user":
          return this.handleCreateUser(request);
        case "/verify-email":
          return this.handleVerifyEmail();
        case "/create-verification-token":
          return this.handleCreateVerificationToken(request);
        case "/consume-verification-token":
          return this.handleConsumeVerificationToken(request);
        case "/create-session":
          return this.handleCreateSession();
        case "/validate-session":
          return this.handleValidateSession(request);
        case "/delete-session":
          return this.handleDeleteSession(request);
        case "/ensure-root-dir":
          return this.handleEnsureRootDir();
        default:
          return new Response("Not Found", { status: 404 });
      }
    } catch (error) {
      console.error("UserDO error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ==================== Handlers ====================

  private async handleGetUser(): Promise<Response> {
    const user = await this.getUser();
    return new Response(JSON.stringify(user), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleCreateUser(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      email: string;
      passwordHash: string;
      salt: string;
    };
    const result = await this.createUser(body.email, body.passwordHash, body.salt);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleVerifyEmail(): Promise<Response> {
    const success = await this.verifyEmail();
    return new Response(JSON.stringify({ success }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleCreateVerificationToken(request: Request): Promise<Response> {
    const body = (await request.json()) as { type: VerificationToken["type"] };
    const token = await this.createVerificationToken(body.type);
    return new Response(JSON.stringify({ token }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleConsumeVerificationToken(request: Request): Promise<Response> {
    const body = (await request.json()) as { token: string };
    const result = await this.consumeVerificationToken(body.token);
    if (!result) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleCreateSession(): Promise<Response> {
    const session = await this.createSession();
    return new Response(JSON.stringify(session), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleValidateSession(request: Request): Promise<Response> {
    const body = (await request.json()) as { token: string };
    const session = await this.validateSession(body.token);
    const user = await this.getUser();

    if (!session) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ valid: true, user }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleDeleteSession(request: Request): Promise<Response> {
    const body = (await request.json()) as { token: string };
    await this.deleteSession(body.token);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleEnsureRootDir(): Promise<Response> {
    const rootDirId = await this.ensureRootDirId();
    return new Response(JSON.stringify({ rootDirId }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ==================== Core Methods ====================

  /**
   * Create a new user
   */
  async createUser(
    email: string,
    passwordHash: string,
    salt: string,
  ): Promise<{ success: boolean; error?: string }> {
    const existingUser = await this.storage.get<User>("user");
    if (existingUser) {
      return { success: false, error: "User already exists" };
    }

    const user: User = {
      email,
      passwordHash,
      salt,
      createdAt: Date.now(),
      verified: false,
      rootDirId: generateRootDirId(),
    };

    await this.storage.put("user", user);
    return { success: true };
  }

  /**
   * Get user data
   */
  async getUser(): Promise<User | null> {
    return (await this.storage.get<User>("user")) ?? null;
  }

  /**
   * Verify user's email
   */
  async verifyEmail(): Promise<boolean> {
    const user = await this.storage.get<User>("user");
    if (!user) {
      return false;
    }

    user.verified = true;
    await this.storage.put("user", user);
    return true;
  }

  /**
   * Ensure the user has a root directory id.
   */
  async ensureRootDirId(): Promise<string | null> {
    const user = await this.storage.get<User>("user");
    if (!user) {
      return null;
    }

    if (user.rootDirId) {
      return user.rootDirId;
    }

    user.rootDirId = generateRootDirId();
    await this.storage.put("user", user);
    return user.rootDirId;
  }

  /**
   * Create a verification token
   */
  async createVerificationToken(type: VerificationToken["type"] = "email"): Promise<string> {
    const token = generateVerificationToken();
    const verificationToken: VerificationToken = {
      token,
      type,
      createdAt: Date.now(),
      expiresAt: getVerificationTokenExpiry(),
    };

    await this.storage.put(`verify:${token}`, verificationToken);

    return token;
  }

  /**
   * Validate and consume a verification token
   */
  async consumeVerificationToken(token: string): Promise<VerificationToken | null> {
    const key = `verify:${token}`;
    const verificationToken = await this.storage.get<VerificationToken>(key);

    if (!verificationToken) {
      return null;
    }

    // Check expiry
    if (verificationToken.expiresAt < Date.now()) {
      await this.storage.delete(key);
      return null;
    }

    // Delete the token after use
    await this.storage.delete(key);
    return verificationToken;
  }

  /**
   * Create a new session
   */
  async createSession(): Promise<Session> {
    const token = generateSessionToken();
    const session: Session = {
      token,
      createdAt: Date.now(),
      expiresAt: getSessionExpiry(),
    };

    await this.storage.put(`session:${token}`, session);

    // Clean up expired sessions
    this.cleanupExpiredSessions();

    return session;
  }

  /**
   * Validate a session token
   */
  async validateSession(token: string): Promise<Session | null> {
    const key = `session:${token}`;
    const session = await this.storage.get<Session>(key);

    if (!session) {
      return null;
    }

    // Check expiry
    if (session.expiresAt < Date.now()) {
      await this.storage.delete(key);
      return null;
    }

    return session;
  }

  /**
   * Delete a session
   */
  async deleteSession(token: string): Promise<void> {
    await this.storage.delete(`session:${token}`);
  }

  /**
   * Clean up expired sessions and verification tokens
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();

    // Clean up expired sessions
    const sessionList = await this.storage.list({ prefix: "session:" });
    for (const [key, session] of sessionList) {
      if ((session as Session).expiresAt < now) {
        await this.storage.delete(key);
      }
    }

    // Clean up expired verification tokens
    const verifyList = await this.storage.list({ prefix: "verify:" });
    for (const [key, token] of verifyList) {
      if ((token as VerificationToken).expiresAt < now) {
        await this.storage.delete(key);
      }
    }
  }
}
