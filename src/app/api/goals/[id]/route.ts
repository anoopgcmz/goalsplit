import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ZodError } from 'zod';

import { dbConnect } from '@/lib/mongo';
import ContributionModel from '@/models/contribution';
import GoalModel from '@/models/goal';
import InviteModel from '@/models/invite';

import { UpdateGoalInputSchema } from '../schemas';
import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  objectIdToString,
  parseObjectId,
  requireUserId,
  serializeGoal,
} from '../utils';

const isGoalMember = (goal: Awaited<ReturnType<typeof GoalModel.findById>>, userId: Types.ObjectId) => {
  if (!goal) {
    return false;
  }

  const normalizedUserId = objectIdToString(userId);
  const ownerIdMatches = objectIdToString(goal.ownerId as Types.ObjectId | string) === normalizedUserId;

  if (ownerIdMatches) {
    return true;
  }

  return goal.members.some(
    (member) => objectIdToString(member.userId as Types.ObjectId | string) === normalizedUserId
  );
};

const isGoalOwner = (goal: Awaited<ReturnType<typeof GoalModel.findById>>, userId: Types.ObjectId) => {
  if (!goal) {
    return false;
  }

  return (
    objectIdToString(goal.ownerId as Types.ObjectId | string) ===
    objectIdToString(userId)
  );
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;

    const goalId = parseObjectId(params.id);
    const goal = await GoalModel.findById(goalId);

    if (!goal) {
      return createErrorResponse('GOAL_NOT_FOUND', 'Goal not found', 404);
    }

    if (!isGoalMember(goal, userId)) {
      return createErrorResponse('GOAL_FORBIDDEN', 'You do not have access to this goal', 403);
    }

    return NextResponse.json(serializeGoal(goal));
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      'GOAL_INTERNAL_ERROR',
      'Unable to retrieve goal details',
      500
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;

    const goalId = parseObjectId(params.id);
    const goal = await GoalModel.findById(goalId);

    if (!goal) {
      return createErrorResponse('GOAL_NOT_FOUND', 'Goal not found', 404);
    }

    if (!isGoalOwner(goal, userId)) {
      return createErrorResponse('GOAL_FORBIDDEN', 'Only the owner may update this goal', 403);
    }

    const body = await request.json();
    const parsedBody = UpdateGoalInputSchema.parse(body);

    goal.set({
      ...parsedBody,
      targetDate: parsedBody.targetDate ?? goal.targetDate,
    });

    const updatedGoal = await goal.save();

    return NextResponse.json(serializeGoal(updatedGoal));
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
      'Unable to update goal',
      500
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;

    const goalId = parseObjectId(params.id);
    const goal = await GoalModel.findById(goalId);

    if (!goal) {
      return createErrorResponse('GOAL_NOT_FOUND', 'Goal not found', 404);
    }

    if (!isGoalOwner(goal, userId)) {
      return createErrorResponse('GOAL_FORBIDDEN', 'Only the owner may delete this goal', 403);
    }

    await Promise.all([
      InviteModel.deleteMany({ goalId }),
      ContributionModel.deleteMany({ goalId }),
    ]);

    await goal.deleteOne();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      'GOAL_INTERNAL_ERROR',
      'Unable to delete goal',
      500
    );
  }
}
