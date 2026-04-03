import type { FileEntry } from "../../types";

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "unsupported";

export interface PreviewInfo {
  kind: PreviewKind;
  reason?: string;
}

const NATIVE_IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
]);
const NATIVE_VIDEO_EXTS = new Set(["mp4", "webm", "ogg"]);
const NATIVE_AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "aac", "flac", "m4a"]);
const UNSUPPORTED_IMAGE_EXTS = new Set(["psd", "ai", "tiff", "tif", "heic", "heif", "raw"]);
const UNSUPPORTED_VIDEO_EXTS = new Set(["avi", "mov", "mkv", "wmv", "flv", "m4v", "3gp"]);
const TEXT_EXTS = new Set([
  "txt",
  "log",
  "md",
  "json",
  "xml",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "py",
  "js",
  "ts",
  "jsx",
  "tsx",
  "css",
  "scss",
  "less",
  "html",
  "htm",
  "vue",
  "svelte",
  "rs",
  "go",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "php",
  "rb",
  "swift",
  "kt",
  "sql",
  "graphql",
  "gql",
  "csv",
  "tsv",
]);

export function getPreviewInfo(file: FileEntry): PreviewInfo {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const ct = (file.contentType ?? "").toLowerCase();

  if (NATIVE_IMAGE_EXTS.has(ext)) return { kind: "image" };
  if (UNSUPPORTED_IMAGE_EXTS.has(ext) || ct.startsWith("image/")) {
    if (ct.startsWith("image/") && !UNSUPPORTED_IMAGE_EXTS.has(ext)) return { kind: "image" };
    return { kind: "unsupported", reason: "该图片格式需要第三方库支持，暂不支持预览" };
  }

  if (NATIVE_VIDEO_EXTS.has(ext) || ["video/mp4", "video/webm", "video/ogg"].includes(ct)) {
    return { kind: "video" };
  }
  if (UNSUPPORTED_VIDEO_EXTS.has(ext) || ct.startsWith("video/")) {
    return { kind: "unsupported", reason: "该视频格式需要第三方库支持，暂不支持预览" };
  }

  if (
    NATIVE_AUDIO_EXTS.has(ext) ||
    [
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/aac",
      "audio/flac",
      "audio/x-flac",
      "audio/mp4",
      "audio/x-m4a",
    ].includes(ct)
  ) {
    return { kind: "audio" };
  }
  if (ct.startsWith("audio/")) {
    return { kind: "unsupported", reason: "该音频格式需要第三方库支持，暂不支持预览" };
  }

  if (ext === "pdf" || ct === "application/pdf") return { kind: "pdf" };

  if (
    TEXT_EXTS.has(ext) ||
    ct.startsWith("text/") ||
    ct === "application/json" ||
    ct === "application/xml"
  ) {
    return { kind: "text" };
  }

  return { kind: "unsupported", reason: "该文件类型暂不支持预览" };
}
