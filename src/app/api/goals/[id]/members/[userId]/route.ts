import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { dbConnect } from "@/lib/mongo";
import GoalModel from "@/models/goal";

import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  objectIdToString,
  parseObjectId,
  rebalancePercentages,
  requireUserId,
  serializeGoal,
} from "../../../utils";

const RemoveGoalMemberParamsSchema = z.object({
  id: z.string().trim().min(1, "Goal id is required"),
  userId: z.string().trim().min(1, "Member id is required"),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } },
) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const actingUserId = userIdOrResponse;

    const { id, userId } = RemoveGoalMemberParamsSchema.parse(params);

    await dbConnect();

    const goalId = parseObjectId(id);
    const memberId = parseObjectId(userId);

    const goal = await GoalModel.findOne({ _id: goalId, ownerId: actingUserId });

    if (!goal) {
      const goalExists = await GoalModel.exists({ _id: goalId });

      if (goalExists) {
        return createErrorResponse(
          "GOAL_FORBIDDEN",
          "Only the owner can remove collaborators from this goal.",
          403,
          {
            hint: "Ask the goal owner to manage members for you.",
            logLevel: "warn",
            context: { goalId: id, memberId: userId, operation: "remove-member" },
          },
        );
      }

      return createErrorResponse("GOAL_NOT_FOUND", "We could not find that goal.", 404, {
        hint: "It may have been removed or you might not have access.",
        logLevel: "info",
        context: { goalId: id, memberId: userId, operation: "remove-member" },
      });
    }

    const normalizedOwnerId = objectIdToString(goal.ownerId);

    const normalizedMemberId = objectIdToString(memberId);

    if (normalizedMemberId === normalizedOwnerId) {
      return createErrorResponse(
        "GOAL_VALIDATION_ERROR",
        "You cannot remove the goal owner.",
        422,
        {
          hint: "Transfer ownership before leaving the goal.",
          logLevel: "info",
          context: { goalId: id, memberId: userId, operation: "remove-member" },
        },
      );
    }

    const memberIndex = goal.members.findIndex((member) => {
      return objectIdToString(member.userId) === normalizedMemberId;
    });

    if (memberIndex === -1) {
      return createErrorResponse(
        "GOAL_NOT_FOUND",
        "That collaborator is not part of this goal.",
        404,
        {
          hint: "Refresh the members list and try again.",
          logLevel: "info",
          context: { goalId: id, memberId: userId, operation: "remove-member" },
        },
      );
    }

    goal.members.splice(memberIndex, 1);

    if (
      !goal.members.some((member) => {
        return objectIdToString(member.userId) === normalizedOwnerId;
      })
    ) {
      goal.members.unshift({
        userId: goal.ownerId,
        role: "owner",
        splitPercent: 100,
      });
    }

    const hasCollaborators = goal.members.some((member) => {
      return objectIdToString(member.userId) !== normalizedOwnerId;
    });

    goal.isShared = hasCollaborators;

    rebalancePercentages(goal);

    const updatedGoal = await goal.save();

    return NextResponse.json(serializeGoal(updatedGoal));
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "We could not remove that collaborator right now.",
      500,
      {
        hint: "Please try again shortly.",
        error,
        context: {
          goalId: params.id,
          memberId: params.userId,
          operation: "remove-member",
        },
      },
    );
  }
}
