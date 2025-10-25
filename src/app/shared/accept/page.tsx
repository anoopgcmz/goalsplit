"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useToast } from "@/components/ui/toast";

interface ApiErrorResponse {
  error: {
    message: string;
    hint?: string;
  };
}

interface InvitePreview {
  goalId: string;
  goalTitle: string;
  inviterName: string | null;
  inviterEmail: string | null;
  inviteeEmail: string;
  defaultSplitPercent: number | null;
  fixedAmount: number | null;
  currency: string;
  expiresAt: string;
}

interface InvitePreviewResponse {
  invite: InvitePreview;
}

interface GoalSummary {
  id: string;
  title: string;
}

interface AcceptInviteResponse {
  goal: GoalSummary;
}

type ViewState = "loading" | "valid" | "invalid" | "accepted";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

type AcceptStatus = "idle" | "loading" | "error";

const AUTO_JOIN_STORAGE_KEY = "sharedAccept:autoJoin";

const formatCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    return value.toFixed(2);
  }
};

const getShareDescription = (invite: InvitePreview) => {
  if (invite.fixedAmount != null) {
    return `Fixed contribution: ${formatCurrency(invite.fixedAmount, invite.currency)}`;
  }

  if (invite.defaultSplitPercent != null) {
    const wholeNumber = Number.isInteger(invite.defaultSplitPercent);
    const formattedPercent = wholeNumber
      ? invite.defaultSplitPercent.toFixed(0)
      : invite.defaultSplitPercent.toFixed(1);
    return `Proposed split: ${formattedPercent}% of contributions`;
  }

  return "Contribution details will be shared after you join.";
};

export default function SharedAcceptPage(): JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const { publish } = useToast();

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [acceptStatus, setAcceptStatus] = useState<AcceptStatus>("idle");
  const [acceptError, setAcceptError] = useState("");
  const [acceptedGoal, setAcceptedGoal] = useState<GoalSummary | null>(null);
  const [autoJoinState, setAutoJoinState] = useState<"idle" | "pending" | "completed">("idle");
  const inviteAbortRef = useRef<AbortController | null>(null);

  const loginHref = useMemo(() => {
    if (!token) {
      return "/login";
    }

    const nextPath = `/shared/accept?token=${token}`;
    return `/login?next=${encodeURIComponent(nextPath)}`;
  }, [token]);

  const loadInvite = useCallback(async () => {
    inviteAbortRef.current?.abort();
    inviteAbortRef.current = null;

    if (!token) {
      setViewState("invalid");
      setInvite(null);
      setStatusMessage("This invitation link is missing information. Ask the goal owner to send a new invite.");
      return;
    }

    const controller = new AbortController();
    inviteAbortRef.current = controller;

    setViewState("loading");
    setInvite(null);
    setStatusMessage("");

    try {
      const response = await fetch(`/api/shared/accept?token=${encodeURIComponent(token)}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        credentials: "include",
      });

      if (!response.ok) {
        let fallbackMessage = "We couldn’t verify that invitation. Request a new invite from the goal owner.";
        try {
          const payload = (await response.json()) as ApiErrorResponse;
          fallbackMessage = payload.error.message;
        } catch {
          // Ignore JSON parse errors; fall back to default copy.
        }

        if (!controller.signal.aborted) {
          setStatusMessage(fallbackMessage);
          setViewState("invalid");
        }
        return;
      }

      const data = (await response.json()) as InvitePreviewResponse;
      if (controller.signal.aborted) {
        return;
      }

      setInvite(data.invite);
      setViewState("valid");
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") {
        return;
      }

      if (!controller.signal.aborted) {
        setStatusMessage("We ran into a network issue while checking your invitation. Please refresh and try again.");
        setViewState("invalid");
      }
    } finally {
      if (!controller.signal.aborted) {
        inviteAbortRef.current = null;
      }
    }
  }, [token]);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const response = await fetch("/api/me", {
          headers: { Accept: "application/json" },
          credentials: "include",
        });

        if (!isMounted) {
          return;
        }

        if (response.ok) {
          setAuthStatus("authenticated");
          return;
        }

        if (response.status === 401) {
          setAuthStatus("unauthenticated");
          return;
        }

        setAuthStatus("unauthenticated");
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setAuthStatus("unauthenticated");
      }
    };

    void checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void loadInvite();

    return () => {
      inviteAbortRef.current?.abort();
    };
  }, [loadInvite]);

  useEffect(() => {
    if (typeof window === "undefined" || !token || autoJoinState !== "idle") {
      return;
    }

    const storedToken = window.sessionStorage.getItem(AUTO_JOIN_STORAGE_KEY);

    if (storedToken === token) {
      setAutoJoinState("pending");
    }
  }, [token, autoJoinState]);

  useEffect(() => {
    if (
      autoJoinState !== "pending" ||
      authStatus !== "authenticated" ||
      viewState !== "valid" ||
      !invite ||
      acceptStatus === "loading"
    ) {
      return;
    }

    void handleJoinGoal();
  }, [autoJoinState, authStatus, viewState, invite, acceptStatus, handleJoinGoal]);

  useEffect(() => {
    if (viewState !== "invalid" || typeof window === "undefined") {
      return;
    }

    window.sessionStorage.removeItem(AUTO_JOIN_STORAGE_KEY);
    setAutoJoinState("completed");
  }, [viewState]);

  const handleJoinGoal = useCallback(async () => {
    if (!token || !invite || acceptStatus === "loading") {
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(AUTO_JOIN_STORAGE_KEY);
    }

    setAutoJoinState("completed");
    setAcceptStatus("loading");
    setAcceptError("");

    try {
      const response = await fetch("/api/shared/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ token }),
        credentials: "include",
      });

      if (!response.ok) {
        let fallbackMessage = "We couldn’t join that goal. Please try again.";
        try {
          const payload = (await response.json()) as ApiErrorResponse;
          fallbackMessage = payload.error.message;
        } catch (error) {
          // Ignore JSON parse issues.
        }
        setAcceptError(fallbackMessage);
        setAcceptStatus("error");
        publish({
          title: "Join failed",
          description: fallbackMessage,
          variant: "error",
        });
        return;
      }

      const payload = (await response.json()) as AcceptInviteResponse;
      setAcceptedGoal({ id: payload.goal.id, title: payload.goal.title });
      setViewState("accepted");
      setAcceptStatus("idle");
      setAcceptError("");
      publish({
        title: "Joined goal",
        description: `You’re now collaborating on “${payload.goal.title}”.`,
        variant: "success",
      });
      router.replace(`/goals/${payload.goal.id}`);
      router.refresh();
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") {
        return;
      }
      setAcceptError("Something went wrong while joining. Check your connection and try again.");
      setAcceptStatus("error");
      publish({
        title: "Join failed",
        description: "Something went wrong while joining. Check your connection and try again.",
        variant: "error",
      });
    }
  }, [token, invite, acceptStatus, publish, router]);

  const handleLogin = () => {
    if (token && typeof window !== "undefined") {
      window.sessionStorage.setItem(AUTO_JOIN_STORAGE_KEY, token);
      setAutoJoinState("pending");
    }
    router.push(loginHref);
  };

  const handleViewGoal = () => {
    if (acceptedGoal) {
      router.push(`/goals/${acceptedGoal.id}`);
    }
  };

  const handleRequestNewInvite = () => {
    const subject = "Request a new GoalSplit invite";
    const body = invite?.goalTitle
      ? `Hi,\n\nCould you send me a fresh invite for \"${invite.goalTitle}\"?\n\nThanks!`
      : "Hi,\n\nCould you send me a new GoalSplit invite link?\n\nThanks!";

    const email = invite?.inviterEmail ?? "";
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const inviterDisplayName = invite?.inviterName?.trim().length
    ? invite.inviterName
    : invite?.inviterEmail ?? "";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-8">
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-lg font-semibold text-white shadow-md">
            GP
          </span>
          <h1 className="text-2xl font-semibold text-slate-900">Accept shared goal invite</h1>
          <p className="max-w-xl text-sm text-slate-600" aria-live="polite">
            {viewState === "loading"
              ? "Checking your invitation…"
              : viewState === "accepted"
              ? "You’re now collaborating on this goal."
              : "Review the details below to join this shared goal."}
          </p>
        </div>

        {viewState === "loading" ? (
          <div className="mx-auto w-full max-w-xl space-y-4" aria-busy="true">
            <CardSkeleton headerLines={2} bodyLines={3} />
          </div>
        ) : null}

        {viewState === "invalid" ? (
          <div className="mx-auto w-full max-w-xl space-y-4">
            <ErrorState
              title="We couldn’t use that invite"
              description={statusMessage}
              retryLabel={token ? "Try again" : undefined}
              onRetry={token ? () => { void loadInvite(); } : undefined}
            />
            <div className="flex flex-col items-stretch gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>We can send you a fresh link if it expired.</span>
              <Button type="button" variant="secondary" onClick={handleRequestNewInvite}>
                Request a new invite
              </Button>
            </div>
          </div>
        ) : null}

        {viewState === "valid" && invite ? (
          <Card className="mx-auto w-full max-w-xl">
            <CardHeader className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">Join “{invite.goalTitle}”</h2>
              <p className="text-sm text-slate-600">Invited by {inviterDisplayName}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-left">
                <dl className="space-y-2 text-sm text-slate-600">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="font-medium text-slate-700">Invitation for</dt>
                    <dd className="text-slate-900">{invite.inviteeEmail}</dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="font-medium text-slate-700">Contribution</dt>
                    <dd className="text-slate-900">{getShareDescription(invite)}</dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="font-medium text-slate-700">Expires</dt>
                    <dd className="text-slate-900">{new Date(invite.expiresAt).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
              <p className="rounded-2xl bg-primary-50 p-3 text-sm text-primary-900">
                You’ll be able to view and contribute to this goal. You can’t see other private goals.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1 text-sm text-slate-600">
                {authStatus === "unauthenticated" ? (
                  <span>Log in to continue.</span>
                ) : authStatus === "checking" ? (
                  <span>Checking your account status…</span>
                ) : (
                  <span>Ready when you are.</span>
                )}
                {acceptError ? (
                  <span className="text-rose-600" role="alert">
                    {acceptError}
                  </span>
                ) : null}
              </div>
              {authStatus === "authenticated" ? (
                <Button
                  type="button"
                  onClick={() => {
                    void handleJoinGoal();
                  }}
                  disabled={acceptStatus === "loading"}
                >
                  {acceptStatus === "loading" ? "Joining…" : "Join goal"}
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={handleLogin}>
                  Log in to continue
                </Button>
              )}
            </CardFooter>
          </Card>
        ) : null}

        {viewState === "accepted" && acceptedGoal ? (
          <Card className="mx-auto w-full max-w-xl" role="status" aria-live="polite">
            <CardHeader className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">You’re all set</h2>
              <p className="text-sm text-slate-600">
                You’re now collaborating on “{acceptedGoal.title}”. You can review the goal details and adjust your preferences at
                any time.
              </p>
            </CardHeader>
            <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-600">We’ll take you to the shared plan.</span>
              <Button type="button" onClick={handleViewGoal}>
                View goal
              </Button>
            </CardFooter>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
