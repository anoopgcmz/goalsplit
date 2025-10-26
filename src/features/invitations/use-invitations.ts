import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getInvitations,
  type InvitationDetailResponse,
  type InvitationListResponse,
  type InvitationStatus,
} from "@/lib/api/invitations";
import { ApiError as HttpApiError } from "@/lib/http";

interface UseInvitationsOptions {
  status?: InvitationStatus | InvitationStatus[] | "all";
  pollIntervalMs?: number;
  autoStart?: boolean;
}

interface UseInvitationsState {
  invitations: InvitationListResponse["invitations"];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setInvitations: (
    updater:
      | InvitationListResponse["invitations"]
      | ((prev: InvitationListResponse["invitations"]) => InvitationListResponse["invitations"]),
  ) => void;
  status: "idle" | "loading" | "error" | "ready";
}

const DEFAULT_POLL_INTERVAL = 60_000;

export function useInvitations(options: UseInvitationsOptions = {}): UseInvitationsState {
  const { status: statusFilter, pollIntervalMs = DEFAULT_POLL_INTERVAL, autoStart = true } = options;
  const [invitations, setInvitationList] = useState<InvitationListResponse["invitations"]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setStatus((prev) => (prev === "ready" ? prev : "loading"));
        setError(null);
        const response = await getInvitations(statusFilter, signal);
        if (signal?.aborted) {
          return;
        }
        if (!mountedRef.current) {
          return;
        }
        setInvitationList(response.invitations);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (signal?.aborted) {
          return;
        }
        if (!mountedRef.current) {
          return;
        }
        if (err instanceof HttpApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("We couldn’t load invitations.");
        }
        setStatus("error");
      }
    },
    [statusFilter],
  );

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    await load(controller.signal);
  }, [load]);

  useEffect(() => {
    if (!autoStart) {
      return;
    }

    void refresh();

    if (pollIntervalMs <= 0) {
      return;
    }

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    pollTimerRef.current = setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [pollIntervalMs, refresh, autoStart]);

  const value = useMemo<UseInvitationsState>(
    () => ({
      invitations,
      isLoading: status === "loading" && invitations.length === 0,
      error,
      refresh,
      setInvitations: (updater) => {
        setInvitationList((prev) =>
          typeof updater === "function"
            ? (updater as (value: InvitationListResponse["invitations"]) => InvitationListResponse["invitations"])(prev)
            : updater,
        );
      },
      status,
    }),
    [invitations, status, error, refresh],
  );

  return value;
}

export type InvitationListItem = InvitationListResponse["invitations"][number];
export type InvitationDetail = InvitationDetailResponse;
export type InvitationStatusFilter = InvitationStatus | InvitationStatus[] | "all";
