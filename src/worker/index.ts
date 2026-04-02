import { Hono } from "hono";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import type { FileListResponse, FileMutationResponse } from "../shared/file-manager";
import { UserDO } from "./durable-objects/UserDO";
import { authMiddleware, requireAuth } from "./middleware/auth";
import type { AuthVariables } from "./middleware/auth";
import type { User } from "./types";
import { sendVerificationEmail } from "./utils/email";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  FilePathValidationError,
  FOLDER_MARKER_NAME,
  getBaseName,
  getFileKey,
  getFolderMarkerKey,
  getFolderPrefix,
  joinRelativePath,
  normalizeName,
  normalizeRelativePath,
  parseMaxUploadBytes,
  toContentDisposition,
} from "./utils/fileManager";
import {
  generateSalt,
  hashPassword,
  validateEmail,
  validatePassword,
  verifyPassword,
} from "./utils/password";

export { UserDO };

type AppBindings = Env & {
  APP_URL?: string;
  ENVIRONMENT?: string;
  MAX_UPLOAD_BYTES?: string;
  RESEND_API_KEY?: string;
  SENDER_EMAIL?: string;
};

type AppContext = {
  Bindings: AppBindings;
  Variables: AuthVariables;
};

type FileContext = {
  rootDirId: string;
  user: User;
};

class UploadTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadTooLargeError";
  }
}

const app = new Hono<AppContext>();

function appendVary(currentValue: string | null, nextValue: string): string {
  const existingValues = (currentValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!existingValues.includes(nextValue)) {
    existingValues.push(nextValue);
  }

  return existingValues.join(", ");
}

function getAllowedOrigins(c: Context<AppContext>): Set<string> {
  const allowedOrigins = new Set<string>([new URL(c.req.url).origin]);
  if (c.env.APP_URL) {
    try {
      allowedOrigins.add(new URL(c.env.APP_URL).origin);
    } catch (error) {
      console.warn("APP_URL is not a valid URL:", error);
    }
  }

  return allowedOrigins;
}

function isAllowedOrigin(c: Context<AppContext>, origin: string): boolean {
  return getAllowedOrigins(c).has(origin);
}

function applyCorsHeaders(headers: Headers, origin: string): void {
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  headers.set("Vary", appendVary(headers.get("Vary"), "Origin"));
}

function jsonError(_c: Context<AppContext>, message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function handlePathValidationError(
  c: Context<AppContext>,
  error: unknown,
): Response | undefined {
  if (error instanceof FilePathValidationError) {
    return jsonError(c, error.message, error.status);
  }

  return undefined;
}

function getUploadLimitBytes(env: AppBindings): number {
  return parseMaxUploadBytes(env.MAX_UPLOAD_BYTES) || DEFAULT_MAX_UPLOAD_BYTES;
}

function createUploadStream(
  body: ReadableStream<Uint8Array>,
  maxUploadBytes: number,
): ReadableStream<Uint8Array> {
  let totalBytes = 0;

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        totalBytes += chunk.byteLength;
        if (totalBytes > maxUploadBytes) {
          throw new UploadTooLargeError("File exceeds the upload size limit");
        }

        controller.enqueue(chunk);
      },
    }),
  );
}

async function folderExists(
  env: AppBindings,
  rootDirId: string,
  folderPath: string,
): Promise<boolean> {
  if (!folderPath) {
    return true;
  }

  const markerKey = getFolderMarkerKey(rootDirId, folderPath);
  const marker = await env.FILES_BUCKET.head(markerKey);
  if (marker) {
    return true;
  }

  const listing = await env.FILES_BUCKET.list({
    prefix: getFolderPrefix(rootDirId, folderPath),
    limit: 1,
  });

  return listing.objects.length > 0 || listing.delimitedPrefixes.length > 0;
}

async function getFileContext(c: Context<AppContext>): Promise<FileContext> {
  const user = c.get("user");
  if (!user) {
    throw new Error("Authenticated user missing from context");
  }

  const stub = c.env.USER_DO.getByName(user.email);
  const rootDirId = user.rootDirId ?? (await stub.ensureRootDirId());
  if (!rootDirId) {
    throw new Error("Failed to resolve user root directory");
  }

  if (!user.rootDirId) {
    c.set("user", { ...user, rootDirId });
  }

  return {
    rootDirId,
    user: { ...user, rootDirId },
  };
}

app.get("/health", (c) => c.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/*", async (c, next) => {
  const origin = c.req.header("Origin");
  if (origin && !isAllowedOrigin(c, origin)) {
    return jsonError(c, "Origin not allowed", 403);
  }

  if (c.req.method === "OPTIONS") {
    const headers = new Headers();
    if (origin) {
      applyCorsHeaders(headers, origin);
    }

    return new Response(null, { status: 204, headers });
  }

  await next();

  if (origin && isAllowedOrigin(c, origin)) {
    applyCorsHeaders(c.res.headers, origin);
  }
});

app.use(
  "/api/*",
  csrf({
    origin: (origin, c) => isAllowedOrigin(c as Context<AppContext>, origin),
  }),
);

app.use("/api/*", authMiddleware());

app.post("/api/auth/register", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const { email, password } = body;

  if (!email || !validateEmail(email)) {
    return jsonError(c, "Invalid email address", 400);
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return jsonError(c, passwordValidation.errors.join(", "), 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const stub = c.env.USER_DO.getByName(normalizedEmail);
  const existingUser = await stub.getUser();
  if (existingUser) {
    return jsonError(c, "An account with this email already exists", 400);
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const createResult = await stub.createUser(normalizedEmail, passwordHash, salt);
  if (!createResult.success) {
    return jsonError(c, createResult.error ?? "Failed to create user", 400);
  }

  const resendApiKey = c.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return jsonError(c, "Email delivery is not configured", 500);
  }

  const verificationToken = await stub.createVerificationToken("email");
  const appUrl = c.env.APP_URL ?? new URL(c.req.url).origin;
  const senderEmail = c.env.SENDER_EMAIL ?? "fileshare@tingyuan.in";

  await sendVerificationEmail(
    {
      to: normalizedEmail,
      verificationToken,
      appUrl,
    },
    resendApiKey,
    senderEmail,
  );

  return c.json({
    success: true,
    message: "Registration successful! Please check your email to verify your account.",
  });
});

async function handleLogin(c: Context<AppContext>) {
  try {
    const body = await c.req.json<{ email: string; password: string }>();
    const { email, password } = body;

    if (!email || !password) {
      return jsonError(c, "Email and password are required", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const stub = c.env.USER_DO.getByName(normalizedEmail);
    const user = await stub.getUser();

    if (!user) {
      return jsonError(c, "Invalid email or password", 400);
    }

    if (!user.verified) {
      return jsonError(c, "Please verify your email before logging in", 403);
    }

    const isValid = await verifyPassword(password, user.salt, user.passwordHash);
    if (!isValid) {
      return jsonError(c, "Invalid email or password", 400);
    }

    const session = await stub.createSession();
    const isProduction = c.env.ENVIRONMENT === "production";
    const cookieOptions = {
      path: "/",
      secure: isProduction,
      httpOnly: true,
      sameSite: "Strict" as const,
      maxAge: 30 * 24 * 60 * 60,
    };

    setCookie(c, "session_token", session.token, cookieOptions);
    setCookie(c, "user_email", normalizedEmail, cookieOptions);

    return c.json({
      success: true,
      message: "Login successful",
      user: {
        email: user.email,
        verified: user.verified,
      },
    });
  } catch (error) {
    console.error("Login route failed", error);
    return jsonError(c, error instanceof Error ? error.message : "Login failed", 500);
  }
}

app.post("/api/auth/login", handleLogin);

app.post("/api/auth/logout", async (c) => {
  const sessionToken = c.get("sessionToken");
  const userEmail = c.get("userEmail");

  if (sessionToken && userEmail) {
    const stub = c.env.USER_DO.getByName(userEmail);
    await stub.deleteSession(sessionToken);
  }

  deleteCookie(c, "session_token");
  deleteCookie(c, "user_email");

  return c.json({ success: true, message: "Logged out successfully" });
});

app.get("/api/auth/verify/:token", async (c) => {
  const token = c.req.param("token");

  if (!token) {
    return c.redirect("/login?error=Invalid verification link");
  }

  return jsonError(
    c,
    "Email required for verification. Please use the verification link from your email.",
    400,
  );
});

app.post("/api/auth/verify", async (c) => {
  const body = await c.req.json<{ token: string; email: string }>();
  const { token, email } = body;

  if (!token || !email) {
    return jsonError(c, "Token and email are required", 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const stub = c.env.USER_DO.getByName(normalizedEmail);
  const verification = await stub.consumeVerificationToken(token);
  if (!verification) {
    return jsonError(c, "Invalid or expired verification token", 400);
  }

  await stub.verifyEmail();

  return c.json({ success: true, message: "Email verified successfully" });
});

app.get("/api/auth/me", requireAuth(), async (c) => {
  const user = c.get("user");
  return c.json({
    success: true,
    user: {
      email: user!.email,
      verified: user!.verified,
      createdAt: user!.createdAt,
    },
  });
});

app.post("/api/auth/resend-verification", async (c) => {
  const body = await c.req.json<{ email: string }>();
  const { email } = body;

  if (!email || !validateEmail(email)) {
    return jsonError(c, "Invalid email address", 400);
  }

  const resendApiKey = c.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return jsonError(c, "Email delivery is not configured", 500);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const stub = c.env.USER_DO.getByName(normalizedEmail);
  const user = await stub.getUser();

  if (!user) {
    return c.json({
      success: true,
      message: "If an account exists, a verification email has been sent.",
    });
  }

  if (user.verified) {
    return jsonError(c, "Email is already verified", 400);
  }

  const verificationToken = await stub.createVerificationToken("email");
  const appUrl = c.env.APP_URL ?? new URL(c.req.url).origin;
  const senderEmail = c.env.SENDER_EMAIL ?? "fileshare@tingyuan.in";

  await sendVerificationEmail(
    {
      to: normalizedEmail,
      verificationToken,
      appUrl,
    },
    resendApiKey,
    senderEmail,
  );

  return c.json({
    success: true,
    message: "If an account exists, a verification email has been sent.",
  });
});

app.get("/api/files", requireAuth(), async (c) => {
  try {
    const path = normalizeRelativePath(c.req.query("path"), { allowEmpty: true, label: "Path" });
    const cursor = c.req.query("cursor") || undefined;
    const { rootDirId } = await getFileContext(c);

    if (path && !(await folderExists(c.env, rootDirId, path))) {
      return jsonError(c, "Folder not found", 404);
    }

    const prefix = getFolderPrefix(rootDirId, path);
    const listing = await c.env.FILES_BUCKET.list({
      cursor,
      delimiter: "/",
      include: ["httpMetadata", "customMetadata"],
      prefix,
    });

    const folders = listing.delimitedPrefixes
      .map((folderPrefix) => folderPrefix.slice(prefix.length).replace(/\/$/, ""))
      .filter(Boolean)
      .map((name) => ({
        name,
        path: joinRelativePath(path, name),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    const files = listing.objects
      .filter((object) => object.key !== `${prefix}${FOLDER_MARKER_NAME}`)
      .map((object) => {
        const name = object.key.slice(prefix.length);
        return {
          name,
          path: joinRelativePath(path, name),
          size: object.size,
          uploadedAt: object.uploaded.toISOString(),
          contentType: object.httpMetadata?.contentType ?? null,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    const response: FileListResponse = {
      success: true,
      path,
      folders,
      files,
      truncated: listing.truncated,
      ...(listing.truncated ? { cursor: listing.cursor } : {}),
    };

    return c.json(response);
  } catch (error) {
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }

    console.error("Failed to list files", error);
    return jsonError(c, "Failed to list files", 500);
  }
});

app.post("/api/files/folders", requireAuth(), async (c) => {
  try {
    const body = await c.req.json<{ parentPath?: string; name?: string }>();
    const parentPath = normalizeRelativePath(body.parentPath, {
      allowEmpty: true,
      label: "Parent path",
    });
    const name = normalizeName(body.name, "Folder name");
    const folderPath = joinRelativePath(parentPath, name);
    const { rootDirId } = await getFileContext(c);

    if (!(await folderExists(c.env, rootDirId, parentPath))) {
      return jsonError(c, "Parent folder not found", 404);
    }

    const fileCollision = await c.env.FILES_BUCKET.head(getFileKey(rootDirId, folderPath));
    if (fileCollision) {
      return jsonError(c, "A file with this name already exists", 409);
    }

    if (await folderExists(c.env, rootDirId, folderPath)) {
      return jsonError(c, "A folder with this name already exists", 409);
    }

    const markerKey = getFolderMarkerKey(rootDirId, folderPath);
    const putResult = await c.env.FILES_BUCKET.put(markerKey, new Uint8Array(), {
      customMetadata: {
        kind: "folder-marker",
      },
      onlyIf: new Headers({ "If-None-Match": "*" }),
    });

    if (!putResult) {
      return jsonError(c, "A folder with this name already exists", 409);
    }

    const response: FileMutationResponse = {
      success: true,
      message: "Folder created successfully",
    };

    return c.json(response, 201);
  } catch (error) {
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }

    console.error("Failed to create folder", error);
    return jsonError(c, "Failed to create folder", 500);
  }
});

app.delete("/api/files/folders", requireAuth(), async (c) => {
  try {
    const path = normalizeRelativePath(c.req.query("path"), {
      allowEmpty: false,
      label: "Path",
    });
    const { rootDirId } = await getFileContext(c);

    if (!(await folderExists(c.env, rootDirId, path))) {
      return jsonError(c, "Folder not found", 404);
    }

    const prefix = getFolderPrefix(rootDirId, path);
    const keysToDelete: string[] = [];

    let cursor: string | undefined;
    do {
      const listing = await c.env.FILES_BUCKET.list({ prefix, cursor });
      for (const object of listing.objects) {
        keysToDelete.push(object.key);
      }
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor);

    // R2 delete accepts up to 1000 keys at a time
    for (let i = 0; i < keysToDelete.length; i += 1000) {
      await c.env.FILES_BUCKET.delete(keysToDelete.slice(i, i + 1000));
    }

    const response: FileMutationResponse = {
      success: true,
      message: "Folder deleted successfully",
    };

    return c.json(response);
  } catch (error) {
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }

    console.error("Failed to delete folder", error);
    return jsonError(c, "Failed to delete folder", 500);
  }
});

app.put("/api/files/object", requireAuth(), async (c) => {
  try {
    const parentPath = normalizeRelativePath(c.req.query("parentPath"), {
      allowEmpty: true,
      label: "Parent path",
    });
    const name = normalizeName(c.req.query("name"), "File name");
    const filePath = joinRelativePath(parentPath, name);
    const { rootDirId } = await getFileContext(c);

    if (!(await folderExists(c.env, rootDirId, parentPath))) {
      return jsonError(c, "Parent folder not found", 404);
    }

    if (await folderExists(c.env, rootDirId, filePath)) {
      return jsonError(c, "A folder with this name already exists", 409);
    }

    const body = c.req.raw.body;
    if (!body) {
      return jsonError(c, "File body is required", 400);
    }

    const maxUploadBytes = getUploadLimitBytes(c.env);
    const contentLengthHeader = c.req.header("content-length");
    if (!contentLengthHeader) {
      return jsonError(c, "Content-Length header is required for uploads", 411);
    }

    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      return jsonError(c, "Invalid Content-Length header", 400);
    }

    if (contentLength > maxUploadBytes) {
      return jsonError(c, "File exceeds the upload size limit", 413);
    }

    const uploadStream = createUploadStream(body as ReadableStream<Uint8Array>, maxUploadBytes);
    const fixedLengthStream = new FixedLengthStream(contentLength);
    const pipingPromise = uploadStream.pipeTo(fixedLengthStream.writable);
    const fileKey = getFileKey(rootDirId, filePath);
    const contentType = c.req.header("content-type") ?? "application/octet-stream";
    const putResult = await Promise.all([
      c.env.FILES_BUCKET.put(fileKey, fixedLengthStream.readable, {
        customMetadata: {
          originalName: name,
        },
        httpMetadata: {
          contentType,
        },
        onlyIf: new Headers({ "If-None-Match": "*" }),
      }),
      pipingPromise,
    ]).then(([result]) => result);

    if (!putResult) {
      return jsonError(c, "A file with this name already exists", 409);
    }

    const response: FileMutationResponse = {
      success: true,
      message: "File uploaded successfully",
    };

    return c.json(response, 201);
  } catch (error) {
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }

    if (error instanceof UploadTooLargeError) {
      return jsonError(c, error.message, 413);
    }

    console.error("Failed to upload file", error);
    return jsonError(c, "Failed to upload file", 500);
  }
});

app.get("/api/files/object", requireAuth(), async (c) => {
  try {
    const path = normalizeRelativePath(c.req.query("path"), {
      allowEmpty: false,
      label: "Path",
    });
    const { rootDirId } = await getFileContext(c);
    const object = await c.env.FILES_BUCKET.get(getFileKey(rootDirId, path));

    if (!object || !object.body) {
      return jsonError(c, "File not found", 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Disposition", toContentDisposition(object.customMetadata?.originalName ?? getBaseName(path)));
    headers.set("ETag", object.httpEtag);
    headers.set("Last-Modified", object.uploaded.toUTCString());
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(object.body, {
      headers,
      status: 200,
    });
  } catch (error) {
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }

    console.error("Failed to download file", error);
    return jsonError(c, "Failed to download file", 500);
  }
});

app.delete("/api/files/object", requireAuth(), async (c) => {
  try {
    const path = normalizeRelativePath(c.req.query("path"), {
      allowEmpty: false,
      label: "Path",
    });
    const { rootDirId } = await getFileContext(c);
    const fileKey = getFileKey(rootDirId, path);
    const object = await c.env.FILES_BUCKET.head(fileKey);

    if (!object) {
      return jsonError(c, "File not found", 404);
    }

    await c.env.FILES_BUCKET.delete(fileKey);

    const response: FileMutationResponse = {
      success: true,
      message: "File deleted successfully",
    };

    return c.json(response);
  } catch (error) {
    const validationError = handlePathValidationError(c, error);
    if (validationError) {
      return validationError;
    }

    console.error("Failed to delete file", error);
    return jsonError(c, "Failed to delete file", 500);
  }
});

export default app;
