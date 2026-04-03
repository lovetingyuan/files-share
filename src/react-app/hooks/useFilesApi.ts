import { useState } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import type {
  CreateFolderRequest,
  FileListResponse,
  FileMutationResponse,
  SortKey,
  SortOrder,
} from "../../types";
import { ApiError, apiRequest } from "../utils/apiRequest";

const FILES_ENDPOINT = "/api/files";
const FILE_OBJECT_ENDPOINT = "/api/files/object";
const FILE_FOLDERS_ENDPOINT = "/api/files/folders";

type FileListKey = [string, string, SortKey, SortOrder];

function buildListUrl(path: string, sort: SortKey, order: SortOrder): string {
  const params = new URLSearchParams({ sort, order });
  if (path) params.set("path", path);
  return `${FILES_ENDPOINT}?${params.toString()}`;
}

export function buildDownloadUrl(path: string): string {
  const params = new URLSearchParams({ path });
  return `${FILE_OBJECT_ENDPOINT}?${params.toString()}`;
}

export function buildPreviewUrl(path: string): string {
  const params = new URLSearchParams({ path });
  return `/api/files/preview?${params.toString()}`;
}

function useFileList(path: string, sort: SortKey, order: SortOrder) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<FileListResponse, ApiError>(
    [FILES_ENDPOINT, path, sort, order] as FileListKey,
    (key) => {
      const [, currentPath, currentSort, currentOrder] = key as FileListKey;
      return apiRequest<FileListResponse>(buildListUrl(currentPath, currentSort, currentOrder));
    },
  );

  const refresh = async () => {
    await mutate();
  };

  return {
    data: {
      path,
      folders: data?.folders ?? [],
      files: data?.files ?? [],
    },
    error,
    isLoading,
    isRefreshing: isValidating,
    refresh,
  };
}

export function useCreateFolderMutation() {
  const { trigger, isMutating } = useSWRMutation<
    FileMutationResponse,
    ApiError,
    string,
    CreateFolderRequest
  >(
    FILE_FOLDERS_ENDPOINT,
    (url, { arg }) =>
      apiRequest<FileMutationResponse>(url, {
        method: "POST",
        body: JSON.stringify(arg),
      }),
    {
      throwOnError: true,
    },
  );

  const createFolder = (parentPath: string, name: string) => trigger({ parentPath, name });

  return {
    createFolder,
    isMutating,
  };
}

type OptimisticFolder = {
  path: string;
  name: string;
  isOptimistic: true;
};

export function useFileListWithOptimistic(path: string, sort: SortKey, order: SortOrder) {
  const [optimisticFolders, setOptimisticFolders] = useState<OptimisticFolder[]>([]);
  const result = useFileList(path, sort, order);

  const addOptimisticFolder = (name: string) => {
    const folderPath = path ? `${path}/${name}` : name;
    setOptimisticFolders((prev) => [...prev, { path: folderPath, name, isOptimistic: true }]);
    return folderPath;
  };

  const removeOptimisticFolder = (folderPath: string) => {
    setOptimisticFolders((prev) => prev.filter((f) => f.path !== folderPath));
  };

  const clearOptimisticFolders = () => {
    setOptimisticFolders([]);
  };

  const folders = [
    ...optimisticFolders,
    ...result.data.folders.filter((f) => !optimisticFolders.some((of) => of.path === f.path)),
  ];

  return {
    ...result,
    data: {
      ...result.data,
      folders,
    },
    addOptimisticFolder,
    removeOptimisticFolder,
    clearOptimisticFolders,
  };
}

type UploadFileArgs = {
  file: File;
  parentPath: string;
};

export function useUploadFileMutation() {
  const { trigger, isMutating } = useSWRMutation<
    FileMutationResponse,
    ApiError,
    string,
    UploadFileArgs
  >(
    FILE_OBJECT_ENDPOINT,
    (url, { arg }) => {
      const params = new URLSearchParams({
        name: arg.file.name,
      });
      if (arg.parentPath) {
        params.set("parentPath", arg.parentPath);
      }

      return apiRequest<FileMutationResponse>(`${url}?${params.toString()}`, {
        method: "PUT",
        headers: arg.file.type
          ? {
              "Content-Type": arg.file.type,
            }
          : undefined,
        body: arg.file,
      });
    },
    {
      throwOnError: true,
    },
  );

  const uploadFile = (file: File, parentPath: string) => trigger({ file, parentPath });

  return {
    uploadFile,
    isMutating,
  };
}

export function useDeleteFileMutation() {
  const { trigger, isMutating } = useSWRMutation<FileMutationResponse, ApiError, string, string>(
    FILE_OBJECT_ENDPOINT,
    (url, { arg }) => {
      const params = new URLSearchParams({ path: arg });
      return apiRequest<FileMutationResponse>(`${url}?${params.toString()}`, {
        method: "DELETE",
      });
    },
    {
      throwOnError: true,
    },
  );

  const deleteFile = (path: string) => trigger(path);

  return {
    deleteFile,
    isMutating,
  };
}

export function useDeleteFolderMutation() {
  const { trigger, isMutating } = useSWRMutation<FileMutationResponse, ApiError, string, string>(
    FILE_FOLDERS_ENDPOINT,
    (url, { arg }) => {
      const params = new URLSearchParams({ path: arg });
      return apiRequest<FileMutationResponse>(`${url}?${params.toString()}`, {
        method: "DELETE",
      });
    },
    {
      throwOnError: true,
    },
  );

  const deleteFolder = (path: string) => trigger(path);

  return {
    deleteFolder,
    isMutating,
  };
}

type UpdateFileArgs = {
  file: File;
  parentPath: string;
};

export function useUpdateFileMutation() {
  const { trigger, isMutating } = useSWRMutation<
    FileMutationResponse,
    ApiError,
    string,
    UpdateFileArgs
  >(
    FILE_OBJECT_ENDPOINT,
    (url, { arg }) => {
      const params = new URLSearchParams({
        name: arg.file.name,
        overwrite: "true",
      });
      if (arg.parentPath) {
        params.set("parentPath", arg.parentPath);
      }

      return apiRequest<FileMutationResponse>(`${url}?${params.toString()}`, {
        method: "PUT",
        headers: arg.file.type
          ? {
              "Content-Type": arg.file.type,
            }
          : undefined,
        body: arg.file,
      });
    },
    {
      throwOnError: true,
    },
  );

  const updateFile = (file: File, parentPath: string) => trigger({ file, parentPath });

  return {
    updateFile,
    isMutating,
  };
}
