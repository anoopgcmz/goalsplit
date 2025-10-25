import {
  GoalPlanResponseSchema,
  type GoalPlanResponse,
  type GoalResponse,
} from "@/app/api/goals/schemas";
import {
  netTargetAfterExisting,
  requiredLumpSumForFutureValue,
  requiredPaymentForFutureValue,
  yearFractionFromDates,
} from "@/lib/financial";

const contributionFrequencyToNPerYear = (
  frequency: GoalResponse["contributionFrequency"],
): 1 | 12 => (frequency === "monthly" ? 12 : 1);

const EPSILON = 1e-6;

interface MemberDetails {
  email?: string;
  name?: string | null;
}

export const buildGoalPlan = (
  goal: GoalResponse,
  memberDetails: Map<string, MemberDetails> | undefined = undefined,
): GoalPlanResponse => {
  const members: GoalPlanResponse["members"] = goal.members.map((member) => {
    const details = memberDetails?.get(member.userId);

    return {
      userId: member.userId,
      role: member.role,
      splitPercent: member.splitPercent,
      fixedAmount: member.fixedAmount,
      perPeriod: 0,
      email: details?.email,
      name: details?.name ?? null,
    } satisfies GoalPlanResponse["members"][number];
  });

  const now = new Date();
  const targetDate = new Date(goal.targetDate);
  const rawYears = yearFractionFromDates(now, targetDate);
  const tYears = Math.max(rawYears, 0);

  const compoundingNPerYear = contributionFrequencyToNPerYear(goal.compounding);
  const contributionNPerYear = contributionFrequencyToNPerYear(
    goal.contributionFrequency,
  );

  const netFutureValue = netTargetAfterExisting(
    goal.targetAmount,
    goal.existingSavings ?? 0,
    goal.expectedRate,
    compoundingNPerYear,
    tYears,
  );

  const totalPerPeriod = requiredPaymentForFutureValue(
    netFutureValue,
    goal.expectedRate,
    contributionNPerYear,
    tYears,
  );

  const lumpSumNow = requiredLumpSumForFutureValue(
    netFutureValue,
    goal.expectedRate,
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
    goal: {
      id: goal.id,
      title: goal.title,
      currency: goal.currency,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      expectedRate: goal.expectedRate,
      compounding: goal.compounding,
      contributionFrequency: goal.contributionFrequency,
      existingSavings: goal.existingSavings ?? 0,
      isShared: goal.isShared,
    },
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
      expectedRate: goal.expectedRate,
      compounding: goal.compounding,
      contributionFrequency: goal.contributionFrequency,
    },
  };

  if (warnings.length > 0) {
    plan.warnings = warnings;
  }

  return GoalPlanResponseSchema.parse(plan);
};
