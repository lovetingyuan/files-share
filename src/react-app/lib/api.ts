export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type ErrorPayload = {
  error?: string;
  message?: string;
};

function hasErrorPayload(value: unknown): value is ErrorPayload {
  return typeof value === "object" && value !== null;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

export async function apiRequest<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const hasBody =
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams) &&
    !(init.body instanceof Blob) &&
    !(init.body instanceof ArrayBuffer);

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    credentials: init.credentials ?? "include",
    headers,
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const message =
      hasErrorPayload(data) && typeof data.error === "string"
        ? data.error
        : hasErrorPayload(data) && typeof data.message === "string"
          ? data.message
          : response.statusText || "Request failed";

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}
