import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";

import type { Contribution } from "@/models/contribution";
import type { ContributionDoc } from "@/models/contribution";

import {
  ContributionListQuerySchema,
  ContributionResponseSchema,
  type ContributionApiErrorCode,
  type ContributionListQuery,
  type ContributionResponse,
} from "./schemas";
import { ApiErrorResponseSchema, type BackoffHint, type Locale } from "../common/schemas";
import { logStructuredError } from "../common/logger";
import {
  SESSION_COOKIE_NAME,
  validateSessionToken,
} from "@/lib/auth/session";

interface ErrorOptions {
  hint?: string;
  backoff?: BackoffHint;
  locale?: Locale;
  logLevel?: "debug" | "info" | "warn" | "error" | "none";
  context?: Record<string, unknown>;
  error?: unknown;
}

export const objectIdToString = (value: Types.ObjectId | string) =>
  typeof value === "string" ? value : value.toString();

export const isNextResponse = (value: unknown): value is NextResponse =>
  value instanceof NextResponse;

interface LeanContribution {
  _id: Types.ObjectId | string;
  goalId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  amount: number;
  period: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const serializeContribution = (
  contribution: Contribution | ContributionDoc | LeanContribution,
): ContributionResponse => {
  const base: LeanContribution =
    "toObject" in contribution
      ? (contribution.toObject() as unknown as LeanContribution)
      : (contribution as unknown as LeanContribution);

  const createdAt = base.createdAt ?? new Date();
  const updatedAt = base.updatedAt ?? createdAt;

  const serialized: ContributionResponse = {
    id: objectIdToString(base._id),
    goalId: objectIdToString(base.goalId),
    userId: objectIdToString(base.userId),
    amount: base.amount,
    period: new Date(base.period).toISOString(),
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
  };

  return ContributionResponseSchema.parse(serialized);
};

export const parseContributionListQuery = (
  request: NextRequest,
): ContributionListQuery => {
  const params = request.nextUrl.searchParams;

  const raw = {
    goalId: params.get("goalId") ?? undefined,
    period: params.get("period") ?? undefined,
  };

  return ContributionListQuerySchema.parse(raw);
};

export const createErrorResponse = (
  code: ContributionApiErrorCode,
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
      domain: "contribution",
      code,
      status,
      locale: options.locale ?? "en",
      context: options.context ?? {},
      error: options.error,
    });
  }

  return NextResponse.json(payload, { status });
};

export const handleZodError = (error: unknown) => {
  if (error instanceof ZodError) {
    const message = error.errors.map((err) => err.message).join("; ");
    return createErrorResponse(
      "CONTRIBUTION_VALIDATION_ERROR",
      `Please update the highlighted fields: ${message}`,
      400,
      {
        hint: "Double-check the contribution details and try again.",
        logLevel: "warn",
        context: { issues: error.errors.length },
      },
    );
  }

  throw error;
};

export const requireUserId = (request: NextRequest): Types.ObjectId | NextResponse => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = validateSessionToken(token);

  if (!validation.success) {
    const reason = validation.reason;
    const isExpired = reason === "expired";
    return createErrorResponse(
      "CONTRIBUTION_UNAUTHORIZED",
      isExpired
        ? "Your session has expired. Please sign in again to keep contributing."
        : "We could not find your session. Please sign in to continue.",
      401,
      {
        hint: isExpired
          ? "Request a new sign-in code to continue."
          : "Sign in again so we can save your latest updates.",
        logLevel: reason === "invalid" ? "warn" : "info",
        context: { reason },
      },
    );
  }

  const identifier = validation.session.userId;

  if (!Types.ObjectId.isValid(identifier)) {
    return createErrorResponse(
      "CONTRIBUTION_UNAUTHORIZED",
      "Your session looks unusual. Please sign in once more to keep things secure.",
      401,
      {
        hint: "Sign out and back in to refresh your session.",
        logLevel: "warn",
        context: { reason: "invalid-object-id" },
      },
    );
  }

  return new Types.ObjectId(identifier);
};
