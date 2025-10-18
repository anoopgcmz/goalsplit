import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { dbConnect } from "@/lib/mongo";
import UserModel from "@/models/user";

import { VerifyOtpResponseSchema } from "../auth/schemas";
import {
  createAuthErrorResponse,
  handleAuthZodError,
  requireSessionUserId,
} from "../auth/utils";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userIdOrResponse = requireSessionUserId(request);
    if (userIdOrResponse instanceof NextResponse) {
      return userIdOrResponse;
    }

    const user = await UserModel.findById(userIdOrResponse);

    if (!user) {
      return createAuthErrorResponse(
        "AUTH_UNAUTHORIZED",
        "We could not find your account. Please sign in again.",
        401,
        {
          hint: "Request a fresh sign-in code to continue.",
          logLevel: "warn",
          context: { userId: userIdOrResponse.toString(), operation: "me" },
        },
      );
    }

    const payload = VerifyOtpResponseSchema.parse({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name ?? null,
      },
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
