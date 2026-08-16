import type { Context } from "hono";
import { Marked, type Token } from "marked";
import githubMarkdownCss from "github-markdown-css/github-markdown.css?raw";
import type { AppContext } from "../context";
import {
  HTML_RENDER_EXTENSIONS,
  MARKDOWN_RENDER_EXTENSIONS,
  RENDERED_MARKDOWN_MAX_BYTES,
  type RenderedPreviewKind,
} from "../../types";
import { getValidatedQuery, type PathQuery } from "../validation";
import { getFileContext } from "../utils/appHelpers";
import { assertPathAccess, handleFolderPasswordError } from "../utils/folderPasswords";
import { getBaseName, getFileKey, normalizeRelativePath } from "../utils/fileManager";
import { handlePathValidationError, jsonError } from "../utils/response";
import { assertPathNotReserved } from "./filesShared";

const RENDERED_PREVIEW_CACHE_CONTROL = "private, no-cache";
const RENDERED_PREVIEW_VARY = "Cookie";

const HTML_RENDERED_CSP = [
  "default-src * data: blob:",
  "script-src * 'unsafe-inline' 'unsafe-eval'",
  "style-src * 'unsafe-inline'",
].join("; ");
const MARKDOWN_RENDERED_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "img-src https: data: blob:",
  "style-src 'unsafe-inline'",
].join("; ");

const MARKDOWN_DOCUMENT_STYLES = `
${githubMarkdownCss}
.markdown-body {
  box-sizing: border-box;
  min-width: 200px;
  max-width: 980px;
  margin: 0 auto;
  padding: 45px;
}
@media (max-width: 767px) {
  .markdown-body {
    padding: 15px;
  }
}
`;

const markdownRenderer = new Marked({
  gfm: true,
  breaks: false,
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeRenderedUrl(value: string, isImage: boolean): boolean {
  const url = value.trim();

  if (url.startsWith("#") || url.startsWith("//") || /^https?:\/\//i.test(url)) {
    return true;
  }

  if (!isImage && /^mailto:/i.test(url)) {
    return true;
  }

  if (isImage && /^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml|avif);/i.test(url)) {
    return true;
  }

  return !/^[a-z][a-z0-9+.-]*:/i.test(url);
}

markdownRenderer.use({
  renderer: {
    html(token) {
      return escapeHtml(token.text);
    },
  },
  walkTokens(token: Token) {
    if (token.type === "link" || token.type === "image") {
      const isImage = token.type === "image";
      if (!isSafeRenderedUrl(token.href, isImage)) {
        token.href = isImage ? "" : "#";
      }
    }
  },
});

function getRenderedPreviewKind(
  path: string,
  contentType: string | null,
): RenderedPreviewKind | null {
  const ext = getBaseName(path).split(".").pop()?.toLowerCase() ?? "";
  const normalizedContentType = (contentType ?? "").toLowerCase();

  if (
    HTML_RENDER_EXTENSIONS.has(ext) ||
    normalizedContentType === "text/html" ||
    normalizedContentType === "application/xhtml+xml"
  ) {
    return "html";
  }

  if (MARKDOWN_RENDER_EXTENSIONS.has(ext) || normalizedContentType === "text/markdown") {
    return "markdown";
  }

  return null;
}

function createRenderedPreviewHeaders(kind: RenderedPreviewKind, contentLength?: number): Headers {
  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", RENDERED_PREVIEW_CACHE_CONTROL);
  headers.set("Vary", RENDERED_PREVIEW_VARY);
  headers.set(
    "Content-Security-Policy",
    kind === "html" ? HTML_RENDERED_CSP : MARKDOWN_RENDERED_CSP,
  );

  if (contentLength !== undefined) {
    headers.set("Content-Length", String(contentLength));
  }

  return headers;
}

export function renderMarkdownToHtml(markdown: string): string {
  const renderedBody = markdownRenderer.parse(markdown, { async: false });

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${MARKDOWN_DOCUMENT_STYLES}</style></head><body><article class="markdown-body">${renderedBody}</article></body></html>`;
}

export async function renderPreviewFile(c: Context<AppContext>) {
  try {
    const query = getValidatedQuery<PathQuery>(c);
    const path = normalizeRelativePath(query.path, { allowEmpty: false, label: "Path" });
    assertPathNotReserved(path);
    const { rootDirId } = await getFileContext(c);
    await assertPathAccess(c, rootDirId, path);

    const object = await c.env.FILES_BUCKET.get(getFileKey(rootDirId, path));
    if (!object) {
      return jsonError(c, "File not found", 404);
    }

    const kind = getRenderedPreviewKind(path, object.httpMetadata?.contentType ?? null);
    if (!kind) {
      return jsonError(c, "Rendered preview is not supported for this file type", 415, {
        "Cache-Control": RENDERED_PREVIEW_CACHE_CONTROL,
        Vary: RENDERED_PREVIEW_VARY,
      });
    }

    if (kind === "html") {
      return new Response(object.body, {
        headers: createRenderedPreviewHeaders(kind, object.size),
        status: 200,
      });
    }

    if (object.size > RENDERED_MARKDOWN_MAX_BYTES) {
      return jsonError(c, "Markdown file is too large to render", 413, {
        "Cache-Control": RENDERED_PREVIEW_CACHE_CONTROL,
        Vary: RENDERED_PREVIEW_VARY,
      });
    }

    const markdown = await object.text();
    const html = renderMarkdownToHtml(markdown);
    const body = new TextEncoder().encode(html);

    return new Response(body, {
      headers: createRenderedPreviewHeaders(kind, body.byteLength),
      status: 200,
    });
  } catch (error) {
    const folderPasswordError = handleFolderPasswordError(error);
    if (folderPasswordError) {
      return folderPasswordError;
    }
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }
    console.error("Failed to render file preview", error);
    return jsonError(c, "Failed to render file preview", 500);
  }
}
