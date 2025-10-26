import { randomBytes } from "crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { dbConnect } from "@/lib/mongo";
import GoalModel from "@/models/goal";
import InviteModel from "@/models/invite";
import UserModel from "@/models/user";

import { CreateGoalInviteInputSchema } from "../../schemas";
import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  parseObjectId,
  requireUserId,
} from "../../utils";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
          "Only the owner may invite collaborators",
          403,
        );
      }

      return createErrorResponse("GOAL_NOT_FOUND", "Goal not found", 404);
    }

    const rawBody: unknown = await request.json();
    const parsedBody = CreateGoalInviteInputSchema.parse(rawBody);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + parsedBody.expiresInMinutes * 60_000);

    const inviter = await UserModel.findById(userId);

    await InviteModel.deleteOne({ goalId, email: parsedBody.email });

    await InviteModel.create({
      goalId,
      goalTitle: goal.title,
      email: parsedBody.email,
      token,
      expiresAt,
      createdBy: userId,
      inviterName: inviter?.name ?? null,
      inviterEmail: inviter?.email,
      message: parsedBody.message ?? null,
      defaultSplitPercent: parsedBody.defaultSplitPercent,
      fixedAmount: parsedBody.fixedAmount,
    });

    const inviteUrl = new URL(
      `/shared/accept?token=${encodeURIComponent(token)}`,
      request.nextUrl.origin,
    ).toString();

    return NextResponse.json({ inviteUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse("GOAL_VALIDATION_ERROR", "Invalid JSON payload", 400);
    }

    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse("GOAL_INTERNAL_ERROR", "Unable to create invitation", 500);
  }
}
