import type { SortKey, SortOrder } from "../../types";

export const FILES_ENDPOINT = "/api/files";
export const FILE_OBJECT_ENDPOINT = "/api/files/object";
export const FILE_FOLDERS_ENDPOINT = "/api/files/folders";
export const FILE_FOLDER_TREE_ENDPOINT = "/api/files/folders/tree";
export const FILE_ENTRIES_ENDPOINT = "/api/files/entries";
export const FILE_BATCH_ENTRIES_ENDPOINT = "/api/files/entries/batch";
export const FILE_ARCHIVE_DOWNLOADS_ENDPOINT = "/api/files/archive-downloads";
export const FILE_SHARE_LINKS_ENDPOINT = "/api/files/share-links";
export const FILE_STATS_ENDPOINT = "/api/files/stats";
export const FILE_FOLDER_PASSWORD_ENDPOINT = "/api/files/folders/password";
export const FILE_FOLDER_PASSWORD_FORGOT_ENDPOINT = "/api/files/folders/password/forgot";
export const FILE_FOLDER_PASSWORD_FORGOT_VERIFY_ENDPOINT =
  "/api/files/folders/password/forgot/verify";
export const FILE_FOLDER_PASSWORD_POLICY_ENDPOINT = "/api/files/folders/password-policy";
export const FILE_FOLDER_UNLOCKS_ENDPOINT = "/api/files/folders/unlocks";
export const FILE_RENDERED_PREVIEW_ENDPOINT = "/api/files/preview/rendered";

export type FileListKey = [string, string, SortKey, SortOrder];

export function isFileListKey(key: unknown): key is FileListKey {
  return (
    Array.isArray(key) &&
    key.length === 4 &&
    key[0] === FILES_ENDPOINT &&
    typeof key[1] === "string" &&
    (key[2] === "name" || key[2] === "size" || key[2] === "uploadedAt") &&
    (key[3] === "asc" || key[3] === "desc")
  );
}

export function buildListUrl(path: string, sort: SortKey, order: SortOrder): string {
  const params = new URLSearchParams({ sort, order });
  if (path) {
    params.set("path", path);
  }
  return `${FILES_ENDPOINT}?${params.toString()}`;
}

export function buildStatsUrl(path: string): string {
  const params = new URLSearchParams();
  if (path) {
    params.set("path", path);
  }

  const query = params.toString();
  return query ? `${FILE_STATS_ENDPOINT}?${query}` : FILE_STATS_ENDPOINT;
}

export function buildDownloadUrl(path: string, folderUnlockToken?: string | null): string {
  const params = new URLSearchParams({ path });
  if (folderUnlockToken) {
    params.set("folderUnlockToken", folderUnlockToken);
  }
  return `${FILE_OBJECT_ENDPOINT}?${params.toString()}`;
}

export function buildPreviewUrl(
  path: string,
  folderUnlockToken?: string | null,
  version?: string | null,
): string {
  const params = new URLSearchParams({ path });
  if (folderUnlockToken) {
    params.set("folderUnlockToken", folderUnlockToken);
  }
  if (version) {
    params.set("v", version);
  }
  return `/api/files/preview?${params.toString()}`;
}

export function buildRenderedPreviewUrl(path: string, folderUnlockToken?: string | null): string {
  const params = new URLSearchParams({ path });
  if (folderUnlockToken) {
    params.set("folderUnlockToken", folderUnlockToken);
  }
  return `${FILE_RENDERED_PREVIEW_ENDPOINT}?${params.toString()}`;
}
