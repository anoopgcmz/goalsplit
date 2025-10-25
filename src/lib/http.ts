import { ZodError, type ZodSchema } from "zod";

export interface ApiErrorShape {
  status: number;
  message: string;
  details?: unknown;
}

export class ApiError extends Error implements ApiErrorShape {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export type ApiFetchInit<T> = RequestInit & { schema?: ZodSchema<T> };

const NETWORK_ERROR_MESSAGE =
  "We couldn't reach the server. Check your connection and try again.";

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const BASE_URL_ENV_VARS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_BASE_URL",
  "APP_URL",
  "SITE_URL",
  "NEXTAUTH_URL",
  "VERCEL_URL",
];

function resolveBaseUrl(): string {
  for (const envVar of BASE_URL_ENV_VARS) {
    const value = process.env[envVar];

    if (!value) {
      continue;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      continue;
    }

    if (ABSOLUTE_URL_PATTERN.test(trimmedValue)) {
      return trimmedValue;
    }

    return `https://${trimmedValue}`;
  }

  return "http://localhost:3000";
}

function resolveFetchUrl(path: string): string {
  if (ABSOLUTE_URL_PATTERN.test(path) || typeof window !== "undefined") {
    return path;
  }

  return new URL(path, resolveBaseUrl()).toString();
}

const ERROR_MESSAGE_BY_STATUS: Record<number, string> = {
  401: "You must be signed in to continue.",
  403: "You do not have permission to perform this action.",
  404: "We couldn't find what you were looking for.",
  422: "The server returned data in an unexpected format.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again later.",
};

function resolveErrorMessage(status: number, fallback?: string): string {
  if (ERROR_MESSAGE_BY_STATUS[status]) {
    return ERROR_MESSAGE_BY_STATUS[status];
  }

  if (status >= 500) {
    return ERROR_MESSAGE_BY_STATUS[500];
  }

  if (fallback?.trim()) {
    return fallback;
  }

  return "We couldn't complete your request.";
}

function createApiError(status: number, fallbackMessage?: string, details?: unknown) {
  const message = resolveErrorMessage(status, fallbackMessage);
  return new ApiError(status, message, details);
}

function shouldSerializeBody(body: unknown): body is Record<string, unknown> | unknown[] {
  if (body == null) {
    return false;
  }

  if (typeof body === "string") {
    return false;
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return false;
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return false;
  }

  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return false;
  }

  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return false;
  }

  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) {
    return false;
  }

  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(body)) {
    return false;
  }

  return typeof body === "object" || typeof body === "number" || typeof body === "boolean";
}

function isBodyInitLike(value: unknown): value is BodyInit | null | undefined {
  if (value == null) {
    return true;
  }

  if (typeof value === "string") {
    return true;
  }

  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return true;
  }

  if (typeof FormData !== "undefined" && value instanceof FormData) {
    return true;
  }

  if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) {
    return true;
  }

  if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) {
    return true;
  }

  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
    return true;
  }

  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
    return true;
  }

  return false;
}

function parseJson(text: string): unknown {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(data: unknown): string | undefined {
  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object" && data !== null && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return undefined;
}

function extractDetails(data: unknown): unknown {
  if (typeof data === "object" && data !== null && "details" in data) {
    return (data as { details?: unknown }).details;
  }

  return data;
}

export async function apiFetch<T>(path: string, init: ApiFetchInit<T> = {}): Promise<T> {
  const { schema, headers, body, cache: cacheMode, ...rest } = init;

  const finalHeaders = new Headers(headers ?? {});
  let finalBody: BodyInit | null | undefined;

  if (shouldSerializeBody(body)) {
    finalBody = JSON.stringify(body);
    if (!finalHeaders.has("Content-Type")) {
      finalHeaders.set("Content-Type", "application/json");
    }
  } else if (isBodyInitLike(body)) {
    finalBody = body;
  } else {
    finalBody = undefined;
  }

  const requestInit: RequestInit = {
    ...rest,
    headers: finalHeaders,
    body: finalBody,
    credentials: "include",
    cache: cacheMode ?? "no-store",
  };

  let response: Response;

  const url = resolveFetchUrl(path);

  try {
    response = await fetch(url, requestInit);
  } catch (error) {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE, error);
  }

  const rawText = await response.text();
  const data = parseJson(rawText);

  if (!response.ok) {
    const messageFromBody = extractMessage(data);
    const details = extractDetails(data);
    throw createApiError(response.status, messageFromBody, details);
  }

  if (schema) {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ApiError(422, ERROR_MESSAGE_BY_STATUS[422], error.issues);
      }
      throw error;
    }
  }

  return data as T;
}

export function get<T>(path: string, schema?: ZodSchema<T>) {
  return apiFetch<T>(path, { method: "GET", schema });
}

export function post<T>(path: string, body: unknown, schema?: ZodSchema<T>) {
  return apiFetch<T>(path, { method: "POST", body, schema });
}

export function patch<T>(path: string, body: unknown, schema?: ZodSchema<T>) {
  return apiFetch<T>(path, { method: "PATCH", body, schema });
}

export function del<T>(path: string, schema?: ZodSchema<T>) {
  return apiFetch<T>(path, { method: "DELETE", schema });
}
