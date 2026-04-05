import { Icon } from "@iconify/react";
import type { FolderEntry, FileEntry } from "../../types";
import { formatBytes, formatDate } from "../utils/fileFormatters";
import { getFileIcon } from "../constants/fileIcons";

type RowActionItem = {
  label: string;
  icon: string;
  tone?: "default" | "danger";
  onClick: () => void;
};

interface NewFolderRowProps {
  defaultName: string;
  inputRef: React.RefCallback<HTMLInputElement>;
  onBlur: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export function NewFolderRow({ defaultName, inputRef, onBlur, onKeyDown }: NewFolderRowProps) {
  return (
    <tr>
      <td className="min-w-0">
        <span className="inline-flex w-full min-w-0 items-center gap-1">
          <Icon icon="mdi:folder" className="h-5 w-5 shrink-0 text-warning" />
          <input
            ref={inputRef}
            type="text"
            className="input input-sm input-bordered w-full min-w-0 sm:w-48"
            defaultValue={defaultName}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          />
        </span>
      </td>
      <td className="hidden text-base-content/50 sm:table-cell">-</td>
      <td className="hidden text-base-content/50 sm:table-cell">-</td>
      <td className="text-right"></td>
    </tr>
  );
}

function RowActionsMenu({
  busy,
  isLoading,
  items,
}: {
  busy: boolean;
  isLoading?: boolean;
  items: RowActionItem[];
}) {
  return (
    <div className="dropdown dropdown-top dropdown-end">
      <button
        type="button"
        tabIndex={0}
        className={`btn btn-ghost btn-xs btn-square sm:btn-sm ${isLoading ? "loading" : ""}`}
        disabled={busy}
        aria-label="更多操作"
      >
        {!isLoading && <Icon icon="mdi:dots-horizontal" className="h-4 w-4" />}
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content menu menu-sm bg-base-200 rounded-box z-10 mt-1 w-40 border border-base-300/60 p-2 shadow-lg"
      >
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              className={`gap-2 ${item.tone === "danger" ? "text-error" : ""}`}
              onClick={() => {
                (document.activeElement as HTMLElement | null)?.blur();
                item.onClick();
              }}
            >
              <Icon icon={item.icon} className="h-4 w-4" />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface FolderRowProps {
  folder: FolderEntry & { isOptimistic?: boolean };
  busy: boolean;
  isDeletingFolder: boolean;
  onNavigate: (path: string) => void;
  onRequestDelete: (path: string, name: string) => void;
}

export function FolderRow({
  folder,
  busy,
  isDeletingFolder,
  onNavigate,
  onRequestDelete,
}: FolderRowProps) {
  const isOptimistic = "isOptimistic" in folder;
  return (
    <tr className={isOptimistic ? "opacity-60" : ""}>
      <td className="min-w-0">
        <span className="flex w-full min-w-0 items-center gap-1 sm:gap-2 align-middle">
          <Icon
            icon={isOptimistic ? "mdi:folder-sync" : "mdi:folder"}
            className="h-5 w-5 shrink-0 text-warning"
          />
          {isOptimistic && <span className="loading loading-spinner loading-xs shrink-0"></span>}
          <button
            type="button"
            className="block min-w-0 truncate text-left font-medium link link-hover"
            onClick={() => onNavigate(folder.path)}
          >
            {folder.name}
          </button>
        </span>
      </td>
      <td className="hidden text-base-content/50 sm:table-cell">-</td>
      <td className="hidden text-base-content/50 sm:table-cell">-</td>
      <td className="text-right">
        {!isOptimistic && (
          <RowActionsMenu
            busy={busy}
            isLoading={isDeletingFolder}
            items={[
              {
                label: "删除",
                icon: "mdi:delete-outline",
                tone: "danger",
                onClick: () => onRequestDelete(folder.path, folder.name),
              },
            ]}
          />
        )}
      </td>
    </tr>
  );
}

interface FileRowProps {
  file: FileEntry;
  busy: boolean;
  isDeletingFile: boolean;
  isDownloading: boolean;
  onDownload: (path: string, name: string) => void;
  onRequestDelete: (path: string, name: string) => void;
  onPreview: (file: FileEntry) => void;
  onShare: (file: FileEntry) => void;
  onShowDetails: (file: FileEntry) => void;
}

export function FileRow({
  file,
  busy,
  isDeletingFile,
  isDownloading,
  onDownload,
  onRequestDelete,
  onPreview,
  onShare,
  onShowDetails,
}: FileRowProps) {
  const fileIcon = getFileIcon(file.name);
  return (
    <tr>
      <td className="min-w-0 font-medium">
        <span className="flex w-full min-w-0 items-start gap-1 sm:gap-2 align-middle">
          <Icon icon={fileIcon.icon} className={`h-5 w-5 shrink-0 ${fileIcon.color}`} />
          <button
            type="button"
            className="min-w-0 truncate text-left link link-hover"
            onClick={() => onPreview(file)}
          >
            {file.name}
          </button>
        </span>
      </td>
      <td className="hidden text-base-content/50 sm:table-cell text-[13px]">
        <span className="tooltip" data-tip={`${file.size.toLocaleString()} 字节`}>
          {formatBytes(file.size)}
        </span>
      </td>
      <td className="hidden whitespace-nowrap text-base-content/50 sm:table-cell text-[13px]">
        {formatDate(file.uploadedAt)}
      </td>
      <td className="text-right">
        <RowActionsMenu
          busy={busy}
          isLoading={isDownloading || isDeletingFile}
          items={[
            {
              label: "下载",
              icon: "mdi:download",
              onClick: () => onDownload(file.path, file.name),
            },
            {
              label: "分享",
              icon: "mdi:share-variant-outline",
              onClick: () => onShare(file),
            },
            {
              label: "删除",
              icon: "mdi:delete-outline",
              tone: "danger",
              onClick: () => onRequestDelete(file.path, file.name),
            },
            {
              label: "查看详情",
              icon: "mdi:information-outline",
              onClick: () => onShowDetails(file),
            },
          ]}
        />
      </td>
    </tr>
  );
}
