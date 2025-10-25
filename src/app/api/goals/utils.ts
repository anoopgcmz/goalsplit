import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";

import type {
  Goal,
  GoalDoc,
  GoalMember,
  GoalCompounding,
  ContributionFrequency,
  CurrencyCode,
} from "@/models/goal";

import {
  GoalListQuerySchema,
  GoalResponseSchema,
  type GoalApiErrorCode,
  type GoalResponse,
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

interface LeanGoal {
  _id: Types.ObjectId | string;
  ownerId: Types.ObjectId | string;
  title: string;
  targetAmount: number;
  currency: CurrencyCode;
  targetDate: Date;
  expectedRate: number;
  compounding: GoalCompounding;
  contributionFrequency: ContributionFrequency;
  existingSavings?: number;
  isShared: boolean;
  members: GoalMember[];
  createdAt?: Date;
  updatedAt?: Date;
}

export const serializeGoal = (goal: Goal | GoalDoc | LeanGoal): GoalResponse => {
  const base: LeanGoal =
    "toObject" in goal
      ? (goal.toObject() as unknown as LeanGoal)
      : (goal as unknown as LeanGoal);

  const normalizedMembers = base.members.map((member) => ({
    userId: objectIdToString(member.userId),
    role: member.role,
    splitPercent: member.splitPercent,
    fixedAmount: member.fixedAmount,
  }));

  const percentMembers = normalizedMembers.filter(
    (member) => member.splitPercent != null,
  );
  const fixedMembers = normalizedMembers.filter((member) => member.fixedAmount != null);

  const warnings: string[] = [];

  if (percentMembers.length > 0) {
    const totalPercent = percentMembers.reduce((sum, member) => {
      return sum + (member.splitPercent ?? 0);
    }, 0);

    if (Math.abs(totalPercent - 100) > 0.1) {
      warnings.push(
        `Percent-based shares currently add up to ${totalPercent.toFixed(
          1,
        )}%. Adjust them so they total 100%.`,
      );
    }
  }

  if (percentMembers.length > 0 && fixedMembers.length > 0) {
    warnings.push(
      "This goal mixes fixed and percent-based splits. Confirm everyone understands how contributions are calculated.",
    );
  }

  const createdAt = base.createdAt ?? new Date();
  const updatedAt = base.updatedAt ?? createdAt;

  const serialized: GoalResponse = {
    id: objectIdToString(base._id),
    ownerId: objectIdToString(base.ownerId),
    title: base.title,
    targetAmount: base.targetAmount,
    currency: base.currency,
    targetDate: new Date(base.targetDate).toISOString(),
    expectedRate: base.expectedRate,
    compounding: base.compounding,
    contributionFrequency: base.contributionFrequency,
    existingSavings: base.existingSavings,
    isShared:
      typeof base.isShared === "boolean" ? base.isShared : normalizedMembers.length > 1,
    members: normalizedMembers,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  return GoalResponseSchema.parse(serialized);
};

export const parseGoalListQuery = (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const raw = {
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? params.get("limit") ?? undefined,
    sortBy: params.get("sortBy") ?? undefined,
    sortOrder: params.get("sortOrder") ?? params.get("order") ?? undefined,
  };

  return GoalListQuerySchema.parse(raw);
};

export const createErrorResponse = (
  code: GoalApiErrorCode,
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
      domain: "goal",
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
      "GOAL_VALIDATION_ERROR",
      `Please update the highlighted fields: ${message}`,
      400,
      {
        hint: "Review the goal details and try again.",
        logLevel: "warn",
        context: { issues: error.errors.length },
      },
    );
  }

  throw error;
};

export const parseObjectId = (value: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new ZodError([
      {
        code: "custom",
        message: "We could not match that item. Please refresh and try the link again.",
        path: [],
      },
    ]);
  }

  return new Types.ObjectId(value);
};

export const requireUserId = (request: NextRequest): Types.ObjectId | NextResponse => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = validateSessionToken(token);

  if (!validation.success) {
    const reason = validation.reason;
    const isExpired = reason === "expired";
    return createErrorResponse(
      "GOAL_UNAUTHORIZED",
      isExpired
        ? "Your session has expired. Please sign in again to keep your goals in sync."
        : "We could not find your session. Please sign in to continue.",
      401,
      {
        hint: isExpired
          ? "Request a new sign-in code to continue."
          : "Sign in again to keep your plans in sync.",
        logLevel: reason === "invalid" ? "warn" : "info",
        context: { reason },
      },
    );
  }

  const identifier = validation.session.userId;

  if (!Types.ObjectId.isValid(identifier)) {
    return createErrorResponse(
      "GOAL_UNAUTHORIZED",
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
