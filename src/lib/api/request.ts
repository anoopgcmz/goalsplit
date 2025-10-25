export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    hint?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly hint?: string;
  public readonly details?: unknown;

  constructor(options: { status: number; message: string; code?: string; hint?: string; details?: unknown }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code ?? "UNKNOWN_API_ERROR";
    this.hint = options.hint;
    this.details = options.details;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

const parseErrorPayload = async (response: Response): Promise<ApiError> => {
  let message = `Request failed with status ${response.status}`;
  let code = "UNKNOWN_API_ERROR";
  let hint: string | undefined;
  let details: unknown;

  try {
    const data = (await response.json()) as ApiErrorPayload;
    details = data;
    if (data && typeof data === "object" && data.error) {
      if (typeof data.error.message === "string" && data.error.message.trim().length > 0) {
        message = data.error.message;
      }
      if (typeof data.error.code === "string" && data.error.code.trim().length > 0) {
        code = data.error.code;
      }
      if (typeof data.error.hint === "string" && data.error.hint.trim().length > 0) {
        hint = data.error.hint;
      }
    }
  } catch {
    // Ignore JSON parse issues and fall back to defaults.
  }

  return new ApiError({ status: response.status, message, code, hint, details });
};

const shouldAttachJsonHeader = (body: BodyInit | null | undefined, headers: Headers) => {
  if (!body) {
    return false;
  }

  if (headers.has("content-type")) {
    return false;
  }

  if (typeof body === "string") {
    return true;
  }

  return false;
};

export async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  if (shouldAttachJsonHeader(init.body, headers)) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });

  if (!response.ok) {
    throw await parseErrorPayload(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ApiError({
      status: response.status,
      message: "Received malformed JSON from the server.",
      code: "INVALID_JSON",
      details: { error },
    });
  }
}
