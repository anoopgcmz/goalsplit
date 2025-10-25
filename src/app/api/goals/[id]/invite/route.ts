import { randomBytes } from "crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { dbConnect } from "@/lib/mongo";
import GoalModel from "@/models/goal";
import InviteModel from "@/models/invite";

import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  objectIdToString,
  parseObjectId,
  requireUserId,
} from "../../utils";

const CreateInviteInputSchema = z
  .object({
    email: z.string().trim().email(),
    expiresInMinutes: z.coerce.number().int().min(1).default(10080),
    defaultSplitPercent: z.coerce.number().min(0).max(100).default(50),
    fixedAmount: z
      .union([z.coerce.number().min(0), z.null()])
      .optional()
      .default(null),
  })
  .transform((value) => ({
    email: value.email.toLowerCase(),
    expiresInMinutes: value.expiresInMinutes,
    defaultSplitPercent: value.defaultSplitPercent,
    fixedAmount: value.fixedAmount ?? null,
  }));

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
      return createErrorResponse("GOAL_NOT_FOUND", "Goal not found", 404);
    }

    const isOwner = objectIdToString(goal.ownerId) === objectIdToString(userId);

    if (!isOwner) {
      return createErrorResponse(
        "GOAL_FORBIDDEN",
        "Only the owner may invite collaborators",
        403,
      );
    }

    const rawBody: unknown = await request.json();
    const parsedBody = CreateInviteInputSchema.parse(rawBody);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + parsedBody.expiresInMinutes * 60_000);

    await InviteModel.deleteOne({ goalId, email: parsedBody.email });

    await InviteModel.create({
      goalId,
      email: parsedBody.email,
      token,
      expiresAt,
      createdBy: userId,
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
