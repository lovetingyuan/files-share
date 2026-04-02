/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env } from "cloudflare:workers";
import { runInDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { FileListResponse } from "../src/shared/file-manager";
import type { User } from "../src/worker/types";
import { generateSalt, hashPassword } from "../src/worker/utils/password";

function createEmailAddress(): string {
  return `user-${crypto.randomUUID()}@example.com`;
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

  return SELF.fetch(`https://example.com${path}`, {
    ...init,
    headers,
  });
}

function createOversizedBody(byteLength: number): ReadableStream<Uint8Array> {
  let remaining = byteLength;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (remaining <= 0) {
        controller.close();
        return;
      }

      const chunkSize = Math.min(remaining, 64 * 1024);
      controller.enqueue(new Uint8Array(chunkSize));
      remaining -= chunkSize;
    },
  });
}

describe("authenticated R2 file manager", () => {
  it("rejects unauthenticated list, download, and delete requests", async () => {
    const listResponse = await apiFetch("/api/files");
    const downloadResponse = await apiFetch("/api/files/object?path=hello.txt");
    const deleteResponse = await apiFetch("/api/files/object?path=hello.txt", {
      method: "DELETE",
    });

    expect(listResponse.status).toBe(401);
    expect(downloadResponse.status).toBe(401);
    expect(deleteResponse.status).toBe(401);
  });

  it("backfills rootDirId for existing users on first file access", async () => {
    const { email, stub } = await createVerifiedUser();

    await runInDurableObject(stub, async (_instance, state) => {
      const storedUser = await state.storage.get<User>("user");
      if (!storedUser) {
        throw new Error("Expected user to exist");
      }

      delete storedUser.rootDirId;
      await state.storage.put("user", storedUser);
    });

    const cookie = await createSessionCookie(email);
    const response = await apiFetch("/api/files", {}, cookie);
    const payload = (await response.json()) as FileListResponse;
    const updatedUser = await stub.getUser();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(updatedUser?.rootDirId).toMatch(/^[a-f0-9]{32}$/);
  });

  it("creates folders and supports file upload, list, download, and delete", async () => {
    const { email } = await createVerifiedUser();
    const cookie = await createSessionCookie(email);

    const createFolderResponse = await apiFetch(
      "/api/files/folders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "docs",
          parentPath: "",
        }),
      },
      cookie,
    );

    expect(createFolderResponse.status).toBe(201);

    const rootListResponse = await apiFetch("/api/files", {}, cookie);
    const rootList = (await rootListResponse.json()) as FileListResponse;

    expect(rootList.folders).toEqual([{ name: "docs", path: "docs" }]);

    const fileContents = "hello world";
    const uploadResponse = await apiFetch(
      "/api/files/object?parentPath=docs&name=hello.txt",
      {
        method: "PUT",
        headers: {
          "Content-Length": String(fileContents.length),
          "Content-Type": "text/plain",
        },
        body: fileContents,
      },
      cookie,
    );

    expect(uploadResponse.status).toBe(201);

    const folderListResponse = await apiFetch("/api/files?path=docs", {}, cookie);
    const folderList = (await folderListResponse.json()) as FileListResponse;

    expect(folderList.files).toHaveLength(1);
    expect(folderList.files[0]).toMatchObject({
      name: "hello.txt",
      path: "docs/hello.txt",
      size: fileContents.length,
      contentType: "text/plain",
    });

    const downloadResponse = await apiFetch("/api/files/object?path=docs/hello.txt", {}, cookie);
    const downloadedText = await downloadResponse.text();

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("Content-Disposition")).toContain("attachment;");
    expect(downloadResponse.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(downloadedText).toBe(fileContents);

    const deleteResponse = await apiFetch("/api/files/object?path=docs/hello.txt", {
      method: "DELETE",
    }, cookie);

    expect(deleteResponse.status).toBe(200);

    const afterDeleteResponse = await apiFetch("/api/files?path=docs", {}, cookie);
    const afterDeleteList = (await afterDeleteResponse.json()) as FileListResponse;

    expect(afterDeleteList.files).toHaveLength(0);
  });

  it("enforces path validation, collision checks, upload limits, and user isolation", async () => {
    const firstUser = await createVerifiedUser();
    const firstCookie = await createSessionCookie(firstUser.email);

    const secondUser = await createVerifiedUser();
    const secondCookie = await createSessionCookie(secondUser.email);

    const invalidPathResponse = await apiFetch("/api/files?path=/", {}, firstCookie);
    expect(invalidPathResponse.status).toBe(400);

    const reservedFolderResponse = await apiFetch(
      "/api/files/folders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: ".fileshare-folder",
          parentPath: "",
        }),
      },
      firstCookie,
    );
    expect(reservedFolderResponse.status).toBe(400);

    const createFolderResponse = await apiFetch(
      "/api/files/folders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "docs",
          parentPath: "",
        }),
      },
      firstCookie,
    );
    expect(createFolderResponse.status).toBe(201);

    const folderCollisionResponse = await apiFetch(
      "/api/files/object?name=docs",
      {
        method: "PUT",
        headers: {
          "Content-Length": String("collision".length),
          "Content-Type": "text/plain",
        },
        body: "collision",
      },
      firstCookie,
    );
    expect(folderCollisionResponse.status).toBe(409);

    const uploadFileResponse = await apiFetch(
      "/api/files/object?name=report.txt",
      {
        method: "PUT",
        headers: {
          "Content-Length": String("report".length),
          "Content-Type": "text/plain",
        },
        body: "report",
      },
      firstCookie,
    );
    expect(uploadFileResponse.status).toBe(201);

    const fileCollisionResponse = await apiFetch(
      "/api/files/folders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "report.txt",
          parentPath: "",
        }),
      },
      firstCookie,
    );
    expect(fileCollisionResponse.status).toBe(409);

    const oversizedUploadResponse = await apiFetch(
      "/api/files/object?name=too-large.bin",
      {
        method: "PUT",
        headers: {
          "Content-Length": String(Number.parseInt(env.MAX_UPLOAD_BYTES, 10) + 1),
          "Content-Type": "application/octet-stream",
        },
        body: createOversizedBody(Number.parseInt(env.MAX_UPLOAD_BYTES, 10) + 1),
      },
      firstCookie,
    );
    expect(oversizedUploadResponse.status).toBe(413);

    const isolatedPath = `${firstUser.user?.rootDirId}/report.txt`;
    const isolationResponse = await apiFetch(
      `/api/files/object?path=${encodeURIComponent(isolatedPath)}`,
      {},
      secondCookie,
    );
    expect(isolationResponse.status).toBe(404);
  });
});
