import { describe, expect, it } from "vitest";
import type { FileEntry } from "../src/types";
import { getRenderedPreviewKind } from "../src/react-app/utils/previewInfo";
import { renderMarkdownToHtml } from "../src/worker/routes/fileRenderHandler";

function fileEntry(name: string, contentType = "text/plain"): FileEntry {
  return {
    name,
    path: name,
    size: 1024,
    createdAt: "2026-08-16T00:00:00.000Z",
    uploadedAt: "2026-08-16T00:00:00.000Z",
    contentType,
    checksums: null,
    protectedBy: null,
  };
}

describe("getRenderedPreviewKind", () => {
  it("recognizes markdown files", () => {
    expect(getRenderedPreviewKind(fileEntry("readme.md"))).toBe("markdown");
    expect(getRenderedPreviewKind(fileEntry("README.MARKDOWN"))).toBe("markdown");
    expect(getRenderedPreviewKind(fileEntry("notes", "text/markdown"))).toBe("markdown");
  });

  it("recognizes html files", () => {
    expect(getRenderedPreviewKind(fileEntry("index.html"))).toBe("html");
    expect(getRenderedPreviewKind(fileEntry("page.htm"))).toBe("html");
    expect(getRenderedPreviewKind(fileEntry("page", "text/html"))).toBe("html");
  });

  it("returns null for unsupported files", () => {
    expect(getRenderedPreviewKind(fileEntry("notes.txt"))).toBeNull();
    expect(getRenderedPreviewKind(fileEntry("archive.zip", "application/zip"))).toBeNull();
  });
});

describe("renderMarkdownToHtml", () => {
  it("renders common markdown blocks", () => {
    const html = renderMarkdownToHtml(
      [
        "# Title",
        "",
        "- [x] task",
        "",
        "| A | B |",
        "| - | - |",
        "| 1 | 2 |",
        "",
        "```ts",
        "const value = 1;",
        "```",
      ].join("\n"),
    );

    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("task");
    expect(html).toContain("<table>");
    expect(html).toContain("language-ts");
    expect(html).toContain('class="markdown-body"');
    expect(html).toContain(".markdown-body");
  });

  it("removes scripts and event handlers", () => {
    const html = renderMarkdownToHtml(
      '<script>alert("xss")</script>\n\n<img src="x" onerror="alert(1)">',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("keeps safe links and images but removes javascript URLs", () => {
    const html = renderMarkdownToHtml(
      [
        "[safe](https://example.com)",
        "[relative](./page.md)",
        "[bad](javascript:alert(1))",
        "![image](https://example.com/image.png)",
        "![data](data:image/png;base64,AAAA)",
      ].join("\n\n"),
    );

    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="./page.md"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain('src="https://example.com/image.png"');
    expect(html).toContain("data:image/png");
  });
});
