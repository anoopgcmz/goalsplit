"use client";

import { useEffect, type JSX } from "react";

import { ErrorState } from "@/components/ui/error-state";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError(props: DashboardErrorProps): JSX.Element {
  const { error, reset } = props;
  const description = error.message?.trim().length
    ? error.message
    : "We hit a temporary issue while reaching the server.";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Dashboard</p>
        <h1 className="text-3xl font-semibold text-slate-900">We couldn&apos;t load your goals</h1>
        <p className="text-sm text-slate-600">
          Something went wrong while loading your dashboard data. Retry to refresh the page and try again.
        </p>
      </header>
      <ErrorState
        description={description}
        retryLabel="Retry"
        onRetry={reset}
      >
        <p>If the problem continues, check your connection or try again later.</p>
      </ErrorState>
    </div>
  );
}
