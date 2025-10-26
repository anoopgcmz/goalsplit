"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { respondToInvitation, getInvitation } from "@/lib/api/invitations";
import { ApiError as HttpApiError } from "@/lib/http";

import { useInvitations } from "./use-invitations";
import { formatCurrency, formatDateTime, formatRelativeTime } from "./utils";

interface InvitationDetailState {
  id: string;
  goalTitle: string;
  inviterName: string | null;
  inviterEmail: string | null;
  inviteeEmail: string;
  message: string | null;
  expiresAt: string;
  createdAt: string;
  status: string;
  goal?: {
    title: string;
    targetAmount: number;
    currency: string;
    targetDate: string;
    expectedRate: number;
    ownerName: string | null;
  } | null;
}

export function InvitationBell(): JSX.Element | null {
  const { invitations, isLoading, error, refresh, setInvitations } = useInvitations({
    status: "pending",
    pollIntervalMs: 30_000,
  });
  const pendingCount = invitations.length;
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<InvitationDetailState | null>(null);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "error">("idle");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const prevCountRef = useRef(pendingCount);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const { publish } = useToast();

  useEffect(() => {
    if (pendingCount > prevCountRef.current) {
      setLiveMessage(`You have ${pendingCount} pending invitation${pendingCount === 1 ? "" : "s"}.`);
    }
    prevCountRef.current = pendingCount;
  }, [pendingCount]);

  useEffect(() => {
    if (!liveMessage) {
      return;
    }
    const timeout = setTimeout(() => setLiveMessage(null), 5000);
    return () => clearTimeout(timeout);
  }, [liveMessage]);

  const closePanel = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      const clickedPanel = Boolean(panelRef.current?.contains(target));
      const clickedBell = Boolean(bellRef.current?.contains(target));
      if (clickedPanel || clickedBell) {
        return;
      }
      closePanel();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closePanel]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
    if (!open) {
      void refresh();
    }
  };

  const handleViewDetails = useCallback(async (invitationId: string) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailStatus("loading");
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    try {
      const response = await getInvitation(invitationId, controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      setDetail({
        id: response.invitation.id,
        goalTitle: response.invitation.goalTitle,
        inviterName: response.invitation.inviterName,
        inviterEmail: response.invitation.inviterEmail,
        inviteeEmail: response.invitation.inviteeEmail,
        message: response.invitation.message,
        expiresAt: response.invitation.expiresAt,
        createdAt: response.invitation.createdAt,
        status: response.invitation.status,
        goal: response.goal,
      });
      setDetailStatus("idle");
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      if (err instanceof HttpApiError) {
        setDetailError(err.message);
      } else if (err instanceof Error) {
        setDetailError(err.message);
      } else {
        setDetailError("We couldn’t load that invitation.");
      }
      setDetailStatus("error");
    }
  }, []);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
    setDetailError(null);
    detailAbortRef.current?.abort();
  };

  const removeFromList = useCallback(
    (invitationId: string) => {
      setInvitations((prev) => prev.filter((invite) => invite.id !== invitationId));
    },
    [setInvitations],
  );

  const handleAction = useCallback(
    async (invitationId: string, action: "accept" | "decline") => {
      setActionLoading(`${invitationId}:${action}`);
      try {
        const response = await respondToInvitation(invitationId, action);
        removeFromList(invitationId);
        publish({
        title: action === "accept" ? "Invitation accepted" : "Invitation declined",
        description:
          action === "accept"
            ? `You’re now collaborating on “${response.invitation.goalTitle}”.`
            : `We won’t show “${response.invitation.goalTitle}” in your invites anymore.`,
        variant: "success",
      });
      if (detail?.id === invitationId) {
        setDetail({
          id: response.invitation.id,
          goalTitle: response.invitation.goalTitle,
          inviterName: response.invitation.inviterName,
          inviterEmail: response.invitation.inviterEmail,
          inviteeEmail: response.invitation.inviteeEmail,
          message: response.invitation.message,
          expiresAt: response.invitation.expiresAt,
          createdAt: response.invitation.createdAt,
          status: response.invitation.status,
          goal: response.goal,
        });
      }
      void refresh();
    } catch (err) {
      if (err instanceof HttpApiError) {
        publish({ title: "Action failed", description: err.message, variant: "error" });
      } else if (err instanceof Error) {
        publish({ title: "Action failed", description: err.message, variant: "error" });
      } else {
        publish({
          title: "Action failed",
          description: "We couldn’t update that invitation. Please try again.",
          variant: "error",
        });
      }
    } finally {
      setActionLoading(null);
    }
  }, [publish, removeFromList, detail, refresh]);

  const panelContent = useMemo(() => {
    if (isLoading && invitations.length === 0) {
      return <p className="py-6 text-sm text-slate-500">Checking for invitations…</p>;
    }

    if (error) {
      return (
        <div className="space-y-2 py-4 text-sm text-rose-600">
          <p>{error}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      );
    }

    if (invitations.length === 0) {
      return <p className="py-6 text-sm text-slate-500">No pending invitations right now.</p>;
    }

    return (
      <ul className="flex flex-col gap-3">
        {invitations.map((invitation) => {
          const inviterDisplay = invitation.inviterName?.trim().length
            ? invitation.inviterName
            : invitation.inviterEmail ?? "Someone";
          return (
            <li key={invitation.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{invitation.goalTitle}</p>
                    <p className="text-xs text-slate-500">
                      Invited by {inviterDisplay} • {formatRelativeTime(invitation.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">{formatRelativeTime(invitation.expiresAt)} left</span>
                </div>
                {invitation.message ? (
                  <p className="line-clamp-2 text-sm text-slate-600">“{invitation.message}”</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
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
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleAction(invitation.id, "accept")}
                    disabled={actionLoading?.startsWith(invitation.id) ?? false}
                  >
                    {actionLoading === `${invitation.id}:accept` ? "Joining…" : "Accept"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleAction(invitation.id, "decline")}
                    disabled={actionLoading?.startsWith(invitation.id) ?? false}
                  >
                    {actionLoading === `${invitation.id}:decline` ? "Declining…" : "Decline"}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }, [invitations, isLoading, error, refresh, actionLoading, handleAction, handleViewDetails]);

  return (
    <div className="relative">
      <p aria-live="polite" className="sr-only">
        {liveMessage ?? ""}
      </p>
      <Button
        ref={bellRef}
        type="button"
        variant="ghost"
        className="relative px-2 py-2 text-slate-600"
        aria-expanded={open}
        aria-controls="invitation-panel"
        onClick={handleToggle}
      >
        <span aria-hidden="true" className="text-lg">
          🔔
        </span>
        <span className="sr-only">Notifications</span>
        {pendingCount > 0 ? (
          <span className="absolute -right-0 -top-0 inline-flex min-h-[1.25rem] min-w-[1.25rem] translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary-600 px-1 text-xs font-semibold text-white">
            {pendingCount}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div
          ref={panelRef}
          id="invitation-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Pending invitations"
          className="absolute right-0 z-40 mt-2 w-80 max-w-sm rounded-2xl border border-slate-200 bg-surface p-4 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Pending invitations</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto pr-1">{panelContent}</div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
            <Link href="/invitations" className="font-semibold text-primary-600 hover:underline">
              View all invitations
            </Link>
            <span>{pendingCount} pending</span>
          </div>
        </div>
      ) : null}
      <Dialog
        open={detailOpen}
        onClose={closeDetail}
        title={detail?.goalTitle ?? "Invitation details"}
        description={detail ? `Invited by ${detail.inviterName ?? detail.inviterEmail ?? "a collaborator"}` : undefined}
        footer={
          detail && detail.status === "pending"
            ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleAction(detail.id, "decline")}
                    disabled={Boolean(actionLoading?.startsWith(detail.id)) || detail.status !== "pending"}
                  >
                    {actionLoading === `${detail.id}:decline` ? "Declining…" : "Decline"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleAction(detail.id, "accept")}
                    disabled={Boolean(actionLoading?.startsWith(detail.id)) || detail.status !== "pending"}
                  >
                    {actionLoading === `${detail.id}:accept` ? "Joining…" : "Accept"}
                  </Button>
                </>
              )
            : undefined
        }
      >
        {detailStatus === "loading" ? (
          <p className="py-4 text-sm text-slate-500">Loading invitation…</p>
        ) : detailError ? (
          <p className="py-4 text-sm text-rose-600">{detailError}</p>
        ) : detail ? (
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-semibold text-slate-900">Summary</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-600">
                <li>Invited {formatRelativeTime(detail.createdAt)}</li>
                <li>Expires {formatRelativeTime(detail.expiresAt)}</li>
                <li>Sent to {detail.inviteeEmail}</li>
              </ul>
            </div>
            {detail.message ? (
              <div>
                <p className="font-semibold text-slate-900">Message</p>
                <p className="mt-1 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700">“{detail.message}”</p>
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
                <p className="text-xs text-slate-500">
                  Accepting gives you full access to this shared goal.
                </p>
              </div>
            ) : null}
            {detail.status !== "pending" ? (
              <p className="text-sm font-semibold text-emerald-600">
                This invitation is {detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="py-4 text-sm text-slate-500">Select an invitation to see details.</p>
        )}
      </Dialog>
    </div>
  );
}
