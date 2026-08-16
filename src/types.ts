export interface Profile {
  email: string;
  avatarUrl: string | null;
}

export interface User {
  id: string;
  email: string;
  image: string | null;
  name: string;
  verified: boolean;
  createdAt?: string;
}

export type ThemePreference = "light" | "dark" | "system";

export const SHARE_DURATION_OPTIONS = [600, 1800, 3600, 7200, 86400] as const;

export type ShareDurationOption = (typeof SHARE_DURATION_OPTIONS)[number];

export const SHARE_PASSWORD_MIN_LENGTH = 6;
export const SHARE_PASSWORD_MAX_LENGTH = 128;

export type RenderedPreviewKind = "markdown" | "html";

export const MARKDOWN_RENDER_EXTENSIONS = new Set(["md", "markdown"]);
export const HTML_RENDER_EXTENSIONS = new Set(["html", "htm"]);
export const RENDERED_MARKDOWN_MAX_BYTES = 2 * 1024 * 1024;

export interface ProfileResponse {
  success: true;
  profile: Profile;
}

export interface AdminUserListItem {
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserListResponse {
  success: true;
  items: AdminUserListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TopBannerMessage {
  date: string;
  contentHtml: string;
}

export interface TopBannerResponse {
  success: true;
  banner: TopBannerMessage | null;
}

export interface FolderEntry {
  name: string;
  path: string;
  createdAt: string;
  passwordProtected: boolean;
  protectedBy: string | null;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  createdAt: string;
  uploadedAt: string;
  contentType: string | null;
  checksums: FileChecksumMetadata | null;
  protectedBy: string | null;
}

export type FileChecksumMetadata = {
  md5?: string;
  sha1?: string;
  sha256?: string;
  sha384?: string;
  sha512?: string;
};

export type FileOperationTarget = {
  name: string;
  path: string;
  passwordProtected?: boolean;
  protectedBy?: string | null;
};

export type DeleteTarget = FileOperationTarget & {
  type: "file" | "folder";
};

export type RenameTarget = FileOperationTarget & {
  type: "file" | "folder";
};

export type MoveTarget = FileOperationTarget & {
  type: "file" | "folder";
};

export type BatchOperationTarget = FileOperationTarget & {
  type: "file" | "folder";
};

export type FolderPasswordAfterUnlockAction =
  | {
      type: "rename";
      target: RenameTarget;
    }
  | {
      type: "move";
      target: MoveTarget;
    }
  | {
      type: "delete";
      target: DeleteTarget;
    }
  | {
      type: "download";
      targets: BatchOperationTarget[];
    };

export type FolderPasswordModalTarget = {
  mode: "remove" | "set" | "unlock";
  path: string;
  name: string;
  protectedPath?: string;
  returnPath?: string;
  afterUnlock?: FolderPasswordAfterUnlockAction;
};

export type BatchOperationRequestTarget = {
  type: "file" | "folder";
  path: string;
};

export type FolderProtectionState = {
  passwordProtected: boolean;
  protectedBy: string | null;
};

export type NewTextFileDraft = {
  name: string;
  content: string;
};

export type SortKey = "name" | "size" | "uploadedAt" | "extension";
export type SortOrder = "asc" | "desc";
export type DashboardLayoutMode = "table" | "grid";

export interface FileListResponse {
  success: true;
  path: string;
  folders: FolderEntry[];
  files: FileEntry[];
}

export interface FolderTreeNode {
  name: string;
  path: string;
  passwordProtected: boolean;
  protectedBy: string | null;
  children: FolderTreeNode[];
}

export interface FolderTreeResponse {
  success: true;
  root: FolderTreeNode;
}

export interface DirectoryStatsResponse {
  success: true;
  path: string;
  fileCount: number;
  totalBytes: number;
}

export interface FileUploadLimitsResponse {
  success: true;
  maxFileBytes: number;
  maxBatchBytes: number;
  multipartPartBytes: number;
}

export interface MultipartUploadCreateRequest {
  parentPath: string;
  name: string;
  size: number;
  contentType: string | null;
  overwrite?: boolean;
}

export interface MultipartUploadCreateResponse {
  success: true;
  uploadId: string;
  partSize: number;
  partCount: number;
}

export interface MultipartUploadPart {
  partNumber: number;
  etag: string;
}

export interface MultipartUploadPartResponse {
  success: true;
  part: MultipartUploadPart;
  uploadedBytes: number;
}

export interface MultipartUploadCompleteRequest {
  uploadId: string;
  parts: MultipartUploadPart[];
}

export type UploadQueueStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "success"
  | "failed"
  | "canceled"
  | "oversized"
  | "duplicate";

export interface UploadQueueItem {
  id: string;
  file: File;
  displayPath: string;
  targetPath: string;
  parentPath: string;
  name: string;
  size: number;
  progress: number;
  status: UploadQueueStatus;
  errorMessage: string | null;
}

export interface ClipboardUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  contentType: string;
}

export interface CreateFolderRequest {
  parentPath: string;
  name: string;
  ensure?: boolean;
}

export interface SetFolderPasswordRequest {
  path: string;
  password: string;
}

export interface FolderPasswordSetCheckResponse {
  success: true;
  allowed: true;
}

export interface VerifyFolderPasswordRequest {
  path: string;
  password: string;
}

export interface VerifyFolderPasswordResponse {
  success: true;
  protectedPath: string;
  unlockToken: string;
}

export interface RemoveFolderPasswordRequest {
  path: string;
}

export interface SendFolderPasswordRecoveryCodeRequest {
  path: string;
}

export interface VerifyFolderPasswordRecoveryCodeRequest {
  path: string;
  otp: string;
}

export interface FolderLockedErrorResponse {
  success: false;
  error: string;
  code: "folder_locked";
  protectedPath: string;
}

export interface RenameRequest {
  path: string;
  name: string;
}

export interface MoveRequest {
  type: "file" | "folder";
  path: string;
  targetParentPath: string;
}

export interface BatchDeleteRequest {
  targets: BatchOperationRequestTarget[];
}

export interface BatchMoveRequest {
  targets: BatchOperationRequestTarget[];
  targetParentPath: string;
}

export interface CreateArchiveDownloadRequest {
  targets: BatchOperationRequestTarget[];
}

export interface CreateArchiveDownloadResponse {
  success: true;
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
}

export interface BatchFileOperationResult {
  type: "file" | "folder";
  path: string;
  success: boolean;
  message: string;
}

export interface BatchFileMutationResponse {
  success: boolean;
  message: string;
  completedCount: number;
  failedCount: number;
  results: BatchFileOperationResult[];
}

export interface FileMutationResponse {
  success: true;
  message: string;
}

export interface CreateShareLinkRequest {
  path?: string;
  paths?: string[];
  expiresInSeconds: ShareDurationOption;
  password?: string;
}

export interface ShareFileSummary {
  fileName: string;
  size: number;
}

export interface ShareLinkResponse {
  success: true;
  id: string;
  fileName: string;
  fileCount: number;
  files: ShareFileSummary[];
  expiresAt: string;
  expiresInSeconds: ShareDurationOption;
  shareUrl: string;
  passwordProtected: boolean;
}

export type SharedFileStatus = "active" | "expired" | "missing" | "locked";

export interface VerifySharePasswordRequest {
  password: string;
}

interface SharedFileMetadataBaseResponse {
  success: true;
  status: SharedFileStatus;
  serverNow: string;
  passwordProtected: boolean;
}

export interface LockedSharedFileMetadataResponse extends SharedFileMetadataBaseResponse {
  status: "locked";
  fileName: null;
  expiresAt: null;
  expiresInSeconds: null;
  downloadUrl: null;
  passwordProtected: true;
}

export interface ResolvedSharedFileMetadataResponse extends SharedFileMetadataBaseResponse {
  status: Exclude<SharedFileStatus, "locked">;
  fileName: string;
  fileCount: number;
  files: Array<
    ShareFileSummary & {
      status: "active" | "missing";
      downloadUrl: string | null;
    }
  >;
  expiresAt: string;
  expiresInSeconds: ShareDurationOption;
  downloadUrl: string | null;
}

export type SharedFileMetadataResponse =
  | LockedSharedFileMetadataResponse
  | ResolvedSharedFileMetadataResponse;
