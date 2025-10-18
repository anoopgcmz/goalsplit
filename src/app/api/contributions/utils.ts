import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ZodError } from 'zod';

import type { Contribution } from '@/models/contribution';
import type { ContributionDoc } from '@/models/contribution';

import {
  ContributionApiErrorCode,
  ContributionListQuerySchema,
  ContributionResponseSchema,
  type ContributionListQuery,
  type ContributionResponse,
} from './schemas';

export const objectIdToString = (value: Types.ObjectId | string) =>
  typeof value === 'string' ? value : value.toString();

export const isNextResponse = (value: unknown): value is NextResponse =>
  value instanceof NextResponse;

type LeanContribution = Contribution & {
  _id: Types.ObjectId | string;
  goalId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  createdAt?: Date;
  updatedAt?: Date;
};

export const serializeContribution = (
  contribution: Contribution | ContributionDoc | LeanContribution
): ContributionResponse => {
  const base =
    'toObject' in contribution
      ? (contribution.toObject() as LeanContribution)
      : (contribution as LeanContribution);

  const createdAt =
    (base as Contribution & { createdAt?: Date }).createdAt ?? new Date();
  const updatedAt =
    (base as Contribution & { updatedAt?: Date }).updatedAt ?? createdAt;

  const serialized: ContributionResponse = {
    id: objectIdToString(base._id as Types.ObjectId | string),
    goalId: objectIdToString(base.goalId as Types.ObjectId | string),
    userId: objectIdToString(base.userId as Types.ObjectId | string),
    amount: base.amount,
    period: new Date(base.period).toISOString(),
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
  };

  return ContributionResponseSchema.parse(serialized);
};

export const parseContributionListQuery = (
  request: NextRequest
): ContributionListQuery => {
  const params = request.nextUrl.searchParams;

  const raw = {
    goalId: params.get('goalId') ?? undefined,
    period: params.get('period') ?? undefined,
  };

  return ContributionListQuerySchema.parse(raw);
};

export const createErrorResponse = (
  code: ContributionApiErrorCode,
  message: string,
  status: number
) =>
  NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );

export const handleZodError = (error: unknown) => {
  if (error instanceof ZodError) {
    const message = error.errors.map((err) => err.message).join('; ');
    return createErrorResponse('CONTRIBUTION_VALIDATION_ERROR', message, 400);
  }

  throw error;
};

export const requireUserId = (
  request: NextRequest
): Types.ObjectId | NextResponse => {
  const headerValue = request.headers.get('x-user-id');
  const cookieValue = request.cookies.get('session')?.value;
  const identifier = headerValue ?? cookieValue;

  if (!identifier) {
    return createErrorResponse(
      'CONTRIBUTION_UNAUTHORIZED',
      'Missing authentication context',
      401
    );
  }

  if (!Types.ObjectId.isValid(identifier)) {
    return createErrorResponse(
      'CONTRIBUTION_UNAUTHORIZED',
      'Invalid authentication context',
      401
    );
  }

  return new Types.ObjectId(identifier);
};
