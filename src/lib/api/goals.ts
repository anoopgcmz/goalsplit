import {
  GoalListResponseSchema,
  GoalPlanResponseSchema,
  GoalResponseSchema,
  type CreateGoalInput,
  type GoalListQuery,
  type GoalListResponse,
  type GoalPlanResponse,
  type GoalResponse,
  type UpdateGoalInput,
} from "@/app/api/goals/schemas";
import { apiFetch } from "@/lib/http";
import { buildGoalSummary, type GoalSummary } from "@/lib/goals/summary";

export type { GoalSummary } from "@/lib/goals/summary";

const GOALS_BASE_PATH = "/api/goals";

const DEFAULT_SUMMARY_QUERY: GoalListQuery = {
  page: 1,
  pageSize: 50,
  sortBy: "targetDate",
  sortOrder: "asc",
};

type GoalMemberRole = GoalResponse["members"][number]["role"];

interface MemberContribution {
  userId: string;
  role: GoalMemberRole;
  splitPercent?: number | null;
  fixedAmount?: number | null;
}

export interface UpdateGoalMembersInput {
  members: MemberContribution[];
}

export interface InviteCollaboratorInput {
  email: string;
  defaultSplitPercent?: number;
  fixedAmount?: number | null;
}

function buildQueryString(query?: Partial<GoalListQuery>): string {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();

  if (query.page != null) {
    params.set("page", String(query.page));
  }

  if (query.pageSize != null) {
    params.set("pageSize", String(query.pageSize));
  }

  if (query.sortBy) {
    params.set("sortBy", query.sortBy);
  }

  if (query.sortOrder) {
    params.set("sortOrder", query.sortOrder);
  }

  const search = params.toString();
  return search ? `?${search}` : "";
}

export const getGoals = async (
  query?: Partial<GoalListQuery>,
  signal?: AbortSignal,
): Promise<GoalListResponse> => {
  const queryString = buildQueryString(query);
  return apiFetch<GoalListResponse>(`${GOALS_BASE_PATH}${queryString}`, {
    method: "GET",
    schema: GoalListResponseSchema,
    signal,
  });
};

export const getGoal = async (
  goalId: string,
  signal?: AbortSignal,
): Promise<GoalResponse> =>
  apiFetch<GoalResponse>(`${GOALS_BASE_PATH}/${encodeURIComponent(goalId)}`, {
    method: "GET",
    schema: GoalResponseSchema,
    signal,
  });

export const createGoal = async (
  input: CreateGoalInput,
  signal?: AbortSignal,
): Promise<GoalResponse> =>
  apiFetch<GoalResponse>(GOALS_BASE_PATH, {
    method: "POST",
    body: input,
    schema: GoalResponseSchema,
    signal,
  });

export const updateGoal = async (
  goalId: string,
  input: UpdateGoalInput,
  signal?: AbortSignal,
): Promise<GoalResponse> =>
  apiFetch<GoalResponse>(`${GOALS_BASE_PATH}/${encodeURIComponent(goalId)}`, {
    method: "PATCH",
    body: input,
    schema: GoalResponseSchema,
    signal,
  });

export const deleteGoal = async (
  goalId: string,
  signal?: AbortSignal,
): Promise<void> =>
  apiFetch<void>(`${GOALS_BASE_PATH}/${encodeURIComponent(goalId)}`, {
    method: "DELETE",
    signal,
  });

export const getPlan = async (
  goalId: string,
  signal?: AbortSignal,
): Promise<GoalPlanResponse> =>
  apiFetch<GoalPlanResponse>(
    `${GOALS_BASE_PATH}/${encodeURIComponent(goalId)}/plan`,
    {
      method: "GET",
      schema: GoalPlanResponseSchema,
      signal,
    },
  );

export const inviteCollaborator = async (
  goalId: string,
  input: InviteCollaboratorInput,
  signal?: AbortSignal,
): Promise<{ inviteUrl?: string }> =>
  apiFetch<{ inviteUrl?: string }>(
    `${GOALS_BASE_PATH}/${encodeURIComponent(goalId)}/invite`,
    {
      method: "POST",
      body: {
        email: input.email,
        defaultSplitPercent: input.defaultSplitPercent,
        fixedAmount: input.fixedAmount ?? null,
      },
      signal,
    },
  );

export const updateMembers = async (
  goalId: string,
  input: UpdateGoalMembersInput,
  signal?: AbortSignal,
): Promise<GoalResponse> =>
  apiFetch<GoalResponse>(
    `${GOALS_BASE_PATH}/${encodeURIComponent(goalId)}/members`,
    {
      method: "PATCH",
      body: {
        members: input.members.map((member) => ({
          ...member,
          splitPercent:
            member.splitPercent === undefined
              ? undefined
              : member.splitPercent ?? null,
          fixedAmount:
            member.fixedAmount === undefined
              ? undefined
              : member.fixedAmount ?? null,
        })),
      },
      schema: GoalResponseSchema,
      signal,
    },
  );

export const removeMember = async (
  goalId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<void> =>
  apiFetch<void>(
    `${GOALS_BASE_PATH}/${encodeURIComponent(goalId)}/members/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      signal,
    },
  );

export const fetchGoalSummaries = async (
  signal?: AbortSignal,
): Promise<GoalSummary[]> => {
  const response = await getGoals(DEFAULT_SUMMARY_QUERY, signal);
  return response.data.map((goal) => buildGoalSummary(goal));
};

export const fetchGoalPlan = getPlan;

export const sendGoalInvite = inviteCollaborator;
