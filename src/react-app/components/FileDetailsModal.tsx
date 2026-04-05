import { Icon } from "@iconify/react";
import type { FileEntry } from "../../types";
import { formatBytes, formatDetailedDate } from "../utils/fileFormatters";

interface FileDetailsModalProps {
  file: FileEntry | null;
  onClose: () => void;
}

const detailItems = (file: FileEntry) => [
  {
    label: "名称",
    value: file.name,
  },
  {
    label: "路径",
    value: file.path,
    valueClassName: "break-all font-mono text-xs sm:text-sm",
  },
  {
    label: "大小",
    value: `${formatBytes(file.size)} (${file.size.toLocaleString()} 字节)`,
  },
  {
    label: "时间",
    value: formatDetailedDate(file.uploadedAt),
  },
];

export function FileDetailsModal({ file, onClose }: FileDetailsModalProps) {
  if (!file) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md bg-base-100 p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <p className="font-medium text-base-content">文件详情</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={onClose}
            aria-label="关闭文件详情弹窗"
          >
            <Icon icon="mdi:close" className="h-5 w-5" />
          </button>
        </div>

        <ul className="space-y-3">
          {detailItems(file).map((item) => (
            <li key={item.label} className="flex items-start gap-1 text-sm">
              <span className="w-12 shrink-0 text-base-content/60">{item.label}：</span>
              <div
                className={`min-w-0 flex-1 font-medium text-base-content ${item.valueClassName ?? ""}`}
              >
                {item.value}
              </div>
            </li>
          ))}
        </ul>

        <div className="modal-action mt-4">
          <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}
