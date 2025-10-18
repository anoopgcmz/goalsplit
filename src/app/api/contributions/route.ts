import { NextRequest, NextResponse } from 'next/server';
import { Types, type FilterQuery } from 'mongoose';
import { ZodError } from 'zod';

import { dbConnect } from '@/lib/mongo';
import ContributionModel from '@/models/contribution';
import type { Contribution } from '@/models/contribution';

import {
  UpsertContributionInputSchema,
  normalizePeriod,
} from './schemas';
import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  parseContributionListQuery,
  requireUserId,
  serializeContribution,
} from './utils';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }

    const userId = userIdOrResponse;
    const query = parseContributionListQuery(request);

    const filter: FilterQuery<Contribution> = {
      userId,
    };

    if (query.goalId) {
      filter.goalId = new Types.ObjectId(query.goalId);
    }

    if (query.period) {
      filter.period = query.period;
    }

    const contributions = await ContributionModel.find(filter)
      .sort({ period: -1 })
      .lean();

    const data = contributions.map((contribution) =>
      serializeContribution(contribution)
    );

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      'CONTRIBUTION_INTERNAL_ERROR',
      'Unable to fetch contributions',
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;

    const body = await request.json();
    const parsedBody = UpsertContributionInputSchema.parse(body);

    const goalId = new Types.ObjectId(parsedBody.goalId);
    const period = normalizePeriod(parsedBody.period);

    const contribution = await ContributionModel.findOneAndUpdate(
      { userId, goalId, period },
      {
        $set: {
          amount: parsedBody.amount,
          period,
        },
        $setOnInsert: {
          userId,
          goalId,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    if (!contribution) {
      return createErrorResponse(
        'CONTRIBUTION_INTERNAL_ERROR',
        'Unable to save contribution',
        500
      );
    }

    return NextResponse.json(serializeContribution(contribution));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        'CONTRIBUTION_VALIDATION_ERROR',
        'Invalid JSON payload',
        400
      );
    }

    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      'CONTRIBUTION_INTERNAL_ERROR',
      'Unable to save contribution',
      500
    );
  }
}
