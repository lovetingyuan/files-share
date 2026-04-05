import { SHARE_DURATION_OPTIONS, type ShareDurationOption } from "../../types";
import type { AppBindings } from "../context";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const SHARE_TOKEN_VERSION = 1;

export type ShareTokenPayload = {
  v: number;
  rootDirId: string;
  path: string;
  fileName: string;
  etag: string;
  exp: number;
  expiresInSeconds: ShareDurationOption;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export function decodeBase64Url(value: string): Uint8Array {
  const padding = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + padding;
  return base64ToBytes(normalized);
}

function parseSharePayload(value: unknown): ShareTokenPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<ShareTokenPayload>;
  if (
    candidate.v !== SHARE_TOKEN_VERSION ||
    typeof candidate.rootDirId !== "string" ||
    typeof candidate.path !== "string" ||
    typeof candidate.fileName !== "string" ||
    typeof candidate.etag !== "string" ||
    typeof candidate.exp !== "number" ||
    !Number.isInteger(candidate.exp) ||
    typeof candidate.expiresInSeconds !== "number" ||
    !isShareDurationOption(candidate.expiresInSeconds)
  ) {
    return null;
  }

  return {
    v: candidate.v,
    rootDirId: candidate.rootDirId,
    path: candidate.path,
    fileName: candidate.fileName,
    etag: candidate.etag,
    exp: candidate.exp,
    expiresInSeconds: candidate.expiresInSeconds,
  };
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

async function signPayload(payload: string, secret: string): Promise<Uint8Array> {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return new Uint8Array(signature);
}

function getShareSecret(env: AppBindings): string {
  const secret = env.SHARE_LINK_SECRET;
  if (!secret) {
    throw new Error("SHARE_LINK_SECRET is not configured");
  }
  return secret;
}

export function isShareDurationOption(value: number): value is ShareDurationOption {
  return SHARE_DURATION_OPTIONS.includes(value as ShareDurationOption);
}

export function getShareExpiryTimestamp(
  expiresInSeconds: ShareDurationOption,
  now = Date.now(),
): number {
  return now + expiresInSeconds * 1000;
}

export async function createShareToken(
  env: AppBindings,
  payload: Omit<ShareTokenPayload, "v">,
): Promise<string> {
  const tokenPayload: ShareTokenPayload = {
    v: SHARE_TOKEN_VERSION,
    ...payload,
  };
  const payloadJson = JSON.stringify(tokenPayload);
  const payloadBytes = textEncoder.encode(payloadJson);
  const secret = getShareSecret(env);
  const signatureBytes = await signPayload(payloadJson, secret);

  return `${encodeBase64Url(payloadBytes)}.${encodeBase64Url(signatureBytes)}`;
}

export async function verifyShareToken(
  env: AppBindings,
  token: string,
): Promise<ShareTokenPayload | null> {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature || token.split(".").length !== 2) {
    return null;
  }

  try {
    const payloadBytes = decodeBase64Url(encodedPayload);
    const signatureBytes = decodeBase64Url(encodedSignature);
    const payloadJson = textDecoder.decode(payloadBytes);
    const expectedSignature = await signPayload(payloadJson, getShareSecret(env));

    if (
      signatureBytes.byteLength !== expectedSignature.byteLength ||
      !crypto.subtle.timingSafeEqual(signatureBytes, expectedSignature)
    ) {
      return null;
    }

    return parseSharePayload(JSON.parse(payloadJson));
  } catch {
    return null;
  }
}

export function resolveAppOrigin(requestUrl: string, env: AppBindings): string {
  if (env.APP_URL) {
    try {
      return new URL(env.APP_URL).origin;
    } catch (error) {
      console.warn("APP_URL is not a valid URL:", error);
    }
  }

  return new URL(requestUrl).origin;
}

export function buildSharePageUrl(origin: string, token: string): string {
  return `${origin}/share/${encodeURIComponent(token)}`;
}

export function buildShareDownloadUrl(origin: string, token: string): string {
  return `${origin}/api/share-links/${encodeURIComponent(token)}/download`;
}

export function isShareExpired(payload: ShareTokenPayload, now = Date.now()): boolean {
  return now >= payload.exp;
}
