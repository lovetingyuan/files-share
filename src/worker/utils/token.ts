/**
 * Secure token generation utilities
 */

/**
 * Generate a cryptographically secure random token
 * @param length - Length in bytes (default 32, produces 64 hex chars)
 */
export function generateToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a session token
 */
export function generateSessionToken(): string {
  return generateToken(32);
}

/**
 * Generate a verification token
 */
export function generateVerificationToken(): string {
  return generateToken(32);
}

/**
 * Generate a stable user root directory identifier for R2 object prefixes.
 */
export function generateRootDirId(): string {
  return generateToken(16);
}

/**
 * Session duration constants
 */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const VERIFICATION_TOKEN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Calculate session expiry time
 */
export function getSessionExpiry(): number {
  return Date.now() + SESSION_DURATION_MS;
}

/**
 * Calculate verification token expiry time
 */
export function getVerificationTokenExpiry(): number {
  return Date.now() + VERIFICATION_TOKEN_DURATION_MS;
}
