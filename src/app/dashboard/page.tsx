"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { GoalSummary } from "@/lib/api/goals";
import { fetchGoalSummaries } from "@/lib/api/goals";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { isApiError } from "@/lib/api/request";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const SummarySkeleton = () => (
  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className={index === 0 ? "h-10 w-40" : "h-6 w-28"} />
      </div>
    ))}
  </div>
);

const GoalListSkeleton = () => (
  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 3 }).map((_, index) => (
      <CardSkeleton key={index} headerLines={2} bodyLines={4} />
    ))}
  </div>
);

function getRelativeDueLabel(targetDate: string): string {
  const date = new Date(targetDate);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const units: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
    { unit: "year", ms: 1000 * 60 * 60 * 24 * 365 },
    { unit: "month", ms: 1000 * 60 * 60 * 24 * 30 },
    { unit: "week", ms: 1000 * 60 * 60 * 24 * 7 },
    { unit: "day", ms: 1000 * 60 * 60 * 24 },
    { unit: "hour", ms: 1000 * 60 * 60 },
  ];

  for (const { unit, ms } of units) {
    const value = Math.round(diff / ms);
    if (Math.abs(value) >= 1) {
      return relativeTimeFormatter.format(value, unit);
    }
  }

  return relativeTimeFormatter.format(0, "day");
}

function getNextDeadline(goals: GoalSummary[]): GoalSummary | undefined {
  const now = new Date();
  const upcoming = goals.filter((goal) => new Date(goal.targetDate) >= now);
  const pool = upcoming.length > 0 ? upcoming : goals;

  if (pool.length === 0) {
    return undefined;
  }

  return pool.reduce((closest, goal) => {
    const currentDate = new Date(goal.targetDate);
    const closestDate = new Date(closest.targetDate);

    return currentDate < closestDate ? goal : closest;
  });
}

function GoalCard(props: GoalSummary): JSX.Element {
  const {
    title,
    targetAmount,
    targetDate,
    contributionAmount,
    collaborative,
    progress,
    contributionLabel,
  } = props;
  const relativeDue = getRelativeDueLabel(targetDate);
  const formattedTargetDate = dateFormatter.format(new Date(targetDate));
  const cappedProgress = Math.min(Math.max(progress, 0), 100);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasAnimatedRef = useRef(prefersReducedMotion);
  const [animatedProgress, setAnimatedProgress] = useState(
    prefersReducedMotion ? cappedProgress : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setAnimatedProgress(cappedProgress);
      hasAnimatedRef.current = true;
      return;
    }

    if (!hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      const raf = requestAnimationFrame(() => {
        setAnimatedProgress(cappedProgress);
      });

      return () => cancelAnimationFrame(raf);
    }

    setAnimatedProgress(cappedProgress);
    return undefined;
  }, [cappedProgress, prefersReducedMotion]);

  return (
    <Card className="flex h-full flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-2 text-lg font-semibold text-slate-900">{title}</h3>
            {collaborative ? <Badge variant="info">Shared</Badge> : null}
          </div>
          <p className="text-sm text-slate-600">
            Due {relativeDue} <span className="text-slate-400">•</span> {formattedTargetDate}
          </p>
        </div>
        <div className="relative group">
          <Button
            type="button"
            variant="ghost"
            aria-haspopup="menu"
            aria-label="Goal actions"
            className="h-8 w-8 rounded-full p-0 text-lg text-slate-500 hover:text-slate-700"
          >
            ⋯
          </Button>
          <div
            role="menu"
            className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-36 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600 shadow-lg opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
          >
            <button type="button" role="menuitem" className="flex w-full items-center justify-start rounded-xl px-3 py-2 hover:bg-slate-100">
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center justify-start rounded-xl px-3 py-2 text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">Target amount</dt>
          <dd className="text-base font-semibold text-slate-900">{currencyFormatter.format(targetAmount)}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">On-track pace</dt>
          <dd className="text-base font-semibold text-slate-900">
            {currencyFormatter.format(contributionAmount)}
            <span className="ml-1 text-sm font-normal text-slate-600">{contributionLabel}</span>
          </dd>
        </div>
      </dl>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-slate-600">
          <span>Progress</span>
          <span>{cappedProgress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-primary-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${animatedProgress}%` }}
            aria-hidden="true"
          />
        </div>
        <span className="sr-only">Goal is {cappedProgress}% funded</span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" className="flex-1">
          View plan
        </Button>
      </div>
    </Card>
  );
}

export default function DashboardPage(): JSX.Element {
  const [goals, setGoals] = useState<GoalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadGoals = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchGoalSummaries(controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      setGoals(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return;
      }
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("We couldn't load your goals. Try again later.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void loadGoals();

    return () => {
      abortRef.current?.abort();
    };
  }, [loadGoals]);

  const totalContributionAmount = goals.reduce(
    (sum, goal) => sum + goal.contributionAmount,
    0,
  );
  const nextDeadline = getNextDeadline(goals);
  const activeGoalCount = goals.length;

  const deadlineLabel = isLoading
    ? "Loading…"
    : nextDeadline
    ? `${dateFormatter.format(new Date(nextDeadline.targetDate))} • ${getRelativeDueLabel(nextDeadline.targetDate)}`
    : "No deadlines scheduled";

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">My Goals</h1>
        <p className="text-sm text-slate-600">Track every target, how much to set aside, and when each plan will complete.</p>
      </header>

      {error ? (
        <ErrorState
          title="Unable to load goals"
          description={error}
          retryLabel="Retry"
          onRetry={() => {
            void loadGoals();
          }}
        />
      ) : (
        <>
          <section
            aria-label="Summary"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            aria-busy={isLoading}
          >
            {isLoading ? (
              <SummarySkeleton />
            ) : (
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">Total monthly required</p>
                  <p className="text-3xl font-semibold text-slate-900">
            {currencyFormatter.format(totalContributionAmount)}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-slate-500">Active goals</p>
                  <p className="text-lg font-semibold text-slate-900">{activeGoalCount}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-slate-500">Next deadline</p>
                  <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700">
                    {deadlineLabel}
                  </span>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="goal-list" className="space-y-4">
            <div className="flex flex-col gap-1">
              <h2 id="goal-list" className="text-xl font-semibold text-slate-900">
                Active plans
              </h2>
              <p className="text-sm text-slate-600">Compare what each commitment needs every month to stay on pace.</p>
            </div>

            {isLoading ? (
              <GoalListSkeleton />
            ) : goals.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {goals.map((goal) => (
                  <GoalCard key={goal.id} {...goal} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No goals yet"
                description="Create your first goal to see how much to save each month."
                actionLabel="Create your first goal"
                icon={
                  <svg aria-hidden="true" viewBox="0 0 120 80" className="h-20 w-28 text-slate-300" role="img">
                    <rect x="10" y="20" width="100" height="40" rx="12" className="fill-current opacity-30" />
                    <path d="M24 40h72" className="stroke-current" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
                    <path d="M60 24v32" className="stroke-current" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
                  </svg>
                }
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
