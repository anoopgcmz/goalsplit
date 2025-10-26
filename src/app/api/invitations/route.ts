import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { dbConnect } from "@/lib/mongo";
import InviteModel from "@/models/invite";
import UserModel from "@/models/user";

import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  requireUserId,
} from "../goals/utils";
import { InvitationListResponseSchema, type InvitationStatus } from "./schemas";
import { markExpiredInvitations, normaliseEmail, parseStatuses, serializeInvitation } from "./utils";

export async function GET(request: NextRequest) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;

    await dbConnect();

    const user = await UserModel.findById(userId);

    if (!user) {
      return createErrorResponse("GOAL_UNAUTHORIZED", "We could not verify your account.", 401, {
        hint: "Please sign in again and try once more.",
        logLevel: "warn",
      });
    }

    const email = normaliseEmail(user.email);

    const invites = await InviteModel.find({ email }).sort({ createdAt: -1 });

    await markExpiredInvitations(invites);

    const statuses = parseStatuses(request);

    const filtered = statuses
      ? invites.filter((invite) => {
          const status = invite.status as InvitationStatus;
          return statuses.includes(status);
        })
      : invites;

    const serialized = filtered.map((invite) => serializeInvitation(invite));
    const payload = InvitationListResponseSchema.parse({ invitations: serialized });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse("GOAL_INTERNAL_ERROR", "We couldn't load your invitations.", 500, {
      hint: "Please refresh and try again.",
      error,
      context: { operation: "list-invitations" },
    });
  }
}
