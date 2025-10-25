import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { HydratedDocument, Types } from "mongoose";
import { ZodError } from "zod";

import { dbConnect } from "@/lib/mongo";
import ContributionModel from "@/models/contribution";
import GoalModel, { type Goal } from "@/models/goal";
import InviteModel from "@/models/invite";

import { UpdateGoalInputSchema } from "../schemas";
import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  objectIdToString,
  parseObjectId,
  requireUserId,
  serializeGoal,
} from "../utils";

type GoalDocument = HydratedDocument<Goal>;

const isGoalMember = (goal: GoalDocument | null, userId: Types.ObjectId) => {
  if (!goal) {
    return false;
  }

  const goalObject = goal.toObject<Goal>();
  const normalizedUserId = objectIdToString(userId);
  const ownerIdMatches = objectIdToString(goalObject.ownerId) === normalizedUserId;

  if (ownerIdMatches) {
    return true;
  }

  return goalObject.members.some((member) => {
    return objectIdToString(member.userId) === normalizedUserId;
  });
};

const isGoalOwner = (goal: GoalDocument | null, userId: Types.ObjectId) => {
  if (!goal) {
    return false;
  }

  const goalObject = goal.toObject<Goal>();
  return objectIdToString(goalObject.ownerId) === objectIdToString(userId);
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;
    await dbConnect();

    const goalId = parseObjectId(params.id);
    const goal = await GoalModel.findById(goalId);

    if (!goal) {
      return createErrorResponse("GOAL_NOT_FOUND", "We could not find that goal.", 404, {
        hint: "It may have been removed or you might not have access.",
        logLevel: "info",
        context: { goalId: params.id, operation: "get" },
      });
    }

    if (!isGoalMember(goal, userId)) {
      return createErrorResponse(
        "GOAL_FORBIDDEN",
        "This goal belongs to someone else.",
        403,
        {
          hint: "Ask the owner to share access with you.",
          logLevel: "warn",
          context: { goalId: params.id, operation: "get" },
        },
      );
    }

    return NextResponse.json(serializeGoal(goal));
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "We had trouble retrieving that goal just now.",
      500,
      {
        hint: "Please refresh in a moment.",
        error,
        context: { goalId: params.id, operation: "get" },
      },
    );
  }
}

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
    const goal = await GoalModel.findById(goalId);

    if (!goal) {
      return createErrorResponse("GOAL_NOT_FOUND", "We could not find that goal.", 404, {
        hint: "It may have been removed or you might not have access.",
        logLevel: "info",
        context: { goalId: params.id, operation: "patch" },
      });
    }

    if (!isGoalOwner(goal, userId)) {
      return createErrorResponse(
        "GOAL_FORBIDDEN",
        "Only the owner can update this goal.",
        403,
        {
          hint: "Ask the owner to apply these changes.",
          logLevel: "warn",
          context: { goalId: params.id, operation: "patch" },
        },
      );
    }

    const body: unknown = await request.json();
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
      "We could not update that goal right now.",
      500,
      {
        hint: "Please try again shortly.",
        error,
        context: { goalId: params.id, operation: "patch" },
      },
    );
  }
}

export async function DELETE(
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
    const goal = await GoalModel.findById(goalId);

    if (!goal) {
      return createErrorResponse("GOAL_NOT_FOUND", "We could not find that goal.", 404, {
        hint: "It may have already been removed.",
        logLevel: "info",
        context: { goalId: params.id, operation: "delete" },
      });
    }

    if (!isGoalOwner(goal, userId)) {
      return createErrorResponse(
        "GOAL_FORBIDDEN",
        "Only the owner can delete this goal.",
        403,
        {
          hint: "Ask the owner to remove it for you.",
          logLevel: "warn",
          context: { goalId: params.id, operation: "delete" },
        },
      );
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
      "GOAL_INTERNAL_ERROR",
      "We could not delete that goal right now.",
      500,
      {
        hint: "Please try again shortly.",
        error,
        context: { goalId: params.id, operation: "delete" },
      },
    );
  }
}
