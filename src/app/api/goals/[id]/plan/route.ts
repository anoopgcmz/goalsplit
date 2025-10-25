import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { dbConnect } from "@/lib/mongo";
import { buildGoalPlan } from "@/lib/goals/plan";
import GoalModel from "@/models/goal";
import UserModel from "@/models/user";

import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  objectIdToString,
  parseObjectId,
  requireUserId,
  serializeGoal,
} from "../../utils";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;
    await dbConnect();

    const goalId = parseObjectId(params.id);
    const goalDoc = await GoalModel.findById(goalId);

    if (!goalDoc) {
      return createErrorResponse("GOAL_NOT_FOUND", "We could not find that goal.", 404, {
        hint: "It may have been removed.",
        logLevel: "info",
        context: { goalId: params.id, operation: "plan" },
      });
    }

    const serialized = serializeGoal(goalDoc);

    const memberUserIds = serialized.members.map((member) => member.userId);
    const memberUsers = await UserModel.find({ _id: { $in: memberUserIds } });
    const memberDetails = new Map(
      memberUsers.map((user) => {
        const normalizedId = user._id.toString();
        const trimmedName = typeof user.name === "string" ? user.name.trim() : "";
        return [
          normalizedId,
          {
            email: user.email,
            name: trimmedName.length > 0 ? trimmedName : null,
          },
        ] as const;
      }),
    );

    const normalizedUserId = objectIdToString(userId);
    const isOwner = serialized.ownerId === normalizedUserId;
    const isMember = serialized.members.some(
      (member) => member.userId === normalizedUserId,
    );

    if (!isOwner && !isMember) {
      return createErrorResponse(
        "GOAL_FORBIDDEN",
        "This goal belongs to someone else.",
        403,
        {
          hint: "Ask the owner to share access with you.",
          logLevel: "warn",
          context: { goalId: params.id, operation: "plan" },
        },
      );
    }

    const plan = buildGoalPlan(serialized, memberDetails);

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "We could not build that plan right now.",
      500,
      {
        hint: "Please try again shortly.",
        error,
        context: { goalId: params.id, operation: "plan" },
      },
    );
  }
}
