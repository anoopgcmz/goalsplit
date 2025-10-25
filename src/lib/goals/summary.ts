import type { GoalResponse } from "@/app/api/goals/schemas";
import {
  netTargetAfterExisting,
  requiredPaymentForFutureValue,
  yearFractionFromDates,
} from "@/lib/financial";

export interface GoalSummary {
  id: string;
  title: string;
  targetAmount: number;
  targetDate: string;
  contributionAmount: number;
  contributionLabel: string;
  collaborative: boolean;
  progress: number;
}

const contributionFrequencyToNPerYear = (
  frequency: GoalResponse["contributionFrequency"],
): 1 | 12 => (frequency === "monthly" ? 12 : 1);

const compoundingFrequencyToNPerYear = (
  frequency: GoalResponse["compounding"],
): 1 | 12 => (frequency === "monthly" ? 12 : 1);

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
};

export const buildGoalSummary = (goal: GoalResponse): GoalSummary => {
  const now = new Date();
  const targetDate = new Date(goal.targetDate);
  const years = Math.max(yearFractionFromDates(now, targetDate), 0);
  const contributionNPerYear = contributionFrequencyToNPerYear(
    goal.contributionFrequency,
  );
  const compoundingNPerYear = compoundingFrequencyToNPerYear(goal.compounding);
  const existing = goal.existingSavings ?? 0;
  const target = goal.targetAmount;

  const netTarget = netTargetAfterExisting(
    target,
    existing,
    goal.expectedRate,
    compoundingNPerYear,
    years,
  );
  const perPeriod = requiredPaymentForFutureValue(
    netTarget,
    goal.expectedRate,
    contributionNPerYear,
    years,
  );

  const contributionAmount = Number.isFinite(perPeriod)
    ? Math.max(perPeriod, 0)
    : 0;
  const contributionLabel =
    goal.contributionFrequency === "monthly" ? "per month" : "per year";

  const progress = target > 0 ? clampPercent(((existing ?? 0) / target) * 100) : 0;

  return {
    id: goal.id,
    title: goal.title,
    targetAmount: target,
    targetDate: goal.targetDate,
    contributionAmount,
    contributionLabel,
    collaborative: goal.isShared,
    progress: Math.round(progress),
  } satisfies GoalSummary;
};
