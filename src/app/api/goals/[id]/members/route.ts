import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { ZodError, ZodIssueCode, type ZodIssue } from "zod";

import { dbConnect } from "@/lib/mongo";
import GoalModel from "@/models/goal";

import { UpdateGoalMembersInputSchema } from "../../schemas";
import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  objectIdToString,
  parseObjectId,
  rebalancePercentages,
  requireUserId,
  serializeGoal,
} from "../../utils";

const buildObjectIdIssues = (issues: ZodIssue[]): never => {
  throw new ZodError(issues);
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;
    await dbConnect();

    const goalId = parseObjectId(params.id);
    const goal = await GoalModel.findOne({ _id: goalId, ownerId: userId });

    if (!goal) {
      const goalExists = await GoalModel.exists({ _id: goalId });

      if (goalExists) {
        return createErrorResponse(
          "GOAL_FORBIDDEN",
          "Only the owner can update members for this goal.",
          403,
          {
            hint: "Ask the goal owner to apply these changes.",
            logLevel: "warn",
            context: { goalId: params.id, operation: "update-members" },
          },
        );
      }

      return createErrorResponse("GOAL_NOT_FOUND", "We could not find that goal.", 404, {
        hint: "It may have been removed or you might not have access.",
        logLevel: "info",
        context: { goalId: params.id, operation: "update-members" },
      });
    }

    const body: unknown = await request.json();
    const parsedBody = UpdateGoalMembersInputSchema.parse(body);

    const issues: ZodIssue[] = [];
    const normalizedMembers = parsedBody.members.map((member, index) => {
      if (!Types.ObjectId.isValid(member.userId)) {
        issues.push({
          code: ZodIssueCode.custom,
          message: "We couldn't identify that collaborator. Refresh the page and try again.",
          path: ["members", index, "userId"],
        });
        return null as never;
      }

      return {
        userId: new Types.ObjectId(member.userId),
        role: member.role,
        splitPercent: member.splitPercent ?? undefined,
        fixedAmount: member.fixedAmount ?? undefined,
      };
    });

    if (issues.length > 0) {
      buildObjectIdIssues(issues);
    }

    const ownerIdString = objectIdToString(goal.ownerId);
    const ownerEntryIndex = normalizedMembers.findIndex((member) => {
      return objectIdToString(member.userId) === ownerIdString;
    });

    if (ownerEntryIndex === -1) {
      buildObjectIdIssues([
        {
          code: ZodIssueCode.custom,
          message: "Keep the goal owner in the members list.",
          path: ["members"],
        },
      ]);
    }

    const ownerIssues: ZodIssue[] = [];
    normalizedMembers.forEach((member, index) => {
      const memberId = objectIdToString(member.userId);
      const isOwner = memberId === ownerIdString;

      if (isOwner && member.role !== "owner") {
        ownerIssues.push({
          code: ZodIssueCode.custom,
          message: "List the goal owner as an owner.",
          path: ["members", index, "role"],
        });
      }

      if (!isOwner && member.role === "owner") {
        ownerIssues.push({
          code: ZodIssueCode.custom,
          message: "Only the goal owner can be marked as owner.",
          path: ["members", index, "role"],
        });
      }
    });

    if (ownerIssues.length > 0) {
      buildObjectIdIssues(ownerIssues);
    }

    const hasCollaborators = normalizedMembers.some((member) => {
      return objectIdToString(member.userId) !== ownerIdString;
    });

    goal.set({ members: normalizedMembers, isShared: hasCollaborators });
    rebalancePercentages(goal);

    const updatedGoal = await goal.save();

    return NextResponse.json(serializeGoal(updatedGoal));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        "GOAL_VALIDATION_ERROR",
        "We could not read that request. Please check the data and try again.",
        400,
        {
          hint: "Ensure you are sending valid JSON.",
          logLevel: "warn",
        },
      );
    }

    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "We could not update these contributions right now.",
      500,
      {
        hint: "Please try again shortly.",
        error,
        context: { goalId: params.id, operation: "update-members" },
      },
    );
  }
}
