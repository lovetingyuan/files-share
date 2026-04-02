export const FOLDER_MARKER_NAME = '.fileshare-folder';
export const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export class FilePathValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'FilePathValidationError';
    this.status = status;
  }
}

function validateSegment(segment: string, label: string): string {
  const value = segment.trim();

  if (!value) {
    throw new FilePathValidationError(`${label} cannot be empty`);
  }

  if (value.includes('/')) {
    throw new FilePathValidationError(`${label} cannot contain "/"`);
  }

  if (value.includes('\\')) {
    throw new FilePathValidationError(`${label} cannot contain "\\"`);
  }

  if (value === '.' || value === '..') {
    throw new FilePathValidationError(`${label} cannot be "." or ".."`);
  }

  if (value === FOLDER_MARKER_NAME) {
    throw new FilePathValidationError(`${label} uses a reserved name`);
  }

  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new FilePathValidationError(`${label} contains invalid characters`);
  }

  return value;
}

export function normalizeName(value: string | undefined, label = 'Name'): string {
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
  const label = options.label ?? 'Path';

  if (value === undefined || value === '') {
    if (allowEmpty) {
      return '';
    }

    throw new FilePathValidationError(`${label} is required`);
  }

  if (value.startsWith('/')) {
    throw new FilePathValidationError(`${label} must be relative`);
  }

  if (value.includes('\\')) {
    throw new FilePathValidationError(`${label} cannot contain "\\"`);
  }

  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new FilePathValidationError(`${label} contains invalid characters`);
  }

  const segments = value.split('/');
  if (segments.some((segment) => segment.length === 0)) {
    throw new FilePathValidationError(`${label} cannot contain empty segments`);
  }

  return segments.map((segment) => validateSegment(segment, label)).join('/');
}

export function joinRelativePath(parentPath: string, name: string): string {
  return parentPath ? `${parentPath}/${name}` : name;
}

export function getBucketRootPrefix(rootDirId: string): string {
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
    throw new FilePathValidationError('Home folder does not use a marker', 500);
  }

  return `${getFolderPrefix(rootDirId, folderPath)}${FOLDER_MARKER_NAME}`;
}

export function getBaseName(path: string): string {
  const segments = path.split('/');
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
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${fallback || 'download'}"; filename*=UTF-8''${encoded}`;
}
