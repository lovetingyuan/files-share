import { Hono } from "hono";
import type {
  CreateShareLinkRequest,
  ShareLinkResponse,
  SharedFileMetadataResponse,
} from "../../types";
import type { AppContext } from "../context";
import { getFileContext } from "../utils/appHelpers";
import {
  FilePathValidationError,
  getBaseName,
  getFileKey,
  isReservedSystemPath,
  normalizeRelativePath,
  toContentDisposition,
} from "../utils/fileManager";
import { handlePathValidationError, jsonError } from "../utils/response";
import {
  buildShareDownloadUrl,
  buildSharePageUrl,
  createShareToken,
  getShareExpiryTimestamp,
  isShareDurationOption,
  isShareExpired,
  resolveAppOrigin,
  verifyShareToken,
} from "../utils/shareLinks";

const shares = new Hono<AppContext>();

function applyNoStoreHeaders(headers: Headers): void {
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
}

function jsonShareResponse(
  payload: ShareLinkResponse | SharedFileMetadataResponse,
  status = 200,
): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  applyNoStoreHeaders(headers);
  return new Response(JSON.stringify(payload), { status, headers });
}

function jsonShareError(message: string, status: number): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  applyNoStoreHeaders(headers);
  return new Response(JSON.stringify({ success: false, error: message }), { status, headers });
}

function assertPathNotReserved(path: string): void {
  if (isReservedSystemPath(path)) {
    throw new FilePathValidationError("Path uses a reserved system directory", 403);
  }
}

shares.post("/api/files/share-links", async (c) => {
  try {
    const body = await c.req.json<CreateShareLinkRequest>();
    const path = normalizeRelativePath(body.path, { allowEmpty: false, label: "Path" });
    assertPathNotReserved(path);

    if (!isShareDurationOption(body.expiresInSeconds)) {
      return jsonError(c, "Invalid share duration", 400);
    }

    const { rootDirId } = await getFileContext(c);
    const object = await c.env.FILES_BUCKET.head(getFileKey(rootDirId, path));
    if (!object) {
      return jsonError(c, "File not found", 404);
    }

    const fileName = object.customMetadata?.originalName ?? getBaseName(path);
    const expiresAtTimestamp = getShareExpiryTimestamp(body.expiresInSeconds);
    const token = await createShareToken(c.env, {
      rootDirId,
      path,
      fileName,
      etag: object.etag,
      exp: expiresAtTimestamp,
      expiresInSeconds: body.expiresInSeconds,
    });
    const origin = resolveAppOrigin(c.req.url, c.env);
    const response: ShareLinkResponse = {
      success: true,
      fileName,
      expiresAt: new Date(expiresAtTimestamp).toISOString(),
      expiresInSeconds: body.expiresInSeconds,
      shareUrl: buildSharePageUrl(origin, token),
    };

    return jsonShareResponse(response);
  } catch (error) {
    const validationError = handlePathValidationError(c, error);
    if (validationError) return validationError;
    console.error("Failed to create share link", error);
    return jsonError(c, "Failed to create share link", 500);
  }
});

shares.get("/api/share-links/:token", async (c) => {
  try {
    const token = c.req.param("token");
    const payload = await verifyShareToken(c.env, token);
    if (!payload) {
      return jsonShareError("Invalid share link", 403);
    }

    const origin = resolveAppOrigin(c.req.url, c.env);
    const baseResponse: SharedFileMetadataResponse = {
      success: true,
      status: "active",
      fileName: payload.fileName,
      expiresAt: new Date(payload.exp).toISOString(),
      expiresInSeconds: payload.expiresInSeconds,
      serverNow: new Date().toISOString(),
      downloadUrl: buildShareDownloadUrl(origin, token),
    };

    if (isShareExpired(payload)) {
      return jsonShareResponse({
        ...baseResponse,
        status: "expired",
        downloadUrl: null,
      });
    }

    const object = await c.env.FILES_BUCKET.head(getFileKey(payload.rootDirId, payload.path));
    if (!object || object.etag !== payload.etag) {
      return jsonShareResponse({
        ...baseResponse,
        status: "missing",
        downloadUrl: null,
      });
    }

    return jsonShareResponse(baseResponse);
  } catch (error) {
    console.error("Failed to resolve share link", error);
    return jsonShareError("Failed to resolve share link", 500);
  }
});

shares.get("/api/share-links/:token/download", async (c) => {
  try {
    const token = c.req.param("token");
    const payload = await verifyShareToken(c.env, token);
    if (!payload) {
      return jsonShareError("Invalid share link", 403);
    }

    if (isShareExpired(payload)) {
      return jsonShareError("Share link has expired", 410);
    }

    const object = await c.env.FILES_BUCKET.get(getFileKey(payload.rootDirId, payload.path));
    if (!object || !object.body || object.etag !== payload.etag) {
      return jsonShareError("File not found", 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    applyNoStoreHeaders(headers);
    headers.set("Content-Disposition", toContentDisposition(payload.fileName));
    headers.set("ETag", object.httpEtag);
    headers.set("Last-Modified", object.uploaded.toUTCString());
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(object.body, { headers, status: 200 });
  } catch (error) {
    console.error("Failed to download shared file", error);
    return jsonShareError("Failed to download shared file", 500);
  }
});

export default shares;
