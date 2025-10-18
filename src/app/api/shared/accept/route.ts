import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ZodError, z } from 'zod';

import { dbConnect } from '@/lib/mongo';
import GoalModel from '@/models/goal';
import InviteModel from '@/models/invite';
import UserModel from '@/models/user';

import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  objectIdToString,
  requireUserId,
  serializeGoal,
} from '../../goals/utils';

const AcceptInviteSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required'),
});

const normaliseEmail = (email: string) => email.trim().toLowerCase();

const rebalancePercentages = (goal: Awaited<ReturnType<typeof GoalModel.findById>>) => {
  if (!goal) {
    return;
  }

  const percentMembers = goal.members.filter((member) => member.fixedAmount == null);
  const ownerMember = percentMembers.find((member) => member.role === 'owner');

  if (!ownerMember) {
    return;
  }

  const collaboratorMembers = percentMembers.filter((member) => member.role !== 'owner');

  if (collaboratorMembers.length === 0) {
    ownerMember.splitPercent = 100;
    return;
  }

  const collaboratorTotal = collaboratorMembers.reduce((sum, member) => {
    return sum + (member.splitPercent ?? 0);
  }, 0);

  if (collaboratorTotal > 100) {
    const scale = 100 / collaboratorTotal;
    collaboratorMembers.forEach((member) => {
      member.splitPercent = (member.splitPercent ?? 0) * scale;
    });
  }

  const adjustedTotal = collaboratorMembers.reduce((sum, member) => {
    return sum + (member.splitPercent ?? 0);
  }, 0);

  ownerMember.splitPercent = Math.max(0, 100 - adjustedTotal);
};

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;

    const body = await request.json();
    const parsedBody = AcceptInviteSchema.parse(body);

    const invite = await InviteModel.findOne({ token: parsedBody.token });

    if (!invite) {
      return createErrorResponse('GOAL_NOT_FOUND', 'Invitation not found', 404);
    }

    if (invite.acceptedAt) {
      return createErrorResponse(
        'GOAL_CONFLICT',
        'Invitation has already been accepted',
        409
      );
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      return createErrorResponse(
        'GOAL_CONFLICT',
        'Invitation has expired',
        409
      );
    }

    const [goal, user] = await Promise.all([
      GoalModel.findById(invite.goalId),
      UserModel.findById(userId),
    ]);

    if (!goal) {
      return createErrorResponse('GOAL_NOT_FOUND', 'Goal not found', 404);
    }

    if (!user) {
      return createErrorResponse(
        'GOAL_UNAUTHORIZED',
        'User context is invalid',
        401
      );
    }

    if (normaliseEmail(user.email) !== normaliseEmail(invite.email)) {
      return createErrorResponse(
        'GOAL_FORBIDDEN',
        'This invitation is not assigned to your email address',
        403
      );
    }

    const normalizedUserId = objectIdToString(userId);
    const isAlreadyMember = goal.members.some((member) => {
      return (
        objectIdToString(member.userId as Types.ObjectId | string) === normalizedUserId
      );
    });

    if (isAlreadyMember) {
      return createErrorResponse(
        'GOAL_CONFLICT',
        'You are already a member of this goal',
        409
      );
    }

    goal.members.push({
      userId,
      role: 'collaborator',
      splitPercent:
        invite.fixedAmount == null ? invite.defaultSplitPercent ?? 0 : undefined,
      fixedAmount: invite.fixedAmount ?? undefined,
    });
    goal.isShared = true;

    rebalancePercentages(goal);

    invite.acceptedAt = new Date();

    const [updatedGoal] = await Promise.all([goal.save(), invite.save()]);

    const serialized = serializeGoal(updatedGoal);

    return NextResponse.json({ goal: serialized });
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
      'Unable to accept invitation',
      500
    );
  }
}

