import type { Context } from "hono";
import type { FileMutationResponse, RenameRequest } from "../../types";
import type { AppContext } from "../context";
import {
  createUploadStream,
  folderExists,
  getFileContext,
  getUploadLimitBytes,
} from "../utils/appHelpers";
import { assertPathAccess, handleFolderPasswordError } from "../utils/folderPasswords";
import {
  getBaseName,
  getFileKey,
  joinRelativePath,
  normalizeName,
  normalizeRelativePath,
  toContentDisposition,
} from "../utils/fileManager";
import { UploadTooLargeError, handlePathValidationError, jsonError } from "../utils/response";
import {
  assertNameChanged,
  assertPathNotReserved,
  assertRenameTargetAvailable,
  cleanupCopiedKeys,
  getNoOverwriteHeaders,
  getObjectPutOptions,
  getParentPath,
  hasObjectBody,
  resolveFileCreatedAt,
} from "./filesShared";
import {
  getValidatedJson,
  getValidatedQuery,
  type PathQuery,
  type UploadObjectQuery,
} from "../validation";
export { previewFile } from "./filePreviewHandler";
export { renderPreviewFile } from "./fileRenderHandler";

function getDownloadHeaders(object: R2Object, fileName: string): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", toContentDisposition(fileName));
  headers.set("Content-Length", String(object.size));
  headers.set("ETag", object.httpEtag);
  headers.set("Last-Modified", object.uploaded.toUTCString());
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

function parseUploadContentLength(c: Context<AppContext>): number | Response {
  const contentLengthHeader = c.req.header("content-length");
  if (!contentLengthHeader) {
    return jsonError(c, "Content-Length header is required for uploads", 411);
  }

  const contentLength = Number.parseInt(contentLengthHeader, 10);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    return jsonError(c, "Invalid Content-Length header", 400);
  }

  return contentLength;
}

export async function uploadFile(c: Context<AppContext>) {
  try {
    const query = getValidatedQuery<UploadObjectQuery>(c);
    const parentPath = normalizeRelativePath(query.parentPath, {
      allowEmpty: true,
      label: "Parent path",
    });
    assertPathNotReserved(parentPath);
    const name = normalizeName(query.name, "File name");
    const filePath = joinRelativePath(parentPath, name);
    assertPathNotReserved(filePath);
    const { rootDirId } = await getFileContext(c);
    await assertPathAccess(c, rootDirId, parentPath);

    if (!(await folderExists(c.env, rootDirId, parentPath))) {
      return jsonError(c, "Parent folder not found", 404);
    }

    if (await folderExists(c.env, rootDirId, filePath)) {
      return jsonError(c, "A folder with this name already exists", 409);
    }

    const body = c.req.raw.body;
    if (!body) {
      return jsonError(c, "File body is required", 400);
    }

    const maxUploadBytes = getUploadLimitBytes(c.env);
    const contentLength = parseUploadContentLength(c);
    if (contentLength instanceof Response) {
      return contentLength;
    }

    if (contentLength > maxUploadBytes) {
      return jsonError(c, "File exceeds the upload size limit", 413);
    }

    const uploadStream = createUploadStream(body as ReadableStream<Uint8Array>, maxUploadBytes);
    const fixedLengthStream = new FixedLengthStream(contentLength);
    const pipingPromise = uploadStream.pipeTo(fixedLengthStream.writable);
    const fileKey = getFileKey(rootDirId, filePath);
    const contentType = c.req.header("content-type") ?? "application/octet-stream";

    const allowOverwrite = query.overwrite;
    const existingObject = allowOverwrite ? await c.env.FILES_BUCKET.head(fileKey) : null;
    const createdAt = existingObject
      ? resolveFileCreatedAt(existingObject)
      : new Date().toISOString();

    const putResult = await Promise.all([
      c.env.FILES_BUCKET.put(fileKey, fixedLengthStream.readable, {
        customMetadata: { originalName: name, createdAt },
        httpMetadata: { contentType },
        ...(allowOverwrite ? {} : { onlyIf: getNoOverwriteHeaders() }),
      }),
      pipingPromise,
    ]).then(([result]) => result);

    if (!putResult && !allowOverwrite) {
      return jsonError(c, "A file with this name already exists", 409);
    }

    const response: FileMutationResponse = { success: true, message: "File uploaded successfully" };
    return c.json(response, 201);
  } catch (error) {
    const folderPasswordError = handleFolderPasswordError(error);
    if (folderPasswordError) {
      return folderPasswordError;
    }
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }
    if (error instanceof UploadTooLargeError) {
      return jsonError(c, error.message, 413);
    }
    console.error("Failed to upload file", error);
    return jsonError(c, "Failed to upload file", 500);
  }
}

export async function renameFile(c: Context<AppContext>) {
  let copiedKey: string | null = null;

  try {
    const body = getValidatedJson<RenameRequest>(c);
    const path = normalizeRelativePath(body.path, { allowEmpty: false, label: "Path" });
    assertPathNotReserved(path);
    const name = normalizeName(body.name, "File name");
    assertNameChanged(path, name, "file");
    const parentPath = getParentPath(path);
    const targetPath = joinRelativePath(parentPath, name);
    assertPathNotReserved(targetPath);
    const { rootDirId } = await getFileContext(c);
    await assertPathAccess(c, rootDirId, path);
    const sourceKey = getFileKey(rootDirId, path);
    const targetKey = getFileKey(rootDirId, targetPath);
    const sourceHead = await c.env.FILES_BUCKET.head(sourceKey);

    if (!sourceHead) {
      return jsonError(c, "File not found", 404);
    }

    await assertRenameTargetAvailable(c.env, rootDirId, targetPath);

    const source = await c.env.FILES_BUCKET.get(sourceKey, {
      onlyIf: { etagMatches: sourceHead.etag },
    });
    if (!hasObjectBody(source)) {
      return jsonError(c, "File changed during rename", 409);
    }

    const createdAt = source.customMetadata?.createdAt ?? source.uploaded.toISOString();
    const putResult = await c.env.FILES_BUCKET.put(
      targetKey,
      source.body,
      getObjectPutOptions(source, {
        ...source.customMetadata,
        originalName: name,
        createdAt,
      }),
    );

    if (!putResult) {
      return jsonError(c, "A file with this name already exists", 409);
    }
    copiedKey = targetKey;

    const latestSource = await c.env.FILES_BUCKET.head(sourceKey);
    if (!latestSource || latestSource.etag !== sourceHead.etag) {
      await c.env.FILES_BUCKET.delete(targetKey);
      copiedKey = null;
      return jsonError(c, "File changed during rename", 409);
    }

    await c.env.FILES_BUCKET.delete(sourceKey);
    copiedKey = null;

    const response: FileMutationResponse = { success: true, message: "File renamed successfully" };
    return c.json(response);
  } catch (error) {
    if (copiedKey) {
      await cleanupCopiedKeys(c.env.FILES_BUCKET, [copiedKey]);
    }

    const folderPasswordError = handleFolderPasswordError(error);
    if (folderPasswordError) {
      return folderPasswordError;
    }
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }
    console.error("Failed to rename file", error);
    return jsonError(c, "Failed to rename file", 500);
  }
}

export async function downloadFile(c: Context<AppContext>) {
  try {
    const query = getValidatedQuery<PathQuery>(c);
    const path = normalizeRelativePath(query.path, { allowEmpty: false, label: "Path" });
    assertPathNotReserved(path);
    const { rootDirId } = await getFileContext(c);
    await assertPathAccess(c, rootDirId, path);
    const object = await c.env.FILES_BUCKET.get(getFileKey(rootDirId, path));

    if (!object || !object.body) {
      return jsonError(c, "File not found", 404);
    }

    const headers = getDownloadHeaders(
      object,
      object.customMetadata?.originalName ?? getBaseName(path),
    );

    return new Response(object.body, { headers, status: 200 });
  } catch (error) {
    const folderPasswordError = handleFolderPasswordError(error);
    if (folderPasswordError) {
      return folderPasswordError;
    }
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }
    console.error("Failed to download file", error);
    return jsonError(c, "Failed to download file", 500);
  }
}

export async function headDownloadFile(c: Context<AppContext>) {
  try {
    const query = getValidatedQuery<PathQuery>(c);
    const path = normalizeRelativePath(query.path, { allowEmpty: false, label: "Path" });
    assertPathNotReserved(path);
    const { rootDirId } = await getFileContext(c);
    await assertPathAccess(c, rootDirId, path);
    const object = await c.env.FILES_BUCKET.head(getFileKey(rootDirId, path));

    if (!object) {
      return jsonError(c, "File not found", 404);
    }

    const headers = getDownloadHeaders(
      object,
      object.customMetadata?.originalName ?? getBaseName(path),
    );

    return new Response(null, { headers, status: 200 });
  } catch (error) {
    const folderPasswordError = handleFolderPasswordError(error);
    if (folderPasswordError) {
      return folderPasswordError;
    }
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }
    console.error("Failed to check downloadable file", error);
    return jsonError(c, "Failed to check downloadable file", 500);
  }
}

export async function deleteFile(c: Context<AppContext>) {
  try {
    const query = getValidatedQuery<PathQuery>(c);
    const path = normalizeRelativePath(query.path, { allowEmpty: false, label: "Path" });
    assertPathNotReserved(path);
    const { rootDirId } = await getFileContext(c);
    await assertPathAccess(c, rootDirId, path);
    const fileKey = getFileKey(rootDirId, path);
    const object = await c.env.FILES_BUCKET.head(fileKey);

    if (!object) {
      return jsonError(c, "File not found", 404);
    }

    await c.env.FILES_BUCKET.delete(fileKey);

    const response: FileMutationResponse = { success: true, message: "File deleted successfully" };
    return c.json(response);
  } catch (error) {
    const folderPasswordError = handleFolderPasswordError(error);
    if (folderPasswordError) {
      return folderPasswordError;
    }
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }
    console.error("Failed to delete file", error);
    return jsonError(c, "Failed to delete file", 500);
  }
}
