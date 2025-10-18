import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ZodError } from 'zod';

import type { Goal } from '@/models/goal';
import type { GoalDoc } from '@/models/goal';
import type { GoalMember } from '@/models/goal';

import {
  GoalApiErrorCode,
  GoalListQuerySchema,
  GoalResponseSchema,
  type GoalResponse,
} from './schemas';

export const objectIdToString = (value: Types.ObjectId | string) =>
  typeof value === 'string' ? value : value.toString();

export const isNextResponse = (value: unknown): value is NextResponse =>
  value instanceof NextResponse;

type LeanGoal = Goal & {
  _id: Types.ObjectId | string;
  ownerId: Types.ObjectId | string;
  members: GoalMember[];
  createdAt?: Date;
  updatedAt?: Date;
};

export const serializeGoal = (goal: Goal | GoalDoc | LeanGoal): GoalResponse => {
  const base = 'toObject' in goal ? goal.toObject() : goal;

  const normalizedMembers = base.members.map((member) => ({
    userId: objectIdToString(member.userId as Types.ObjectId | string),
    role: member.role,
    splitPercent: member.splitPercent,
    fixedAmount: member.fixedAmount,
  }));

  const createdAt = (base as Goal & { createdAt?: Date }).createdAt ?? new Date();
  const updatedAt = (base as Goal & { updatedAt?: Date }).updatedAt ?? createdAt;

  const serialized: GoalResponse = {
    id: objectIdToString(base._id as Types.ObjectId | string),
    ownerId: objectIdToString(base.ownerId as Types.ObjectId | string),
    title: base.title,
    targetAmount: base.targetAmount,
    currency: base.currency,
    targetDate: new Date(base.targetDate).toISOString(),
    expectedRate: base.expectedRate,
    compounding: base.compounding,
    contributionFrequency: base.contributionFrequency,
    existingSavings: base.existingSavings,
    isShared: typeof base.isShared === 'boolean'
      ? base.isShared
      : normalizedMembers.length > 1,
    members: normalizedMembers,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
  };

  return GoalResponseSchema.parse(serialized);
};

export const parseGoalListQuery = (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const raw = {
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? params.get('limit') ?? undefined,
    sortBy: params.get('sortBy') ?? undefined,
    sortOrder: params.get('sortOrder') ?? params.get('order') ?? undefined,
  };

  return GoalListQuerySchema.parse(raw);
};

export const createErrorResponse = (
  code: GoalApiErrorCode,
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
    return createErrorResponse('GOAL_VALIDATION_ERROR', message, 400);
  }

  throw error;
};

export const parseObjectId = (value: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new ZodError([
      {
        code: 'custom',
        message: 'Invalid identifier supplied',
        path: [],
      },
    ]);
  }

  return new Types.ObjectId(value);
};

export const requireUserId = (
  request: NextRequest
): Types.ObjectId | NextResponse => {
  const headerValue = request.headers.get('x-user-id');
  const cookieValue = request.cookies.get('session')?.value;
  const identifier = headerValue ?? cookieValue;

  if (!identifier) {
    return createErrorResponse(
      'GOAL_UNAUTHORIZED',
      'Missing authentication context',
      401
    );
  }

  if (!Types.ObjectId.isValid(identifier)) {
    return createErrorResponse(
      'GOAL_UNAUTHORIZED',
      'Invalid authentication context',
      401
    );
  }

  return new Types.ObjectId(identifier);
};
