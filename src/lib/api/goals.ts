import type {
  CreateGoalInput,
  GoalListResponse,
  GoalPlanResponse,
  GoalResponse,
} from "@/app/api/goals/schemas";

import { fetchJson } from "./request";
import { buildGoalSummary, type GoalSummary } from "@/lib/goals/summary";

export type { GoalSummary } from "@/lib/goals/summary";

export const fetchGoalSummaries = async (signal?: AbortSignal): Promise<GoalSummary[]> => {
  const payload = await fetchJson<GoalListResponse>(
    "/api/goals?page=1&pageSize=50&sortBy=targetDate&sortOrder=asc",
    {
      method: "GET",
      signal,
    },
  );

  return payload.data.map((goal) => buildGoalSummary(goal));
};

export const fetchGoalPlan = async (
  goalId: string,
  signal?: AbortSignal,
): Promise<GoalPlanResponse> =>
  fetchJson<GoalPlanResponse>(`/api/goals/${encodeURIComponent(goalId)}/plan`, {
    method: "GET",
    signal,
  });

export const createGoal = async (
  input: CreateGoalInput,
  signal?: AbortSignal,
): Promise<GoalResponse> =>
  fetchJson<GoalResponse>("/api/goals", {
    method: "POST",
    body: JSON.stringify(input),
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
