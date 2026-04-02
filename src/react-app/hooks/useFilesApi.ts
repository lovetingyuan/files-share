import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import useSWRMutation from "swr/mutation";
import type {
  CreateFolderRequest,
  FileListResponse,
  FileMutationResponse,
} from "../../shared/file-manager";
import { ApiError, apiRequest } from "../lib/api";

const FILES_ENDPOINT = "/api/files";
const FILE_OBJECT_ENDPOINT = "/api/files/object";
const FILE_FOLDERS_ENDPOINT = "/api/files/folders";
type FileListKey = [string, string, string | undefined];

function buildListUrl(path: string, cursor?: string): string {
  const params = new URLSearchParams();
  if (path) {
    params.set("path", path);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }

  const query = params.toString();
  return query ? `${FILES_ENDPOINT}?${query}` : FILES_ENDPOINT;
}

export function buildDownloadUrl(path: string): string {
  const params = new URLSearchParams({ path });
  return `${FILE_OBJECT_ENDPOINT}?${params.toString()}`;
}

export function useFileList(path: string) {
  const getKey = (
    pageIndex: number,
    previousPageData: FileListResponse | null,
  ): [string, string, string | undefined] | null => {
    if (pageIndex > 0 && (!previousPageData?.truncated || !previousPageData.cursor)) {
      return null;
    }

    return [
      FILES_ENDPOINT,
      path,
      pageIndex === 0 ? undefined : previousPageData?.cursor,
    ];
  };

  const { data, error, isLoading, isValidating, mutate, setSize } = useSWRInfinite<
    FileListResponse,
    ApiError
  >(
    getKey,
    (key) => {
      const [, currentPath, cursor] = key as FileListKey;
      return apiRequest<FileListResponse>(buildListUrl(currentPath, cursor));
    },
    {
      persistSize: false,
      revalidateFirstPage: false,
    },
  );

  const pages = data ?? [];
  const lastPage = pages[pages.length - 1];

  const loadMore = async () => {
    if (!lastPage?.truncated) {
      return;
    }

    await setSize((currentSize) => currentSize + 1);
  };

  const refresh = async () => {
    await mutate();
  };

  return {
    data: {
      path,
      folders: pages.flatMap((page) => page.folders),
      files: pages.flatMap((page) => page.files),
      truncated: lastPage?.truncated ?? false,
    },
    error,
    hasMore: lastPage?.truncated ?? false,
    isLoading,
    isRefreshing: isValidating,
    loadMore,
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

export function useFileListWithOptimistic(path: string) {
  const [optimisticFolders, setOptimisticFolders] = useState<OptimisticFolder[]>([]);
  const result = useFileList(path);

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

  // Merge optimistic folders with real data
  const folders = [
    ...optimisticFolders,
    ...result.data.folders.filter(
      (f) => !optimisticFolders.some((of) => of.path === f.path),
    ),
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
