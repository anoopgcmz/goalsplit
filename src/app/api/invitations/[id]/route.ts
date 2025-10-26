import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { ZodError, z } from "zod";

import { dbConnect } from "@/lib/mongo";
import GoalModel, { type Goal } from "@/models/goal";
import InviteModel from "@/models/invite";
import UserModel from "@/models/user";

import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  objectIdToString,
  parseObjectId,
  rebalancePercentages,
  requireUserId,
} from "../../goals/utils";
import { InvitationDetailResponseSchema } from "../schemas";
import {
  markInviteExpiredIfNeeded,
  normaliseEmail,
  serializeInvitation,
} from "../utils";

const InvitationActionSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

const buildGoalPreview = async (goalId: Types.ObjectId | string) => {
  const goal = await GoalModel.findById(goalId);

  if (!goal) {
    return null;
  }

  const owner = await UserModel.findById(goal.ownerId);

  return {
    title: goal.title,
    targetAmount: goal.targetAmount,
    currency: goal.currency,
    targetDate: goal.targetDate.toISOString(),
    expectedRate: goal.expectedRate,
    ownerName: owner?.name ?? null,
  };
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;

    await dbConnect();

    const inviteId = parseObjectId(params.id);
    const [invite, user] = await Promise.all([
      InviteModel.findById(inviteId),
      UserModel.findById(userId),
    ]);

    if (!invite) {
      return createErrorResponse("GOAL_NOT_FOUND", "We couldn't find that invitation.", 404, {
        hint: "It may have been removed.",
        logLevel: "info",
        context: { inviteId: params.id, operation: "get-invitation" },
      });
    }

    if (!user) {
      return createErrorResponse("GOAL_UNAUTHORIZED", "We could not verify your account.", 401, {
        hint: "Please sign in again and try once more.",
        logLevel: "warn",
      });
    }

    if (normaliseEmail(invite.email) !== normaliseEmail(user.email)) {
      return createErrorResponse("GOAL_FORBIDDEN", "This invitation belongs to a different account.", 403, {
        hint: "Sign in with the email address that received the invite.",
        logLevel: "warn",
        context: { inviteId: params.id, operation: "get-invitation" },
      });
    }

    await markInviteExpiredIfNeeded(invite);

    const goal = await buildGoalPreview(invite.goalId);

    const payload = InvitationDetailResponseSchema.parse({
      invitation: serializeInvitation(invite),
      goal,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse("GOAL_INTERNAL_ERROR", "We couldn't load that invitation.", 500, {
      hint: "Please refresh and try again.",
      error,
      context: { inviteId: params.id, operation: "get-invitation" },
    });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;

    await dbConnect();

    const inviteId = parseObjectId(params.id);
    const [invite, user] = await Promise.all([
      InviteModel.findById(inviteId),
      UserModel.findById(userId),
    ]);

    if (!invite) {
      return createErrorResponse("GOAL_NOT_FOUND", "We couldn't find that invitation.", 404, {
        hint: "It may have been removed.",
        logLevel: "info",
        context: { inviteId: params.id, operation: "update-invitation" },
      });
    }

    if (!user) {
      return createErrorResponse("GOAL_UNAUTHORIZED", "We could not verify your account.", 401, {
        hint: "Please sign in again and try once more.",
        logLevel: "warn",
      });
    }

    if (normaliseEmail(invite.email) !== normaliseEmail(user.email)) {
      return createErrorResponse("GOAL_FORBIDDEN", "This invitation belongs to a different account.", 403, {
        hint: "Sign in with the email address that received the invite.",
        logLevel: "warn",
        context: { inviteId: params.id, operation: "update-invitation" },
      });
    }

    const body: unknown = await request.json();
    const { action } = InvitationActionSchema.parse(body);

    await markInviteExpiredIfNeeded(invite);

    if (invite.status === "accepted") {
      return createErrorResponse("GOAL_CONFLICT", "You've already joined this goal.", 409, {
        hint: "Open the goal from your dashboard to collaborate.",
        logLevel: "info",
        context: { inviteId: params.id, operation: "update-invitation" },
      });
    }

    if (invite.status === "declined") {
      return createErrorResponse("GOAL_CONFLICT", "You already declined this invitation.", 409, {
        hint: "Ask the owner to send a new invite if you've changed your mind.",
        logLevel: "info",
        context: { inviteId: params.id, operation: "update-invitation" },
      });
    }

    if (invite.status === "expired") {
      return createErrorResponse("GOAL_CONFLICT", "This invitation has expired.", 409, {
        hint: "Ask the goal owner to send a fresh invitation.",
        logLevel: "info",
        context: { inviteId: params.id, operation: "update-invitation" },
      });
    }

    if (action === "decline") {
      invite.status = "declined";
      invite.respondedAt = new Date();
      invite.acceptedAt = undefined;
      await invite.save();

      const goal = await buildGoalPreview(invite.goalId);
      const payload = InvitationDetailResponseSchema.parse({
        invitation: serializeInvitation(invite),
        goal,
      });

      return NextResponse.json(payload, { status: 200 });
    }

    const goal = await GoalModel.findById(invite.goalId);

    if (!goal) {
      invite.status = "expired";
      invite.respondedAt = new Date();
      await invite.save();

      return createErrorResponse("GOAL_NOT_FOUND", "We couldn't find that goal anymore.", 404, {
        hint: "It may have been removed.",
        logLevel: "info",
        context: { inviteId: params.id, operation: "update-invitation" },
      });
    }

    const normalizedUserId = objectIdToString(userId);
    const isAlreadyMember = goal.members.some((member) => {
      return objectIdToString(member.userId) === normalizedUserId;
    });

    if (isAlreadyMember) {
      invite.status = "accepted";
      invite.respondedAt = invite.respondedAt ?? new Date();
      invite.acceptedAt = invite.acceptedAt ?? new Date();
      await invite.save();

      const goalPreview = await buildGoalPreview(goal._id);
      const payload = InvitationDetailResponseSchema.parse({
        invitation: serializeInvitation(invite),
        goal: goalPreview,
      });

      return NextResponse.json(payload, { status: 200 });
    }

    const newMember: Goal["members"][number] = { userId, role: "collaborator" };

    if (invite.fixedAmount == null) {
      newMember.splitPercent = invite.defaultSplitPercent ?? 0;
    } else {
      newMember.fixedAmount = invite.fixedAmount;
    }

    goal.members.push(newMember);
    goal.isShared = true;

    rebalancePercentages(goal);

    const now = new Date();
    invite.status = "accepted";
    invite.respondedAt = now;
    invite.acceptedAt = now;

    const [updatedGoal] = await Promise.all([goal.save(), invite.save()]);
    const goalPreview = await buildGoalPreview(updatedGoal._id);

    const payload = InvitationDetailResponseSchema.parse({
      invitation: serializeInvitation(invite),
      goal: goalPreview,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse("GOAL_VALIDATION_ERROR", "We couldn't read that request.", 400, {
        hint: "Send valid JSON with the action to perform.",
        logLevel: "warn",
      });
    }

    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse("GOAL_INTERNAL_ERROR", "We couldn't update that invitation.", 500, {
      hint: "Please try again in a moment.",
      error,
      context: { inviteId: params.id, operation: "update-invitation" },
    });
  }
}
