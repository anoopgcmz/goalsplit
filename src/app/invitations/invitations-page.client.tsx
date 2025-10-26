"use client";

import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { respondToInvitation, getInvitation } from "@/lib/api/invitations";
import { ApiError as HttpApiError } from "@/lib/http";

import { useInvitations } from "@/features/invitations/use-invitations";
import type { InvitationListItem } from "@/features/invitations/use-invitations";
import { formatCurrency, formatDateTime, formatRelativeTime } from "@/features/invitations/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

type InvitationStatusKey = keyof typeof STATUS_LABEL;

export function InvitationsPageClient(): JSX.Element {
  const { invitations, isLoading, error, refresh, setInvitations } = useInvitations({
    status: "all",
    pollIntervalMs: 120_000,
  });
  const { publish } = useToast();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<{
    loading: boolean;
    error: string | null;
    invitation: Awaited<ReturnType<typeof getInvitation>> | null;
  }>({ loading: false, error: null, invitation: null });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const grouped = useMemo<Record<InvitationStatusKey, InvitationListItem[]>>(() => {
    return invitations.reduce(
      (acc, invitation) => {
        if (invitation.status === "accepted") {
          acc.accepted.push(invitation);
        } else if (invitation.status === "declined") {
          acc.declined.push(invitation);
        } else if (invitation.status === "expired") {
          acc.expired.push(invitation);
        } else {
          acc.pending.push(invitation);
        }
        return acc;
      },
      {
        pending: [] as InvitationListItem[],
        accepted: [] as InvitationListItem[],
        declined: [] as InvitationListItem[],
        expired: [] as InvitationListItem[],
      },
    );
  }, [invitations]);

  const handleViewDetails = useCallback(
    async (invitationId: string) => {
      setDetailId(invitationId);
      setDetailOpen(true);
      setDetailState({ loading: true, error: null, invitation: null });
      try {
        const response = await getInvitation(invitationId);
        setDetailState({ loading: false, error: null, invitation: response });
      } catch (err) {
        if (err instanceof HttpApiError) {
          setDetailState({ loading: false, error: err.message, invitation: null });
        } else if (err instanceof Error) {
          setDetailState({ loading: false, error: err.message, invitation: null });
        } else {
          setDetailState({ loading: false, error: "We couldn’t load that invitation.", invitation: null });
        }
      }
    },
    [],
  );

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailId(null);
    setDetailState({ loading: false, error: null, invitation: null });
  }, []);

  const handleAction = useCallback(
    async (invitationId: string, action: "accept" | "decline") => {
      setActionLoading(`${invitationId}:${action}`);
      try {
        const response = await respondToInvitation(invitationId, action);
        setInvitations((prev) =>
          prev.map((invite) =>
            invite.id === invitationId
              ? {
                  ...invite,
                  status: response.invitation.status,
                  respondedAt: response.invitation.respondedAt,
                  createdAt: response.invitation.createdAt,
                }
              : invite,
          ),
        );
        publish({
          title: action === "accept" ? "Invitation accepted" : "Invitation declined",
          description:
            action === "accept"
              ? `You’re now collaborating on “${response.invitation.goalTitle}”.`
              : `We’ll keep “${response.invitation.goalTitle}” out of your pending list.`,
          variant: "success",
        });
        if (detailId === invitationId) {
          setDetailState({ loading: false, error: null, invitation: response });
        }
        void refresh();
      } catch (err) {
        let message: string | undefined;
        if (err instanceof HttpApiError || err instanceof Error) {
          message = err.message;
        }
        publish({
          title: "Action failed",
          description: message ?? "We couldn’t update that invitation. Please try again.",
          variant: "error",
        });
      } finally {
        setActionLoading(null);
      }
    },
    [publish, refresh, setInvitations, detailId],
  );

  const renderInvitationCard = useCallback(
    (invitation: InvitationListItem, status: InvitationStatusKey) => {
      const inviterDisplay = invitation.inviterName?.trim().length
        ? invitation.inviterName
        : invitation.inviterEmail ?? "A collaborator";
      const isPending = status === "pending";
      const actionKeyAccept = `${invitation.id}:accept`;
      const actionKeyDecline = `${invitation.id}:decline`;
      const isActing = actionLoading?.startsWith(invitation.id) ?? false;
      const badgeVariant = status === "accepted" ? "success" : status === "pending" ? "info" : "neutral";

      return (
        <li key={invitation.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">{invitation.goalTitle}</h3>
            <Badge variant={badgeVariant}>{STATUS_LABEL[status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Invited by {inviterDisplay} • {formatRelativeTime(invitation.createdAt)}
          </p>
          {invitation.message ? (
            <p className="mt-3 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700">“{invitation.message}”</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>Sent to {invitation.inviteeEmail}</span>
            <span>
              {status === "expired"
                ? `Expired ${formatRelativeTime(invitation.expiresAt)}`
                : `Expires ${formatRelativeTime(invitation.expiresAt)}`}
            </span>
            {invitation.respondedAt ? (
              <span>
                {status === "accepted"
                  ? `Accepted ${formatRelativeTime(invitation.respondedAt)}`
                  : status === "declined"
                  ? `Declined ${formatRelativeTime(invitation.respondedAt)}`
                  : status === "expired"
                  ? `Expired ${formatRelativeTime(invitation.respondedAt)}`
                  : null}
              </span>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void handleViewDetails(invitation.id);
              }}
            >
              View details
            </Button>
            {isPending ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void handleAction(invitation.id, "accept");
                  }}
                  disabled={isActing}
                >
                  {actionLoading === actionKeyAccept ? "Joining…" : "Accept"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void handleAction(invitation.id, "decline");
                  }}
                  disabled={isActing}
                >
                  {actionLoading === actionKeyDecline ? "Declining…" : "Decline"}
                </Button>
              </>
            ) : null}
          </div>
        </li>
      );
    },
    [actionLoading, handleAction, handleViewDetails],
  );

  const buildTabContent = (status: InvitationStatusKey) => {
    const items = grouped[status];
    if (isLoading && invitations.length === 0) {
      return <p className="py-6 text-sm text-slate-500">Loading invitations…</p>;
    }
    if (items.length === 0) {
      return <p className="py-6 text-sm text-slate-500">No {STATUS_LABEL[status].toLowerCase()} invitations yet.</p>;
    }
    return <ul className="space-y-4">{items.map((invitation) => renderInvitationCard(invitation, status))}</ul>;
  };

  const statusOrder: InvitationStatusKey[] = ["pending", "accepted", "declined", "expired"];

  const tabs = statusOrder.map((status) => ({
    id: status,
    label: `${STATUS_LABEL[status]} (${grouped[status].length})`,
    content: buildTabContent(status),
  }));

  const detail = detailState.invitation;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invitations</h1>
          <p className="text-sm text-slate-600">Manage collaboration requests for your shared goals.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={isLoading && invitations.length === 0}>
          Refresh
        </Button>
      </div>
      {error ? (
        <ErrorState
          title="We couldn’t load invitations"
          message={error}
          retryLabel="Try again"
          onRetry={() => void refresh()}
        />
      ) : (
        <Tabs tabs={tabs} />
      )}
      <Dialog
        open={detailOpen}
        onClose={closeDetail}
        title={detail?.invitation.goalTitle ?? "Invitation details"}
        description={
          detail
            ? `Invited by ${detail.invitation.inviterName ?? detail.invitation.inviterEmail ?? "a collaborator"}`
            : undefined
        }
        footer={
          detail?.invitation.status === "pending"
            ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => detailId && void handleAction(detailId, "decline")}
                    disabled={actionLoading?.startsWith(detailId ?? "") ?? false}
                  >
                    {actionLoading === `${detailId}:decline` ? "Declining…" : "Decline"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => detailId && void handleAction(detailId, "accept")}
                    disabled={actionLoading?.startsWith(detailId ?? "") ?? false}
                  >
                    {actionLoading === `${detailId}:accept` ? "Joining…" : "Accept"}
                  </Button>
                </>
              )
            : undefined
        }
      >
        {detailState.loading ? (
          <p className="py-4 text-sm text-slate-500">Loading invitation…</p>
        ) : detailState.error ? (
          <p className="py-4 text-sm text-rose-600">{detailState.error}</p>
        ) : detail ? (
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-semibold text-slate-900">Summary</p>
              <ul className="mt-1 space-y-1">
                <li>Sent {formatRelativeTime(detail.invitation.createdAt)}</li>
                <li>Expires {formatRelativeTime(detail.invitation.expiresAt)}</li>
                <li>Invitee {detail.invitation.inviteeEmail}</li>
              </ul>
            </div>
            {detail.invitation.message ? (
              <div>
                <p className="font-semibold text-slate-900">Message</p>
                <p className="mt-1 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700">“{detail.invitation.message}”</p>
              </div>
            ) : null}
            {detail.goal ? (
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">Goal preview</p>
                <ul className="text-sm text-slate-600">
                  <li>Owner: {detail.goal.ownerName ?? "Goal owner"}</li>
                  <li>Target amount: {formatCurrency(detail.goal.targetAmount, detail.goal.currency)}</li>
                  <li>Target date: {formatDateTime(detail.goal.targetDate)}</li>
                  <li>Expected return: {detail.goal.expectedRate}%</li>
                </ul>
                <p className="text-xs text-slate-500">Accepting lets you collaborate on this goal.</p>
              </div>
            ) : null}
            {detail.invitation.status !== "pending" ? (
              <p className="text-sm font-semibold text-emerald-600">
                This invitation is {detail.invitation.status.charAt(0).toUpperCase() + detail.invitation.status.slice(1)}.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="py-4 text-sm text-slate-500">Select an invitation to see more details.</p>
        )}
      </Dialog>
    </div>
  );
}
