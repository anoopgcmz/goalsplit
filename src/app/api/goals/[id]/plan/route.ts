import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  netTargetAfterExisting,
  requiredLumpSumForFutureValue,
  requiredPaymentForFutureValue,
  yearFractionFromDates,
} from "@/lib/financial";
import { dbConnect } from "@/lib/mongo";
import GoalModel from "@/models/goal";
import UserModel from "@/models/user";

import { GoalPlanResponseSchema, type GoalPlanResponse } from "../../schemas";
import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  objectIdToString,
  parseObjectId,
  requireUserId,
  serializeGoal,
} from "../../utils";

const contributionFrequencyToNPerYear = (frequency: "monthly" | "yearly"): 1 | 12 =>
  frequency === "monthly" ? 12 : 1;

const EPSILON = 1e-6;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbConnect();

    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;

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

    const members: GoalPlanResponse["members"] = serialized.members.map((member) => {
      const details = memberDetails.get(member.userId);

      return {
        userId: member.userId,
        role: member.role,
        splitPercent: member.splitPercent,
        fixedAmount: member.fixedAmount,
        perPeriod: 0,
        email: details?.email,
        name: details?.name ?? null,
      };
    });

    const goalForResponse: GoalPlanResponse["goal"] = {
      id: serialized.id,
      title: serialized.title,
      currency: serialized.currency,
      targetAmount: serialized.targetAmount,
      targetDate: serialized.targetDate,
      expectedRate: serialized.expectedRate,
      compounding: serialized.compounding,
      contributionFrequency: serialized.contributionFrequency,
      existingSavings: serialized.existingSavings ?? 0,
      isShared: serialized.isShared,
    };

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

    const now = new Date();
    const targetDate = new Date(serialized.targetDate);
    const rawYears = yearFractionFromDates(now, targetDate);
    const tYears = Math.max(rawYears, 0);

    const compoundingNPerYear = contributionFrequencyToNPerYear(serialized.compounding);
    const contributionNPerYear = contributionFrequencyToNPerYear(
      serialized.contributionFrequency,
    );

    const netFutureValue = netTargetAfterExisting(
      serialized.targetAmount,
      serialized.existingSavings ?? 0,
      serialized.expectedRate,
      compoundingNPerYear,
      tYears,
    );

    const totalPerPeriod = requiredPaymentForFutureValue(
      netFutureValue,
      serialized.expectedRate,
      contributionNPerYear,
      tYears,
    );

    const lumpSumNow = requiredLumpSumForFutureValue(
      netFutureValue,
      serialized.expectedRate,
      compoundingNPerYear,
      tYears,
    );

    const warnings: string[] = [];

    if (rawYears <= 0) {
      warnings.push(
        "Target date is in the past or today; recurring contributions may not be feasible.",
      );
    }

    if (!Number.isFinite(totalPerPeriod)) {
      warnings.push(
        "No contribution periods remain; recurring contribution amount is undefined.",
      );
    }

    const fixedTotal = members.reduce((sum, member) => {
      if (typeof member.fixedAmount === "number") {
        member.perPeriod = member.fixedAmount;
        return sum + member.fixedAmount;
      }

      member.perPeriod = 0;
      return sum;
    }, 0);

    let remaining = totalPerPeriod - fixedTotal;

    if (Number.isFinite(totalPerPeriod) && remaining < -EPSILON) {
      warnings.push(
        "Fixed contributions exceed the required per-period amount; review splits.",
      );
      remaining = 0;
    }

    const percentageEligible = members.filter((member) => member.fixedAmount == null);
    const percentSum = percentageEligible.reduce((sum, member) => {
      return sum + (member.splitPercent ?? 0);
    }, 0);

    if (percentageEligible.length > 0) {
      if (percentSum <= EPSILON) {
        if (Number.isFinite(remaining) ? remaining > EPSILON : true) {
          warnings.push(
            "Percentage allocations are missing; unable to distribute contributions.",
          );
        }
      } else {
        if (Math.abs(percentSum - 100) > 0.5) {
          warnings.push("Split percentages do not sum to 100%; allocations normalised.");
        }

        percentageEligible.forEach((member) => {
          const ratio = (member.splitPercent ?? 0) / percentSum;
          member.perPeriod += remaining * ratio;
        });
      }
    } else if (Number.isFinite(remaining) ? remaining > EPSILON : true) {
      warnings.push(
        "No members available to receive the remaining contribution requirement.",
      );
    }

    const contributionMonths = tYears * 12;
    let horizonYears = Math.floor(contributionMonths / 12);
    let horizonMonths = Math.round(contributionMonths - horizonYears * 12);

    if (horizonMonths === 12) {
      horizonYears += 1;
      horizonMonths = 0;
    }

    const plan: GoalPlanResponse = {
      goal: goalForResponse,
      horizon: {
        years: horizonYears,
        months: horizonMonths,
        totalPeriods: contributionNPerYear * tYears,
        nPerYear: contributionNPerYear,
      },
      totals: {
        perPeriod: totalPerPeriod,
        lumpSumNow,
      },
      members,
      assumptions: {
        expectedRate: serialized.expectedRate,
        compounding: serialized.compounding,
        contributionFrequency: serialized.contributionFrequency,
      },
    };

    if (warnings.length > 0) {
      plan.warnings = warnings;
    }

    const parsed = GoalPlanResponseSchema.parse(plan);

    return NextResponse.json(parsed);
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
