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
  buildGoalAccessFilter,
  parseObjectId,
  requireUserId,
  serializeGoal,
} from "../../utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;
    await dbConnect();

    const { id: goalIdParam } = await params;
    const goalId = parseObjectId(goalIdParam);
    const goalDoc = await GoalModel.findOne(buildGoalAccessFilter(goalId, userId));

    if (!goalDoc) {
      const goalExists = await GoalModel.exists({ _id: goalId });

      if (goalExists) {
        return createErrorResponse(
          "GOAL_FORBIDDEN",
          "This goal belongs to someone else.",
          403,
          {
            hint: "Ask the owner to share access with you.",
            logLevel: "warn",
            context: { goalId: goalIdParam, operation: "plan" },
          },
        );
      }

      return createErrorResponse("GOAL_NOT_FOUND", "We could not find that goal.", 404, {
        hint: "It may have been removed.",
        logLevel: "info",
        context: { goalId: goalIdParam, operation: "plan" },
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
        context: { goalId: goalIdParam, operation: "plan" },
      },
    );
  }
}
