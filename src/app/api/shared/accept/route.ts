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
import { GoalResponseSchema } from '../../goals/schemas';

const AcceptInviteSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required'),
});

const AcceptInviteResponseSchema = z.object({
  goal: GoalResponseSchema,
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
      return createErrorResponse(
        'GOAL_NOT_FOUND',
        'We could not find that invitation.',
        404,
        {
          hint: 'It may have already been used or revoked.',
          logLevel: 'info',
          context: { token: parsedBody.token, operation: 'accept-invite' },
        }
      );
    }

    if (invite.acceptedAt) {
      return createErrorResponse(
        'GOAL_CONFLICT',
        'This invitation was already accepted.',
        409,
        {
          hint: 'Ask the goal owner to send a new invitation if needed.',
          logLevel: 'info',
          context: { inviteId: invite._id.toString(), operation: 'accept-invite' },
        }
      );
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      return createErrorResponse(
        'GOAL_CONFLICT',
        'This invitation has expired.',
        409,
        {
          hint: 'Ask the goal owner to send a fresh invitation.',
          logLevel: 'info',
          context: { inviteId: invite._id.toString(), operation: 'accept-invite' },
        }
      );
    }

    const [goal, user] = await Promise.all([
      GoalModel.findById(invite.goalId),
      UserModel.findById(userId),
    ]);

    if (!goal) {
      return createErrorResponse(
        'GOAL_NOT_FOUND',
        'We could not find that goal.',
        404,
        {
          hint: 'It may have been removed.',
          logLevel: 'info',
          context: { inviteId: invite._id.toString(), goalId: invite.goalId.toString(), operation: 'accept-invite' },
        }
      );
    }

    if (!user) {
      return createErrorResponse(
        'GOAL_UNAUTHORIZED',
        'We could not verify your account for this invitation.',
        401,
        {
          hint: 'Please sign in again and retry the link.',
          logLevel: 'warn',
          context: { userId: userId.toString(), operation: 'accept-invite' },
        }
      );
    }

    if (normaliseEmail(user.email) !== normaliseEmail(invite.email)) {
      return createErrorResponse(
        'GOAL_FORBIDDEN',
        'This invitation was sent to a different email address.',
        403,
        {
          hint: 'Ask the goal owner to invite your current email.',
          logLevel: 'warn',
          context: { inviteId: invite._id.toString(), operation: 'accept-invite' },
        }
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
        'You already collaborate on this goal.',
        409,
        {
          hint: 'You can view the goal from your dashboard.',
          logLevel: 'info',
          context: { inviteId: invite._id.toString(), operation: 'accept-invite' },
        }
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
    const payload = AcceptInviteResponseSchema.parse({ goal: serialized });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        'GOAL_VALIDATION_ERROR',
        'We could not read that request. Please check the data and try again.',
        400,
        {
          hint: 'Ensure you are sending valid JSON.',
          logLevel: 'warn',
        }
      );
    }

    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      'GOAL_INTERNAL_ERROR',
      'We could not accept that invitation right now.',
      500,
      {
        hint: 'Please try the link again shortly.',
        error,
        context: { operation: 'accept-invite' },
      }
    );
  }
}

