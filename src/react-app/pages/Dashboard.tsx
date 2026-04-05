import { startTransition, useCallback, useDeferredValue, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import {
  buildDownloadUrl,
  useCreateFolderMutation,
  useDeleteFileMutation,
  useDeleteFolderMutation,
  useFileListWithOptimistic,
  useUploadFileMutation,
  useUpdateFileMutation,
} from "../hooks/useFilesApi";
import { FileToolbar } from "../components/FileToolbar";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { FileDetailsModal } from "../components/FileDetailsModal";
import { FileRow, FolderRow, NewFolderRow } from "../components/FileTableRows";
import { PreviewModal } from "../components/PreviewModal";
import { NewTextFileModal } from "../components/NewTextFileModal";
import { ShareFileModal } from "../components/ShareFileModal";
import { getPreviewInfo } from "../utils/previewInfo";
import { getDownloadFilename } from "../utils/fileFormatters";
import { validateFolderName } from "../utils/folderValidation";
import type { FileEntry, SortKey, SortOrder } from "../../types";

type DeleteTarget = {
  type: "file" | "folder";
  path: string;
  name: string;
};

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement | null>(null);
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderDefaultName, setNewFolderDefaultName] = useState("");
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [detailsFile, setDetailsFile] = useState<FileEntry | null>(null);
  const [shareFile, setShareFile] = useState<FileEntry | null>(null);
  const [isNewTextFileModalOpen, setIsNewTextFileModalOpen] = useState(false);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<DeleteTarget | null>(null);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const currentPath = searchParams.get("path") ?? "";
  const [sort, setSort] = useState<SortKey>("uploadedAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
    addOptimisticFolder,
    removeOptimisticFolder,
  } = useFileListWithOptimistic(currentPath, sort, order);
  const { createFolder, isMutating: isCreatingFolder } = useCreateFolderMutation();
  const { uploadFile, isMutating: isUploadingFile } = useUploadFileMutation();
  const { updateFile } = useUpdateFileMutation();
  const { deleteFile, isMutating: isDeletingFile } = useDeleteFileMutation();
  const { deleteFolder, isMutating: isDeletingFolder } = useDeleteFolderMutation();

  const busy =
    isCreatingFolder ||
    isUploadingFile ||
    isDeletingFile ||
    isDeletingFolder ||
    downloadingPath !== null;

  const fuzzyMatch = (name: string, query: string) => {
    if (!query) return true;
    const lowerName = name.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let qi = 0;
    for (let i = 0; i < lowerName.length && qi < lowerQuery.length; i++) {
      if (lowerName[i] === lowerQuery[qi]) qi++;
    }
    return qi === lowerQuery.length;
  };

  const filteredFolders = data.folders.filter((f) => fuzzyMatch(f.name, deferredSearchQuery));
  const filteredFiles = data.files.filter((f) => fuzzyMatch(f.name, deferredSearchQuery));
  const totalBytes = filteredFiles.reduce((sum, file) => sum + file.size, 0);
  const breadcrumbs = currentPath ? currentPath.split("/") : [];
  const hasItems = filteredFiles.length > 0 || filteredFolders.length > 0;
  const isSearchPending = searchInputValue !== deferredSearchQuery;
  const isDeleteConfirmBusy =
    (pendingDeleteTarget?.type === "file" && isDeletingFile) ||
    (pendingDeleteTarget?.type === "folder" && isDeletingFolder);

  const handleHeaderSort = (key: SortKey) => {
    if (sort === key) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setOrder(key === "name" ? "asc" : "desc");
    }
  };

  const setPath = (path: string) => {
    const nextSearchParams = new URLSearchParams();
    if (path) nextSearchParams.set("path", path);
    setSearchParams(nextSearchParams);
    setSearchInputValue("");
    setSearchQuery("");
  };

  const handleSearchChange = (value: string) => {
    setSearchInputValue(value);
    startTransition(() => {
      setSearchQuery(value);
    });
  };

  const getUniqueFolderName = (baseName: string): string => {
    const existingNames = new Set(data.folders.map((f) => f.name));
    if (!existingNames.has(baseName)) return baseName;
    let counter = 1;
    while (existingNames.has(`${baseName} (${counter})`)) counter++;
    return `${baseName} (${counter})`;
  };

  // Callback ref: focus and select the input when it mounts (replaces useEffect)
  const newFolderFocusRef = useCallback((node: HTMLInputElement | null) => {
    newFolderInputRef.current = node;
    if (node) {
      node.focus();
      node.select();
    }
  }, []);

  const handleStartCreateFolder = () => {
    setNewFolderDefaultName(getUniqueFolderName("新建文件夹"));
    setIsCreatingNewFolder(true);
  };

  const handleNewFolderBlur = async () => {
    const name = newFolderInputRef.current?.value.trim();
    setIsCreatingNewFolder(false);
    if (!name) return;

    const validationError = validateFolderName(name);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const optimisticPath = addOptimisticFolder(name);
    try {
      await createFolder(currentPath, name);
      await refresh();
      removeOptimisticFolder(optimisticPath);
      toast.success("Folder created");
    } catch (err) {
      removeOptimisticFolder(optimisticPath);
      toast.error(err instanceof Error ? err.message : "Failed to create folder");
    }
  };

  const handleNewFolderKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      newFolderInputRef.current?.blur();
    } else if (event.key === "Escape") {
      setIsCreatingNewFolder(false);
    }
  };

  const handleUploadSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await uploadFile(file, currentPath);
      await refresh();
      toast.success(`"${file.name}" uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload file");
    }
  };

  const handleDeleteFile = async (path: string, name: string) => {
    try {
      await deleteFile(path);
      await refresh();
      toast.success(`"${name}" deleted`);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete file");
      return false;
    }
  };

  const handleDeleteFolder = async (path: string, name: string) => {
    try {
      await deleteFolder(path);
      await refresh();
      toast.success(`Folder "${name}" deleted`);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete folder");
      return false;
    }
  };

  const handlePreviewFile = (file: FileEntry) => {
    const info = getPreviewInfo(file);
    if (info.kind === "unsupported") {
      toast.error(info.reason ?? "该文件类型暂不支持预览");
      return;
    }
    setPreviewFile(file);
  };

  const handleDownloadFile = async (path: string, fallbackName: string) => {
    try {
      setDownloadingPath(path);
      const response = await fetch(buildDownloadUrl(path), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to download file");
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = getDownloadFilename(
        response.headers.get("Content-Disposition"),
        fallbackName,
      );
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download file");
    } finally {
      setDownloadingPath(null);
    }
  };

  const handleRequestDelete = (target: DeleteTarget) => {
    setPendingDeleteTarget(target);
  };

  const handleCloseDeleteConfirm = () => {
    if (isDeleteConfirmBusy) return;
    setPendingDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteTarget || isDeleteConfirmBusy) return;

    const isDeleted =
      pendingDeleteTarget.type === "file"
        ? await handleDeleteFile(pendingDeleteTarget.path, pendingDeleteTarget.name)
        : await handleDeleteFolder(pendingDeleteTarget.path, pendingDeleteTarget.name);

    if (isDeleted) {
      setPendingDeleteTarget(null);
    }
  };

  const handleSaveTextFile = async (filename: string, content: string) => {
    try {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const file = new File([blob], filename, { type: "text/plain;charset=utf-8" });
      await uploadFile(file, currentPath);
      await refresh();
      setIsNewTextFileModalOpen(false);
      toast.success(`"${filename}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create file");
    }
  };

  const handleUpdateTextFile = async (path: string, content: string) => {
    try {
      const pathParts = path.split("/");
      const filename = pathParts.pop() || "";
      const parentPath = pathParts.join("/");
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const file = new File([blob], filename, { type: "text/plain;charset=utf-8" });
      await updateFile(file, parentPath);
      await refresh();
      toast.success(`"${filename}" updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update file");
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <DeleteConfirmModal
        target={pendingDeleteTarget}
        isDeleting={Boolean(isDeleteConfirmBusy)}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
      />
      <FileDetailsModal file={detailsFile} onClose={() => setDetailsFile(null)} />
      {shareFile ? (
        <ShareFileModal key={shareFile.path} file={shareFile} onClose={() => setShareFile(null)} />
      ) : null}
      <PreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onSave={handleUpdateTextFile}
      />
      <NewTextFileModal
        isOpen={isNewTextFileModalOpen}
        onClose={() => setIsNewTextFileModalOpen(false)}
        onSave={handleSaveTextFile}
        isSaving={isUploadingFile}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleUploadSelection}
        disabled={busy}
      />
      <main className="mx-auto flex w-[96%] max-w-300 flex-1 flex-col gap-4 py-6 md:w-[90%]">
        <section className="card bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <FileToolbar
              currentPath={currentPath}
              breadcrumbs={breadcrumbs}
              fileCount={filteredFiles.length}
              totalBytes={totalBytes}
              busy={busy}
              isUploadingFile={isUploadingFile}
              isCreatingFolder={isCreatingFolder}
              isRefreshing={isRefreshing}
              isCreatingNewFolder={isCreatingNewFolder}
              searchQuery={searchInputValue}
              isSearchPending={isSearchPending}
              onSetPath={setPath}
              onUploadClick={() => fileInputRef.current?.click()}
              onCreateFolder={handleStartCreateFolder}
              onCreateTextFile={() => setIsNewTextFileModalOpen(true)}
              onRefresh={() => refresh()}
              onSearchChange={handleSearchChange}
            />

            {error ? (
              <div className="rounded-box border border-base-300 bg-base-200 p-10">
                <div className="flex flex-col items-center gap-3 text-center text-base-content/60">
                  <Icon icon="mdi:alert-circle-outline" className="h-12 w-12 text-error" />
                  <p className="text-sm">列表加载失败</p>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="loading loading-spinner loading-lg text-primary"></span>
              </div>
            ) : (
              <>
                <div className="overflow-x-hidden">
                  <table className="table table-zebra table-md table-fixed w-full [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-4 sm:[&_th]:px-4">
                    <thead className="bg-base-300">
                      <tr className="bg-base-200">
                        <th className="w-auto">
                          <span className="inline-flex items-center gap-1">
                            Name
                            {hasItems && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square"
                                onClick={() => handleHeaderSort("name")}
                              >
                                <Icon
                                  icon={
                                    sort === "name"
                                      ? order === "asc"
                                        ? "mdi:arrow-up"
                                        : "mdi:arrow-down"
                                      : "mdi:swap-vertical"
                                  }
                                  className={`w-3.5 h-3.5 ${sort === "name" ? "text-primary" : "opacity-40"}`}
                                />
                              </button>
                            )}
                          </span>
                        </th>
                        <th className="hidden sm:table-cell sm:w-28">
                          <span className="inline-flex items-center gap-1">
                            Size
                            {hasItems && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square"
                                onClick={() => handleHeaderSort("size")}
                              >
                                <Icon
                                  icon={
                                    sort === "size"
                                      ? order === "asc"
                                        ? "mdi:arrow-up"
                                        : "mdi:arrow-down"
                                      : "mdi:swap-vertical"
                                  }
                                  className={`w-3.5 h-3.5 ${sort === "size" ? "text-primary" : "opacity-40"}`}
                                />
                              </button>
                            )}
                          </span>
                        </th>
                        <th className="hidden sm:table-cell sm:w-46">
                          <span className="inline-flex items-center gap-1">
                            Updated
                            {hasItems && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square"
                                onClick={() => handleHeaderSort("uploadedAt")}
                              >
                                <Icon
                                  icon={
                                    sort === "uploadedAt"
                                      ? order === "asc"
                                        ? "mdi:arrow-up"
                                        : "mdi:arrow-down"
                                      : "mdi:swap-vertical"
                                  }
                                  className={`w-3.5 h-3.5 ${sort === "uploadedAt" ? "text-primary" : "opacity-40"}`}
                                />
                              </button>
                            )}
                          </span>
                        </th>
                        <th className="w-12 text-right sm:w-16">
                          <span className="hidden sm:inline">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {isCreatingNewFolder && (
                        <NewFolderRow
                          defaultName={newFolderDefaultName}
                          inputRef={newFolderFocusRef}
                          onBlur={handleNewFolderBlur}
                          onKeyDown={handleNewFolderKeyDown}
                        />
                      )}
                      {filteredFolders.map((folder) => (
                        <FolderRow
                          key={`folder:${folder.path}`}
                          folder={folder}
                          busy={busy}
                          isDeletingFolder={isDeletingFolder}
                          onNavigate={setPath}
                          onRequestDelete={(path, name) =>
                            handleRequestDelete({ type: "folder", path, name })
                          }
                        />
                      ))}
                      {filteredFiles.map((file) => (
                        <FileRow
                          key={`file:${file.path}`}
                          file={file}
                          busy={busy}
                          isDeletingFile={isDeletingFile}
                          isDownloading={downloadingPath === file.path}
                          onDownload={handleDownloadFile}
                          onRequestDelete={(path, name) =>
                            handleRequestDelete({ type: "file", path, name })
                          }
                          onPreview={handlePreviewFile}
                          onShare={setShareFile}
                          onShowDetails={setDetailsFile}
                        />
                      ))}
                      {filteredFolders.length === 0 && filteredFiles.length === 0 && (
                        <>
                          <tr className="sm:hidden">
                            <td colSpan={2}>
                              <div className="flex flex-col items-center gap-2 py-15 text-base-content/60">
                                <Icon
                                  icon={
                                    searchInputValue
                                      ? "mdi:magnify-remove-outline"
                                      : "mdi:folder-open-outline"
                                  }
                                  className="w-12 h-12"
                                />
                                {searchInputValue
                                  ? `No results for "${searchInputValue}"`
                                  : "This folder is empty."}
                              </div>
                            </td>
                          </tr>
                          <tr className="hidden sm:table-row">
                            <td colSpan={4}>
                              <div className="flex flex-col items-center gap-2 py-15 text-base-content/60">
                                <Icon
                                  icon={
                                    searchInputValue
                                      ? "mdi:magnify-remove-outline"
                                      : "mdi:folder-open-outline"
                                  }
                                  className="w-12 h-12"
                                />
                                {searchInputValue
                                  ? `No results for "${searchInputValue}"`
                                  : "This folder is empty."}
                              </div>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
