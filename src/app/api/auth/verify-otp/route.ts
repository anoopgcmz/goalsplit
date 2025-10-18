import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { dbConnect } from '@/lib/mongo';
import OtpCodeModel from '@/models/otp-code';
import UserModel from '@/models/user';

import {
  VerifyOtpInputSchema,
  VerifyOtpResponseSchema,
} from '../schemas';
import {
  createAuthErrorResponse,
  handleAuthZodError,
  hashIdentifier,
  normaliseEmail,
} from '../utils';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const parsedBody = VerifyOtpInputSchema.parse(body);
    const email = normaliseEmail(parsedBody.email);
    const code = parsedBody.code.trim();

    const otpCode = await OtpCodeModel.findOne({ email, code });

    if (!otpCode) {
      return createAuthErrorResponse(
        'AUTH_INVALID_CODE',
        'That code isn’t quite right. Please check your email and try again.',
        400,
        {
          hint: 'If you no longer have the code, request a new one.',
+          logLevel: 'warn',
+          context: { emailHash: hashIdentifier(email) },
        }
      );
    }

    if (otpCode.expiresAt.getTime() <= Date.now() || otpCode.consumed) {
      return createAuthErrorResponse(
        'AUTH_EXPIRED_CODE',
        'This code has expired. Request a new one to keep going.',
        401,
        {
          hint: 'Tap “Send a new code” to receive another email.',
+          logLevel: 'warn',
+          context: { emailHash: hashIdentifier(email) },
        }
      );
    }

    otpCode.consumed = true;
    await otpCode.save();

    const user = await UserModel.findOneAndUpdate(
      { email },
      { $setOnInsert: { email } },
      { new: true, upsert: true }
    );

    const payload = VerifyOtpResponseSchema.parse({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name ?? null,
      },
    });

    const response = NextResponse.json(payload, { status: 200 });

    response.cookies.set('session', user._id.toString(), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createAuthErrorResponse(
        'AUTH_VALIDATION_ERROR',
        'We could not read that request. Please check the data and try again.',
        400,
        {
          hint: 'Ensure you are sending valid JSON.',
          logLevel: 'warn',
        }
      );
    }

    if (error instanceof ZodError) {
      return handleAuthZodError(error);
    }

    return createAuthErrorResponse(
      'AUTH_INTERNAL_ERROR',
      'We could not verify that code right now.',
      500,
      {
        hint: 'Please try again shortly.',
        error,
        context: { operation: 'verify-otp' },
      }
    );
  }
}
