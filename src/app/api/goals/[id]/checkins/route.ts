import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { dbConnect } from "@/lib/mongo";
import GoalModel from "@/models/goal";
import UserModel from "@/models/user";
import { CheckInModel } from "@/models/checkin";

import {
  buildGoalAccessFilter,
  createErrorResponse,
  handleZodError,
  isNextResponse,
  parseObjectId,
  requireUserId,
} from "../../utils";
import { normalizePeriod } from "../../../contributions/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: goalIdParam } = await params;
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;
    await dbConnect();

    const goalId = parseObjectId(goalIdParam);
    const goal = await GoalModel.findOne(buildGoalAccessFilter(goalId, userId)).lean();

    if (!goal) {
      const goalExists = await GoalModel.exists({ _id: goalId });
      if (goalExists) {
        return createErrorResponse(
          "GOAL_FORBIDDEN",
          "This goal belongs to someone else.",
          403,
          {
            hint: "Ask the owner to share access with you.",
            logLevel: "warn",
            context: { goalId: goalIdParam, operation: "checkins" },
          },
        );
      }
      return createErrorResponse("GOAL_NOT_FOUND", "We could not find that goal.", 404, {
        hint: "It may have been removed.",
        logLevel: "info",
        context: { goalId: goalIdParam, operation: "checkins" },
      });
    }

    const periodParam = request.nextUrl.searchParams.get("period");
    const period = periodParam
      ? normalizePeriod(periodParam)
      : normalizePeriod(new Date());

    const memberUserIds = goal.members.map((m) => m.userId);

    const [users, checkins] = await Promise.all([
      UserModel.find({ _id: { $in: memberUserIds } }).lean(),
      CheckInModel.find({
        goalId,
        period,
        userId: { $in: memberUserIds },
      }).lean(),
    ]);

    const userMap = new Map(
      users.map((u) => [
        u._id.toString(),
        {
          email: u.email,
          name:
            typeof u.name === "string" && u.name.trim().length > 0
              ? u.name.trim()
              : null,
        },
      ]),
    );

    const checkinMap = new Map(
      checkins.map((c) => [
        c.userId.toString(),
        {
          status: c.status,
          amount: c.amount,
          respondedAt: c.respondedAt ? c.respondedAt.toISOString() : null,
        },
      ]),
    );

    const members = memberUserIds.map((uid) => {
      const uidStr = uid.toString();
      const userInfo = userMap.get(uidStr);
      const checkinInfo = checkinMap.get(uidStr);
      return {
        userId: uidStr,
        name: userInfo?.name ?? null,
        email: userInfo?.email ?? "",
        status: checkinInfo?.status ?? "pending",
        amount: checkinInfo?.amount ?? null,
        respondedAt: checkinInfo?.respondedAt ?? null,
      };
    });

    return NextResponse.json({
      period: period.toISOString(),
      members,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "We could not load check-ins right now.",
      500,
      {
        hint: "Please try again shortly.",
        error,
        context: { goalId: goalIdParam, operation: "checkins" },
      },
    );
  }
}
