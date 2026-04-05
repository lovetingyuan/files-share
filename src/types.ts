export interface Profile {
  email: string;
  avatarUrl: string | null;
}

export const SHARE_DURATION_OPTIONS = [600, 1800, 3600, 7200, 86400] as const;

export type ShareDurationOption = (typeof SHARE_DURATION_OPTIONS)[number];

export interface ProfileResponse {
  success: true;
  profile: Profile;
}

export interface FolderEntry {
  name: string;
  path: string;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
  contentType: string | null;
}

export type SortKey = "name" | "size" | "uploadedAt";
export type SortOrder = "asc" | "desc";

export interface FileListResponse {
  success: true;
  path: string;
  folders: FolderEntry[];
  files: FileEntry[];
}

export interface CreateFolderRequest {
  parentPath: string;
  name: string;
}

export interface FileMutationResponse {
  success: true;
  message: string;
}

export interface CreateShareLinkRequest {
  path: string;
  expiresInSeconds: ShareDurationOption;
}

export interface ShareLinkResponse {
  success: true;
  fileName: string;
  expiresAt: string;
  expiresInSeconds: ShareDurationOption;
  shareUrl: string;
}

export type SharedFileStatus = "active" | "expired" | "missing";

export interface SharedFileMetadataResponse {
  success: true;
  status: SharedFileStatus;
  fileName: string;
  expiresAt: string;
  expiresInSeconds: ShareDurationOption;
  serverNow: string;
  downloadUrl: string | null;
}
