import { RENDERED_MARKDOWN_MAX_BYTES } from "../../../../../types";

export const PREVIEW_SIZE_LIMITS = {
  TEXT: RENDERED_MARKDOWN_MAX_BYTES,
  IMAGE: 15 * 1024 * 1024,
  PDF: 30 * 1024 * 1024,
  VIDEO: 200 * 1024 * 1024,
  AUDIO: 100 * 1024 * 1024,
} as const;

export const PREVIEW_MEDIA_VOLUME_STORAGE_KEY = "fileyard:preview-media:volume";
