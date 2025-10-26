import {
  InvitationDetailResponseSchema,
  InvitationListResponseSchema,
  InvitationStatusSchema,
  type InvitationDetailResponse,
  type InvitationListResponse,
  type InvitationStatus,
} from "@/app/api/invitations/schemas";
import { apiFetch } from "@/lib/http";

const INVITATIONS_BASE_PATH = "/api/invitations";

type InvitationStatusFilter = InvitationStatus | InvitationStatus[] | "all";

const buildStatusQuery = (status?: InvitationStatusFilter): string => {
  if (!status) {
    return "";
  }

  const params = new URLSearchParams();

  if (Array.isArray(status)) {
    status.forEach((value) => {
      if (InvitationStatusSchema.safeParse(value).success) {
        params.append("status", value);
      }
    });
  } else if (status === "all") {
    params.set("status", "all");
  } else if (InvitationStatusSchema.safeParse(status).success) {
    params.set("status", status);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

export const getInvitations = async (
  status?: InvitationStatusFilter,
  signal?: AbortSignal,
): Promise<InvitationListResponse> => {
  const query = buildStatusQuery(status);
  return apiFetch<InvitationListResponse>(`${INVITATIONS_BASE_PATH}${query}`, {
    method: "GET",
    schema: InvitationListResponseSchema,
    signal,
  });
};

export const getInvitation = async (
  invitationId: string,
  signal?: AbortSignal,
): Promise<InvitationDetailResponse> =>
  apiFetch<InvitationDetailResponse>(
    `${INVITATIONS_BASE_PATH}/${encodeURIComponent(invitationId)}`,
    {
      method: "GET",
      schema: InvitationDetailResponseSchema,
      signal,
    },
  );

export const respondToInvitation = async (
  invitationId: string,
  action: "accept" | "decline",
  signal?: AbortSignal,
): Promise<InvitationDetailResponse> =>
  apiFetch<InvitationDetailResponse>(
    `${INVITATIONS_BASE_PATH}/${encodeURIComponent(invitationId)}`,
    {
      method: "PATCH",
      body: { action },
      schema: InvitationDetailResponseSchema,
      signal,
    },
  );

export type { InvitationStatus } from "@/app/api/invitations/schemas";
export type { InvitationDetailResponse, InvitationListResponse } from "@/app/api/invitations/schemas";
