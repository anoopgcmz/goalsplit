import type { GoalPlanResponse, GoalResponse } from "@/app/api/goals/schemas";

import {
  netTargetAfterExisting,
  requiredLumpSumForFutureValue,
  requiredPaymentForFutureValue,
  yearFractionFromDates,
} from "@/lib/financial";

import { mockGoals, mockUsers } from "./data";
import { deepClone, simulateNetworkLatency } from "./helpers";

const EPSILON = 1e-6;

const contributionFrequencyToNPerYear = (frequency: "monthly" | "yearly"): 1 | 12 =>
  frequency === "monthly" ? 12 : 1;

const mockUserMap = new Map(mockUsers.map((user) => [user.id, user] as const));

const buildPlanForGoal = (goal: GoalResponse): GoalPlanResponse => {
  const now = new Date();
  const targetDate = new Date(goal.targetDate);
  const rawYears = yearFractionFromDates(now, targetDate);
  const tYears = Math.max(rawYears, 0);

  const compoundingNPerYear = contributionFrequencyToNPerYear(goal.compounding);
  const contributionNPerYear = contributionFrequencyToNPerYear(goal.contributionFrequency);
  const existingSavings = goal.existingSavings ?? 0;

  const netFutureValue = netTargetAfterExisting(
    goal.targetAmount,
    existingSavings,
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

  const members = goal.members.map((member) => {
    const details = mockUserMap.get(member.userId);

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

  const warnings: string[] = [];
  const isTotalFinite = Number.isFinite(totalPerPeriod);

  if (rawYears <= 0) {
    warnings.push(
      "Target date is in the past or today; recurring contributions may not be feasible.",
    );
  }

  if (!isTotalFinite) {
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

  if (isTotalFinite && remaining < -EPSILON) {
    warnings.push("Fixed contributions exceed the required per-period amount; review splits.");
    remaining = 0;
  }

  const percentEligible = members.filter((member) => member.fixedAmount == null);
  const percentSum = percentEligible.reduce((sum, member) => sum + (member.splitPercent ?? 0), 0);

  if (percentEligible.length > 0) {
    if (percentSum <= EPSILON) {
      if (!isTotalFinite || remaining > EPSILON) {
        warnings.push("Percentage allocations are missing; unable to distribute contributions.");
      }
    } else {
      if (Math.abs(percentSum - 100) > 0.5) {
        warnings.push("Split percentages do not sum to 100%; allocations normalised.");
      }

      percentEligible.forEach((member) => {
        const ratio = (member.splitPercent ?? 0) / percentSum;
        const contribution = isTotalFinite ? remaining * ratio : 0;
        member.perPeriod += contribution;
      });
    }
  } else if (!isTotalFinite || remaining > EPSILON) {
    warnings.push("No members available to receive the remaining contribution requirement.");
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
      existingSavings,
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

  return plan;
};

export interface GoalSummary {
  id: string;
  title: string;
  targetAmount: number;
  targetDate: string;
  monthlyRequired: number;
  collaborative: boolean;
  progress: number;
  contributionLabel: string;
  canManage?: boolean;
}

const GOAL_NOT_FOUND_ERROR = "We couldn't find that goal.";

const cloneGoal = (goal: GoalResponse): GoalResponse => ({
  ...goal,
  members: goal.members.map((member) => ({ ...member })),
});

export const mockGoalsAdapter = {
  async listGoals(signal?: AbortSignal): Promise<GoalResponse[]> {
    await simulateNetworkLatency(signal, 300);
    return mockGoals.map((goal) => cloneGoal(goal));
  },

  async listSummaries(signal?: AbortSignal): Promise<GoalSummary[]> {
    await simulateNetworkLatency(signal, 320);
    return mockGoals.map((goal) => {
      const plan = buildPlanForGoal(goal);
      const perPeriod = Number.isFinite(plan.totals.perPeriod) ? plan.totals.perPeriod : 0;
      const progress = goal.targetAmount > 0
        ? Math.min(Math.max(((goal.existingSavings ?? 0) / goal.targetAmount) * 100, 0), 100)
        : 0;

      return {
        id: goal.id,
        title: goal.title,
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        monthlyRequired: perPeriod,
        collaborative: goal.isShared,
        progress: Math.round(progress),
        contributionLabel:
          goal.contributionFrequency === "monthly" ? "per month" : "per year",
        canManage: goal.ownerId === mockUsers[0]?.id,
      } satisfies GoalSummary;
    });
  },

  async getGoal(goalId: string, signal?: AbortSignal): Promise<GoalResponse> {
    await simulateNetworkLatency(signal, 260);
    const goal = mockGoals.find((item) => item.id === goalId);

    if (!goal) {
      throw new Error(GOAL_NOT_FOUND_ERROR);
    }

    return cloneGoal(goal);
  },

  async getPlan(goalId: string, signal?: AbortSignal): Promise<GoalPlanResponse> {
    await simulateNetworkLatency(signal, 420);
    const goal = mockGoals.find((item) => item.id === goalId);

    if (!goal) {
      throw new Error(GOAL_NOT_FOUND_ERROR);
    }

    const plan = buildPlanForGoal(goal);
    return deepClone(plan);
  },

  async sendInvite(
    goalId: string,
    _input: { email: string; defaultSplitPercent?: number; fixedAmount?: number | null },
    signal?: AbortSignal,
  ): Promise<{ inviteUrl: string }> {
    await simulateNetworkLatency(signal, 380);

    const goal = mockGoals.find((item) => item.id === goalId);
    if (!goal) {
      throw new Error(GOAL_NOT_FOUND_ERROR);
    }

    const inviteUrl = `https://goalsplit.app/invite/${goalId}`;
    return { inviteUrl };
  },
};
