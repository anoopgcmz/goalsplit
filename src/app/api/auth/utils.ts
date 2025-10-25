import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";
import { createHash } from "crypto";

import { ApiErrorResponseSchema, type BackoffHint, type Locale } from "../common/schemas";
import { logStructuredError } from "../common/logger";
import type { AuthApiErrorCode } from "./schemas";
import {
  SESSION_COOKIE_NAME,
  validateSessionToken,
} from "@/lib/auth/session";

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export const hashIdentifier = (identifier: string) =>
  createHash("sha256").update(identifier).digest("hex");

interface ErrorOptions {
  hint?: string;
  backoff?: BackoffHint;
  locale?: Locale;
  logLevel?: "debug" | "info" | "warn" | "error" | "none";
  context?: Record<string, unknown>;
  error?: unknown;
}

export const createAuthErrorResponse = (
  code: AuthApiErrorCode,
  message: string,
  status: number,
  options: ErrorOptions = {},
) => {
  const payload = ApiErrorResponseSchema.parse({
    error: {
      code,
      message,
      locale: options.locale ?? "en",
      hint: options.hint,
      backoff: options.backoff,
    },
  });

  if (options.logLevel !== "none") {
    logStructuredError({
      level: options.logLevel ?? (status >= 500 ? "error" : "warn"),
      domain: "auth",
      code,
      status,
      locale: options.locale ?? "en",
      context: options.context ?? {},
      error: options.error,
    });
  }

  return NextResponse.json(payload, { status });
};

export const handleAuthZodError = (error: unknown) => {
  if (error instanceof ZodError) {
    const message = error.errors.map((issue) => issue.message).join("; ");
    return createAuthErrorResponse(
      "AUTH_VALIDATION_ERROR",
      `Please update the highlighted fields: ${message}`,
      400,
      {
        hint: "Check the details and try again.",
        logLevel: "warn",
        context: { issues: error.errors.length },
      },
    );
  }

  throw error;
};

export const requireSessionUserId = (
  request: NextRequest,
): Types.ObjectId | NextResponse => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const result = validateSessionToken(token);

  if (!result.success) {
    const baseOptions = {
      hint: "Request a new sign-in code to continue.",
      logLevel: result.reason === "invalid" ? "warn" : "info",
      context: { reason: result.reason },
    } as const;

    if (result.reason === "expired") {
      return createAuthErrorResponse(
        "AUTH_UNAUTHORIZED",
        "Your session has expired. Please sign in again to keep going.",
        401,
        {
          ...baseOptions,
          hint: "Request a fresh sign-in code to continue.",
          logLevel: "info",
        },
      );
    }

    return createAuthErrorResponse(
      "AUTH_UNAUTHORIZED",
      "We could not find your session. Please sign in to continue.",
      401,
      baseOptions,
    );
  }

  const { userId } = result.session;

  if (!Types.ObjectId.isValid(userId)) {
    return createAuthErrorResponse(
      "AUTH_UNAUTHORIZED",
      "Your session looks unusual. Please sign in again to keep things secure.",
      401,
      {
        hint: "Sign in again to refresh your session.",
        logLevel: "warn",
        context: { reason: "invalid-object-id" },
      },
    );
  }

  return new Types.ObjectId(result.session.userId);
};
