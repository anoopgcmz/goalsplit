import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { dbConnect } from "@/lib/mongo";
import OtpCodeModel from "@/models/otp-code";
import OtpRequestCounterModel from "@/models/otp-request-counter";
import { DEMO_OTP_CODE, DEMO_OTP_EXPIRY_MS, isDemoEmail } from "@/lib/auth/demo";

import { RequestOtpInputSchema } from "../schemas";
import {
  createAuthErrorResponse,
  handleAuthZodError,
  hashIdentifier,
  normaliseEmail,
} from "../utils";

const OTP_EXPIRY_SECONDS = 10 * 60;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const createOtpCode = async (email: string) => {
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

  await OtpCodeModel.updateMany({ email, consumed: false }, { consumed: true });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateOtpCode();

    try {
      return await OtpCodeModel.create({
        email,
        code,
        expiresAt,
        consumed: false,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "number" &&
        (error as { code: number }).code === 11000
      ) {
        // retry on duplicate key violation
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to generate OTP");
};

const updateRateLimit = async (email: string) => {
  const now = Date.now();
  const rateLimit = await OtpRequestCounterModel.findOne({ email });

  if (!rateLimit || rateLimit.windowStartedAt.getTime() + RATE_LIMIT_WINDOW_MS <= now) {
    await OtpRequestCounterModel.updateOne(
      { email },
      {
        $set: {
          email,
          windowStartedAt: new Date(now),
          requestCount: 1,
        },
      },
      { upsert: true },
    );

    return null;
  }

  if (rateLimit.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (rateLimit.windowStartedAt.getTime() + RATE_LIMIT_WINDOW_MS - now) / 1000,
      ),
    );

    return retryAfterSeconds;
  }

  await OtpRequestCounterModel.updateOne({ email }, { $inc: { requestCount: 1 } });

  return null;
};

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body: unknown = await request.json();
    const parsedBody = RequestOtpInputSchema.parse(body);
    const email = normaliseEmail(parsedBody.email);

    const retryAfterSeconds = await updateRateLimit(email);

    if (retryAfterSeconds) {
      return createAuthErrorResponse(
        "AUTH_RATE_LIMITED",
        "We have sent the maximum number of codes to this email in the last hour.",
        429,
        {
          hint: "Please wait a little while before requesting another code.",
          backoff: {
            strategy: "retry-after",
            reason: "RATE_LIMIT",
            retryAfterSeconds,
          },
          context: { emailHash: hashIdentifier(email) },
        },
      );
    }

    const isDemoEnvironment = process.env.NODE_ENV !== "production";

    if (isDemoEnvironment && isDemoEmail(email)) {
      await OtpCodeModel.updateMany(
        { email, code: { $ne: DEMO_OTP_CODE }, consumed: false },
        { consumed: true },
      );

      await OtpCodeModel.findOneAndUpdate(
        { email },
        {
          $set: {
            email,
            code: DEMO_OTP_CODE,
            expiresAt: new Date(Date.now() + DEMO_OTP_EXPIRY_MS),
            consumed: false,
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );

      return new NextResponse(null, { status: 204 });
    }

    await createOtpCode(email);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createAuthErrorResponse(
        "AUTH_VALIDATION_ERROR",
        "We could not read that request. Please check the data and try again.",
        400,
        {
          hint: "Ensure you are sending valid JSON.",
          logLevel: "warn",
        },
      );
    }

    if (error instanceof ZodError) {
      return handleAuthZodError(error);
    }

    return createAuthErrorResponse(
      "AUTH_INTERNAL_ERROR",
      "We could not send a sign-in code right now.",
      500,
      {
        hint: "Please try again shortly.",
        error,
        context: { operation: "request-otp" },
      },
    );
  }
}
