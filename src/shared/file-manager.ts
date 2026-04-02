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

export interface FileListResponse {
  success: true;
  path: string;
  folders: FolderEntry[];
  files: FileEntry[];
  truncated: boolean;
  cursor?: string;
}

export interface CreateFolderRequest {
  parentPath: string;
  name: string;
}

export interface FileMutationResponse {
  success: true;
  message: string;
}
