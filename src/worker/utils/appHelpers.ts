import type { Context } from "hono";
import type { AppContext, AppBindings } from "../context";
import type { User } from "../types";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  getFolderMarkerKey,
  getFolderPrefix,
  parseMaxUploadBytes,
} from "./fileManager";
import { UploadTooLargeError } from "./response";

function appendVary(currentValue: string | null, nextValue: string): string {
  const existingValues = (currentValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!existingValues.includes(nextValue)) {
    existingValues.push(nextValue);
  }

  return existingValues.join(", ");
}

function getAllowedOrigins(c: Context<AppContext>): Set<string> {
  const allowedOrigins = new Set<string>([new URL(c.req.url).origin]);
  if (c.env.APP_URL) {
    try {
      allowedOrigins.add(new URL(c.env.APP_URL).origin);
    } catch (error) {
      console.warn("APP_URL is not a valid URL:", error);
    }
  }
  return allowedOrigins;
}

export function isAllowedOrigin(c: Context<AppContext>, origin: string): boolean {
  return getAllowedOrigins(c).has(origin);
}

export function applyCorsHeaders(headers: Headers, origin: string): void {
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  headers.set("Vary", appendVary(headers.get("Vary"), "Origin"));
}

export function getUploadLimitBytes(env: AppBindings): number {
  return parseMaxUploadBytes(env.MAX_UPLOAD_BYTES) || DEFAULT_MAX_UPLOAD_BYTES;
}

export function createUploadStream(
  body: ReadableStream<Uint8Array>,
  maxUploadBytes: number,
): ReadableStream<Uint8Array> {
  let totalBytes = 0;

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        totalBytes += chunk.byteLength;
        if (totalBytes > maxUploadBytes) {
          throw new UploadTooLargeError("File exceeds the upload size limit");
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

export async function folderExists(
  env: AppBindings,
  rootDirId: string,
  folderPath: string,
): Promise<boolean> {
  if (!folderPath) {
    return true;
  }

  const markerKey = getFolderMarkerKey(rootDirId, folderPath);
  const marker = await env.FILES_BUCKET.head(markerKey);
  if (marker) {
    return true;
  }

  const listing = await env.FILES_BUCKET.list({
    prefix: getFolderPrefix(rootDirId, folderPath),
    limit: 1,
  });

  return listing.objects.length > 0 || listing.delimitedPrefixes.length > 0;
}

export async function getFileContext(
  c: Context<AppContext>,
): Promise<{ rootDirId: string; user: User }> {
  const user = c.get("user");
  if (!user) {
    throw new Error("Authenticated user missing from context");
  }

  const stub = c.env.USER_DO.getByName(user.email);
  const rootDirId = user.rootDirId ?? (await stub.ensureRootDirId());
  if (!rootDirId) {
    throw new Error("Failed to resolve user root directory");
  }

  if (!user.rootDirId) {
    c.set("user", { ...user, rootDirId });
  }

  return { rootDirId, user: { ...user, rootDirId } };
}
