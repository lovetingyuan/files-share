export const FOLDER_MARKER_NAME = ".fileshare-folder";
export const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const SYSTEM_PROFILE_FOLDER_NAME = ".user";
export const AVATAR_FILE_NAME = "avatar.png";

function containsControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

export class FilePathValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "FilePathValidationError";
    this.status = status;
  }
}

function validateSegment(segment: string, label: string): string {
  const value = segment.trim();

  if (!value) {
    throw new FilePathValidationError(`${label} cannot be empty`);
  }

  if (value.includes("/")) {
    throw new FilePathValidationError(`${label} cannot contain "/"`);
  }

  if (value.includes("\\")) {
    throw new FilePathValidationError(`${label} cannot contain "\\"`);
  }

  if (value === "." || value === "..") {
    throw new FilePathValidationError(`${label} cannot be "." or ".."`);
  }

  if (value === FOLDER_MARKER_NAME) {
    throw new FilePathValidationError(`${label} uses a reserved name`);
  }

  if (containsControlCharacters(value)) {
    throw new FilePathValidationError(`${label} contains invalid characters`);
  }

  return value;
}

export function normalizeName(value: string | undefined, label = "Name"): string {
  if (value === undefined) {
    throw new FilePathValidationError(`${label} is required`);
  }

  return validateSegment(value, label);
}

export function normalizeRelativePath(
  value: string | undefined,
  options: { allowEmpty?: boolean; label?: string } = {},
): string {
  const allowEmpty = options.allowEmpty ?? true;
  const label = options.label ?? "Path";

  if (value === undefined || value === "") {
    if (allowEmpty) {
      return "";
    }

    throw new FilePathValidationError(`${label} is required`);
  }

  if (value.startsWith("/")) {
    throw new FilePathValidationError(`${label} must be relative`);
  }

  if (value.includes("\\")) {
    throw new FilePathValidationError(`${label} cannot contain "\\"`);
  }

  if (containsControlCharacters(value)) {
    throw new FilePathValidationError(`${label} contains invalid characters`);
  }

  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new FilePathValidationError(`${label} cannot contain empty segments`);
  }

  return segments.map((segment) => validateSegment(segment, label)).join("/");
}

export function joinRelativePath(parentPath: string, name: string): string {
  return parentPath ? `${parentPath}/${name}` : name;
}

export function isReservedSystemPath(path: string): boolean {
  return path.split("/").includes(SYSTEM_PROFILE_FOLDER_NAME);
}

export function getAvatarPath(): string {
  return `${SYSTEM_PROFILE_FOLDER_NAME}/${AVATAR_FILE_NAME}`;
}

function getBucketRootPrefix(rootDirId: string): string {
  return `${rootDirId}/`;
}

export function getFolderPrefix(rootDirId: string, folderPath: string): string {
  return folderPath ? `${rootDirId}/${folderPath}/` : getBucketRootPrefix(rootDirId);
}

export function getFileKey(rootDirId: string, filePath: string): string {
  return `${rootDirId}/${filePath}`;
}

export function getFolderMarkerKey(rootDirId: string, folderPath: string): string {
  if (!folderPath) {
    throw new FilePathValidationError("Home folder does not use a marker", 500);
  }

  return `${getFolderPrefix(rootDirId, folderPath)}${FOLDER_MARKER_NAME}`;
}

export function getBaseName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

export function parseMaxUploadBytes(value: string | undefined): number {
  if (!value) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  return parsed;
}

export function toContentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${fallback || "download"}"; filename*=UTF-8''${encoded}`;
}
