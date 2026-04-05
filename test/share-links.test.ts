/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env } from "cloudflare:workers";
import { SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import type {
  CreateShareLinkRequest,
  ShareLinkResponse,
  SharedFileMetadataResponse,
} from "../src/types";
import { generateSalt, hashPassword } from "../src/worker/utils/password";

function createEmailAddress(): string {
  return `share-user-${crypto.randomUUID()}@example.com`;
}

async function createVerifiedUser(email = createEmailAddress(), password = "Password1") {
  const stub = env.USER_DO.getByName(email);
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const result = await stub.createUser(email, passwordHash, salt);
  if (!result.success) {
    throw new Error(result.error ?? "Failed to create user");
  }

  await stub.verifyEmail();

  return {
    email,
    password,
    stub,
    user: await stub.getUser(),
  };
}

async function createSessionCookie(email: string): Promise<string> {
  const stub = env.USER_DO.getByName(email);
  const session = await stub.createSession();
  return `session_token=${session.token}; user_email=${email}`;
}

async function apiFetch(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  if (init.method && init.method !== "GET" && init.method !== "HEAD") {
    headers.set("Origin", "https://example.com");
  }

  const response = await SELF.fetch(`https://example.com${path}`, {
    ...init,
    headers,
  });

  if (response.body) {
    void response
      .clone()
      .arrayBuffer()
      .catch(() => undefined);
  }

  return response;
}

async function uploadTextFile(path: string, contents: string, cookie: string, overwrite = false) {
  const pathParts = path.split("/");
  const name = pathParts.pop() ?? "";
  const parentPath = pathParts.join("/");
  const params = new URLSearchParams({ name });
  if (parentPath) {
    params.set("parentPath", parentPath);
  }
  if (overwrite) {
    params.set("overwrite", "true");
  }

  return apiFetch(
    `/api/files/object?${params.toString()}`,
    {
      method: "PUT",
      headers: {
        "Content-Length": String(contents.length),
        "Content-Type": "text/plain",
      },
      body: contents,
    },
    cookie,
  );
}

async function createShareLink(
  path: string,
  expiresInSeconds: CreateShareLinkRequest["expiresInSeconds"],
  cookie: string,
): Promise<ShareLinkResponse> {
  const response = await apiFetch(
    "/api/files/share-links",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path, expiresInSeconds }),
    },
    cookie,
  );

  expect(response.status).toBe(200);
  return (await response.json()) as ShareLinkResponse;
}

function getShareToken(shareUrl: string): string {
  const url = new URL(shareUrl);
  const [, token = ""] = url.pathname.match(/^\/share\/(.+)$/u) ?? [];
  return decodeURIComponent(token);
}

describe("file share links", () => {
  it("requires authentication and validates allowed durations", async () => {
    const { email } = await createVerifiedUser();
    const cookie = await createSessionCookie(email);

    const unauthenticatedResponse = await apiFetch("/api/files/share-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: "hello.txt", expiresInSeconds: 3600 }),
    });

    expect(unauthenticatedResponse.status).toBe(401);

    const invalidDurationResponse = await apiFetch(
      "/api/files/share-links",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: "hello.txt", expiresInSeconds: 123 }),
      },
      cookie,
    );

    expect(invalidDurationResponse.status).toBe(400);
  });

  it("creates active share links and serves metadata plus downloads", async () => {
    const { email } = await createVerifiedUser();
    const cookie = await createSessionCookie(email);

    const uploadResponse = await uploadTextFile("share.txt", "hello share", cookie);
    expect(uploadResponse.status).toBe(201);

    const shareLink = await createShareLink("share.txt", 3600, cookie);
    const token = getShareToken(shareLink.shareUrl);

    expect(shareLink.fileName).toBe("share.txt");
    expect(shareLink.expiresInSeconds).toBe(3600);
    expect(shareLink.shareUrl).toContain("/share/");

    const metadataResponse = await apiFetch(`/api/share-links/${encodeURIComponent(token)}`);
    const metadata = (await metadataResponse.json()) as SharedFileMetadataResponse;

    expect(metadataResponse.status).toBe(200);
    expect(metadataResponse.headers.get("Cache-Control")).toContain("no-store");
    expect(metadata.status).toBe("active");
    expect(metadata.downloadUrl).toContain(
      `/api/share-links/${encodeURIComponent(token)}/download`,
    );

    const downloadUrl = new URL(metadata.downloadUrl ?? "");
    const downloadResponse = await apiFetch(downloadUrl.pathname);

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("Cache-Control")).toContain("no-store");
    expect(downloadResponse.headers.get("Content-Disposition")).toContain("attachment;");
    expect(await downloadResponse.text()).toBe("hello share");
  });

  it("blocks expired, deleted, tampered, and overwritten shared files", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T12:00:00.000Z"));

    try {
      const { email } = await createVerifiedUser();
      const cookie = await createSessionCookie(email);

      const uploadResponse = await uploadTextFile("share.txt", "first version", cookie);
      expect(uploadResponse.status).toBe(201);

      const shareLink = await createShareLink("share.txt", 600, cookie);
      const token = getShareToken(shareLink.shareUrl);

      vi.setSystemTime(new Date("2026-04-05T12:11:00.000Z"));

      const expiredMetadataResponse = await apiFetch(
        `/api/share-links/${encodeURIComponent(token)}`,
      );
      const expiredMetadata = (await expiredMetadataResponse.json()) as SharedFileMetadataResponse;
      const expiredDownloadResponse = await apiFetch(
        `/api/share-links/${encodeURIComponent(token)}/download`,
      );

      expect(expiredMetadata.status).toBe("expired");
      expect(expiredDownloadResponse.status).toBe(410);
      expect(expiredDownloadResponse.headers.get("Cache-Control")).toContain("no-store");

      vi.setSystemTime(new Date("2026-04-05T12:00:00.000Z"));

      const overwriteShareLink = await createShareLink("share.txt", 3600, cookie);
      const overwriteToken = getShareToken(overwriteShareLink.shareUrl);

      const overwriteResponse = await uploadTextFile("share.txt", "second version", cookie, true);
      expect(overwriteResponse.status).toBe(201);

      const missingMetadataResponse = await apiFetch(
        `/api/share-links/${encodeURIComponent(overwriteToken)}`,
      );
      const missingMetadata = (await missingMetadataResponse.json()) as SharedFileMetadataResponse;
      const missingDownloadResponse = await apiFetch(
        `/api/share-links/${encodeURIComponent(overwriteToken)}/download`,
      );

      expect(missingMetadata.status).toBe("missing");
      expect(missingDownloadResponse.status).toBe(404);

      const deleteShareLink = await createShareLink("share.txt", 3600, cookie);
      const deleteToken = getShareToken(deleteShareLink.shareUrl);

      const deleteResponse = await apiFetch(
        "/api/files/object?path=share.txt",
        { method: "DELETE" },
        cookie,
      );
      expect(deleteResponse.status).toBe(200);

      const deletedMetadataResponse = await apiFetch(
        `/api/share-links/${encodeURIComponent(deleteToken)}`,
      );
      const deletedMetadata = (await deletedMetadataResponse.json()) as SharedFileMetadataResponse;

      expect(deletedMetadata.status).toBe("missing");

      const tamperedToken = `${deleteToken.slice(0, -1)}${deleteToken.endsWith("a") ? "b" : "a"}`;
      const tamperedResponse = await apiFetch(
        `/api/share-links/${encodeURIComponent(tamperedToken)}`,
      );
      const tamperedDownloadResponse = await apiFetch(
        `/api/share-links/${encodeURIComponent(tamperedToken)}/download`,
      );

      expect(tamperedResponse.status).toBe(403);
      expect(tamperedDownloadResponse.status).toBe(403);
    } finally {
      vi.useRealTimers();
    }
  });
});
