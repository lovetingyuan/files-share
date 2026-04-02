import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { User } from "../types";

/**
 * Auth context variables
 */
export type AuthVariables = {
  user: User | null;
  sessionToken: string | null;
  userEmail: string | null;
};

/**
 * Auth middleware - validates session from cookie
 */
export function authMiddleware() {
  return async (c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) => {
    const sessionToken = getCookie(c, "session_token");
    const userEmail = getCookie(c, "user_email");

    c.set("sessionToken", sessionToken ?? null);
    c.set("userEmail", userEmail ?? null);

    if (!sessionToken) {
      c.set("user", null);
      return next();
    }

    try {
      if (!userEmail) {
        c.set("user", null);
        return next();
      }

      // Get UserDO stub
      const stub = c.env.USER_DO.getByName(userEmail);
      const session = await stub.validateSession(sessionToken);

      if (session) {
        const user = await stub.getUser();
        c.set("user", user ?? null);
      } else {
        c.set("user", null);
      }
    } catch (error) {
      console.error("Auth middleware error:", error);
      c.set("user", null);
      c.set("sessionToken", null);
      c.set("userEmail", null);
    }

    return next();
  };
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export function requireAuth() {
  return async (c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }
    return next();
  };
}
