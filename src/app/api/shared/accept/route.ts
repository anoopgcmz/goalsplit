import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
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
  rebalancePercentages,
  requireUserId,
  serializeGoal,
} from "../../goals/utils";
import { GoalResponseSchema } from "../../goals/schemas";
import { SESSION_COOKIE_NAME, validateSessionToken } from "@/lib/auth/session";

const InviteTokenSchema = z.string().trim().min(1, "Invitation token is required");

const AcceptInviteSchema = z.object({
  token: InviteTokenSchema,
});

const AcceptInviteQuerySchema = z.object({
  token: InviteTokenSchema,
});

const AcceptInviteResponseSchema = z.object({
  goal: GoalResponseSchema,
});

const AcceptInvitePreviewResponseSchema = z.object({
  invite: z.object({
    goalId: z.string(),
    goalTitle: z.string(),
    inviterName: z.string().nullable(),
    inviterEmail: z.string().email().nullable(),
    inviteeEmail: z.string().email(),
    defaultSplitPercent: z.number().min(0).max(100).nullable(),
    fixedAmount: z.number().min(0).nullable(),
    currency: z.string(),
    expiresAt: z.string().datetime(),
  }),
});

const normaliseEmail = (email: string) => email.trim().toLowerCase();

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const validation = validateSessionToken(sessionToken);
    let userId: Types.ObjectId | null = null;

    if (validation.success && Types.ObjectId.isValid(validation.session.userId)) {
      userId = new Types.ObjectId(validation.session.userId);
    }

    await dbConnect();

    const rawToken = request.nextUrl.searchParams.get("token") ?? "";
    const { token } = AcceptInviteQuerySchema.parse({ token: rawToken });

    const invite = await InviteModel.findOne({ token });

    if (!invite) {
      return createErrorResponse(
        "GOAL_NOT_FOUND",
        "We could not find that invitation.",
        404,
        {
          hint: "It may have already been used or revoked.",
          logLevel: "info",
          context: { token, operation: "preview-invite" },
        },
      );
    }

    if (invite.acceptedAt) {
      return createErrorResponse(
        "GOAL_CONFLICT",
        "This invitation was already accepted.",
        409,
        {
          hint: "Ask the goal owner to send a new invitation if needed.",
          logLevel: "info",
          context: { inviteId: invite._id.toString(), operation: "preview-invite" },
        },
      );
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      return createErrorResponse("GOAL_CONFLICT", "This invitation has expired.", 409, {
        hint: "Ask the goal owner to send a fresh invitation.",
        logLevel: "info",
        context: { inviteId: invite._id.toString(), operation: "preview-invite" },
      });
    }

    const [goal, inviter, user] = await Promise.all([
      GoalModel.findById(invite.goalId),
      UserModel.findById(invite.createdBy),
      userId ? UserModel.findById(userId) : Promise.resolve(null),
    ]);

    if (!goal) {
      return createErrorResponse("GOAL_NOT_FOUND", "We could not find that goal.", 404, {
        hint: "It may have been removed.",
        logLevel: "info",
        context: {
          inviteId: invite._id.toString(),
          goalId: invite.goalId.toString(),
          operation: "preview-invite",
        },
      });
    }

    if (userId && !user) {
      return createErrorResponse("GOAL_UNAUTHORIZED", "We could not verify your account for this invitation.", 401, {
        hint: "Please sign in again and retry the link.",
        logLevel: "warn",
        context: { userId: objectIdToString(userId), operation: "preview-invite" },
      });
    }

    if (user) {
      if (normaliseEmail(user.email) !== normaliseEmail(invite.email)) {
        return createErrorResponse("GOAL_FORBIDDEN", "This invitation was sent to a different email address.", 403, {
          hint: "Ask the goal owner to invite your current email.",
          logLevel: "warn",
          context: { inviteId: invite._id.toString(), operation: "preview-invite" },
        });
      }

      const normalizedUserId = objectIdToString(user._id);
      const isAlreadyMember = goal.members.some((member) => {
        return objectIdToString(member.userId) === normalizedUserId;
      });

      if (isAlreadyMember) {
        return createErrorResponse("GOAL_CONFLICT", "You already collaborate on this goal.", 409, {
          hint: "You can view the goal from your dashboard.",
          logLevel: "info",
          context: { inviteId: invite._id.toString(), operation: "preview-invite" },
        });
      }
    }

    const payload = AcceptInvitePreviewResponseSchema.parse({
      invite: {
        goalId: objectIdToString(invite.goalId),
        goalTitle: goal.title,
        inviterName: inviter?.name ?? null,
        inviterEmail: inviter?.email ?? null,
        inviteeEmail: invite.email,
        defaultSplitPercent:
          invite.defaultSplitPercent == null ? null : Number(invite.defaultSplitPercent),
        fixedAmount: invite.fixedAmount == null ? null : Number(invite.fixedAmount),
        currency: goal.currency,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "We could not preview that invitation right now.",
      500,
      {
        hint: "Please refresh and try again.",
        error,
        context: { operation: "preview-invite" },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;
    await dbConnect();

    const body: unknown = await request.json();
    const parsedBody = AcceptInviteSchema.parse(body);

    const invite = await InviteModel.findOne({ token: parsedBody.token });

    if (!invite) {
      return createErrorResponse(
        "GOAL_NOT_FOUND",
        "We could not find that invitation.",
        404,
        {
          hint: "It may have already been used or revoked.",
          logLevel: "info",
          context: { token: parsedBody.token, operation: "accept-invite" },
        },
      );
    }

    if (invite.acceptedAt) {
      return createErrorResponse(
        "GOAL_CONFLICT",
        "This invitation was already accepted.",
        409,
        {
          hint: "Ask the goal owner to send a new invitation if needed.",
          logLevel: "info",
          context: { inviteId: invite._id.toString(), operation: "accept-invite" },
        },
      );
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      return createErrorResponse("GOAL_CONFLICT", "This invitation has expired.", 409, {
        hint: "Ask the goal owner to send a fresh invitation.",
        logLevel: "info",
        context: { inviteId: invite._id.toString(), operation: "accept-invite" },
      });
    }

    const [goal, user] = await Promise.all([
      GoalModel.findById(invite.goalId),
      UserModel.findById(userId),
    ]);

    if (!goal) {
      return createErrorResponse("GOAL_NOT_FOUND", "We could not find that goal.", 404, {
        hint: "It may have been removed.",
        logLevel: "info",
        context: {
          inviteId: invite._id.toString(),
          goalId: invite.goalId.toString(),
          operation: "accept-invite",
        },
      });
    }

    if (!user) {
      return createErrorResponse(
        "GOAL_UNAUTHORIZED",
        "We could not verify your account for this invitation.",
        401,
        {
          hint: "Please sign in again and retry the link.",
          logLevel: "warn",
          context: { userId: userId.toString(), operation: "accept-invite" },
        },
      );
    }

    if (normaliseEmail(user.email) !== normaliseEmail(invite.email)) {
      return createErrorResponse(
        "GOAL_FORBIDDEN",
        "This invitation was sent to a different email address.",
        403,
        {
          hint: "Ask the goal owner to invite your current email.",
          logLevel: "warn",
          context: { inviteId: invite._id.toString(), operation: "accept-invite" },
        },
      );
    }

    const normalizedUserId = objectIdToString(userId);
    const isAlreadyMember = goal.members.some((member) => {
      return objectIdToString(member.userId) === normalizedUserId;
    });

    if (isAlreadyMember) {
      return createErrorResponse(
        "GOAL_CONFLICT",
        "You already collaborate on this goal.",
        409,
        {
          hint: "You can view the goal from your dashboard.",
          logLevel: "info",
          context: { inviteId: invite._id.toString(), operation: "accept-invite" },
        },
      );
    }

    const newMember: Goal["members"][number] = {
      userId,
      role: "collaborator",
    };

    if (invite.fixedAmount == null) {
      newMember.splitPercent = invite.defaultSplitPercent ?? 0;
    } else {
      newMember.fixedAmount = invite.fixedAmount;
    }

    goal.members.push(newMember);
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
      "We could not accept that invitation right now.",
      500,
      {
        hint: "Please try the link again shortly.",
        error,
        context: { operation: "accept-invite" },
      },
    );
  }
}
