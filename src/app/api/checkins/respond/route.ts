import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { dbConnect } from "@/lib/mongo";
import { CheckInModel } from "@/models/checkin";
import ContributionModel from "@/models/contribution";
import GoalModel from "@/models/goal";
import UserModel from "@/models/user";
import { ApiErrorResponseSchema } from "../../../api/common/schemas";
import { normalizePeriod } from "../../contributions/schemas";

const RespondInputSchema = z.object({
  token: z.string().trim().min(1, "Token is required"),
  status: z.enum(["confirmed", "skipped"]),
  amount: z.coerce.number().positive().optional(),
});

function errorResponse(code: string, message: string, status: number) {
  const payload = ApiErrorResponseSchema.parse({
    error: { code, message, locale: "en" },
  });
  return NextResponse.json(payload, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = RespondInputSchema.parse(body);

    await dbConnect();

    const checkin = await CheckInModel.findOne({ token: parsed.token });

    if (!checkin) {
      return errorResponse(
        "CHECKIN_NOT_FOUND",
        "This check-in link is invalid.",
        404,
      );
    }

    if (checkin.tokenExpiresAt < new Date()) {
      return errorResponse(
        "CHECKIN_TOKEN_EXPIRED",
        "This check-in link has expired.",
        410,
      );
    }

    checkin.status = parsed.status;
    checkin.respondedAt = new Date();
    if (parsed.amount !== undefined) {
      checkin.amount = parsed.amount;
    }
    await checkin.save();

    if (parsed.status === "confirmed") {
      const contributionAmount =
        parsed.amount ?? checkin.amount;

      if (contributionAmount !== undefined && contributionAmount > 0) {
        const period = normalizePeriod(checkin.period);
        await ContributionModel.findOneAndUpdate(
          {
            userId: checkin.userId,
            goalId: checkin.goalId,
            period,
          },
          {
            $set: { amount: contributionAmount, period },
            $setOnInsert: { userId: checkin.userId, goalId: checkin.goalId },
          },
          { upsert: true, new: true, runValidators: true },
        );
      }
    }

    const [goal, user] = await Promise.all([
      GoalModel.findById(checkin.goalId).lean(),
      UserModel.findById(checkin.userId).lean(),
    ]);

    const goalTitle = goal?.title ?? "your goal";
    const memberName =
      user && typeof user.name === "string" && user.name.trim().length > 0
        ? user.name.trim()
        : null;

    return NextResponse.json({ success: true, goalTitle, memberName });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse(
        "CHECKIN_VALIDATION_ERROR",
        "We could not read that request. Please check the data and try again.",
        400,
      );
    }

    if (error instanceof ZodError) {
      const message = error.errors.map((e) => e.message).join("; ");
      return errorResponse("CHECKIN_VALIDATION_ERROR", message, 422);
    }

    return errorResponse(
      "CHECKIN_INTERNAL_ERROR",
      "We could not process your check-in right now. Please try again shortly.",
      500,
    );
  }
}
