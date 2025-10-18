import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { dbConnect } from '@/lib/mongo';
import GoalModel from '@/models/goal';

import { CreateGoalInputSchema } from './schemas';
import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  parseGoalListQuery,
  requireUserId,
  serializeGoal,
} from './utils';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }

    const userId = userIdOrResponse;
    const query = parseGoalListQuery(request);

    const filter = {
      $or: [{ ownerId: userId }, { 'members.userId': userId }],
    };

    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [goals, totalItems] = await Promise.all([
      GoalModel.find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean(),
      GoalModel.countDocuments(filter),
    ]);

    const data = goals.map((goal) => serializeGoal(goal));

    return NextResponse.json({
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
      sort: {
        by: query.sortBy,
        order: query.sortOrder,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      'GOAL_INTERNAL_ERROR',
      'Unable to fetch goals',
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
    const parsedBody = CreateGoalInputSchema.parse(body);

    const goal = await GoalModel.create({
      ownerId: userId,
      title: parsedBody.title,
      targetAmount: parsedBody.targetAmount,
      currency: parsedBody.currency,
      targetDate: parsedBody.targetDate,
      expectedRate: parsedBody.expectedRate,
      compounding: parsedBody.compounding,
      contributionFrequency: parsedBody.contributionFrequency,
      existingSavings: parsedBody.existingSavings,
      isShared: false,
      members: [
        {
          userId,
          role: 'owner',
          splitPercent: 100,
        },
      ],
    });

    return NextResponse.json(serializeGoal(goal), { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        'GOAL_VALIDATION_ERROR',
        'Invalid JSON payload',
        400
      );
    }

    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      'GOAL_INTERNAL_ERROR',
      'Unable to create goal',
      500
    );
  }
}
