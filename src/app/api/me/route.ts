import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getUserFromCookie } from "@/lib/auth/server";

import { VerifyOtpResponseSchema } from "../auth/schemas";
import {
  createAuthErrorResponse,
  handleAuthZodError,
} from "../auth/utils";

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getUserFromCookie();

    if (!user) {
      return createAuthErrorResponse(
        "AUTH_UNAUTHORIZED",
        "We could not find your account. Please sign in again.",
        401,
        {
          hint: "Request a fresh sign-in code to continue.",
          logLevel: "warn",
          context: { operation: "me", reason: "user-not-found" },
        },
      );
    }

    const payload = VerifyOtpResponseSchema.parse({
      user,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return handleAuthZodError(error);
    }

    return createAuthErrorResponse(
      "AUTH_INTERNAL_ERROR",
      "We could not load your account details right now.",
      500,
      {
        hint: "Please refresh in a moment.",
        error,
        context: { operation: "me" },
      },
    );
  }
}
