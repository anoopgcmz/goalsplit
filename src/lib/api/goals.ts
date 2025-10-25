import type {
  GoalListResponse,
  GoalPlanResponse,
  GoalResponse,
} from "@/app/api/goals/schemas";
import {
  netTargetAfterExisting,
  requiredPaymentForFutureValue,
  yearFractionFromDates,
} from "@/lib/financial";

import { fetchJson } from "./request";

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

const contributionFrequencyToNPerYear = (frequency: GoalResponse["contributionFrequency"]): 1 | 12 =>
  frequency === "monthly" ? 12 : 1;

const compoundingFrequencyToNPerYear = (frequency: GoalResponse["compounding"]): 1 | 12 =>
  frequency === "monthly" ? 12 : 1;

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

const toSummary = (goal: GoalResponse): GoalSummary => {
  const now = new Date();
  const targetDate = new Date(goal.targetDate);
  const years = Math.max(yearFractionFromDates(now, targetDate), 0);
  const contributionNPerYear = contributionFrequencyToNPerYear(goal.contributionFrequency);
  const compoundingNPerYear = compoundingFrequencyToNPerYear(goal.compounding);
  const existing = goal.existingSavings ?? 0;
  const target = goal.targetAmount;

  const netTarget = netTargetAfterExisting(target, existing, goal.expectedRate, compoundingNPerYear, years);
  const perPeriod = requiredPaymentForFutureValue(
    netTarget,
    goal.expectedRate,
    contributionNPerYear,
    years,
  );

  const contributionAmount = Number.isFinite(perPeriod) ? Math.max(perPeriod, 0) : 0;
  const contributionLabel = goal.contributionFrequency === "monthly" ? "per month" : "per year";

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

export const fetchGoalSummaries = async (signal?: AbortSignal): Promise<GoalSummary[]> => {
  const payload = await fetchJson<GoalListResponse>(
    "/api/goals?page=1&pageSize=50&sortBy=targetDate&sortOrder=asc",
    {
      method: "GET",
      signal,
    },
  );

  return payload.data.map((goal) => toSummary(goal));
};

export const fetchGoalPlan = async (
  goalId: string,
  signal?: AbortSignal,
): Promise<GoalPlanResponse> =>
  fetchJson<GoalPlanResponse>(`/api/goals/${encodeURIComponent(goalId)}/plan`, {
    method: "GET",
    signal,
  });

export const sendGoalInvite = async (
  goalId: string,
  input: { email: string; defaultSplitPercent?: number; fixedAmount?: number | null },
  signal?: AbortSignal,
): Promise<{ inviteUrl?: string }> =>
  fetchJson<{ inviteUrl?: string }>(`/api/goals/${encodeURIComponent(goalId)}/invite`, {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      defaultSplitPercent: input.defaultSplitPercent,
      fixedAmount: input.fixedAmount ?? null,
    }),
    signal,
  });
