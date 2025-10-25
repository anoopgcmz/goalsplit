"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import type { GoalSummary } from "@/lib/goals/summary";
import { fetchGoalSummaries } from "@/lib/api/goals";
import { isApiError } from "@/lib/api/request";

const statusLabel = (goal: GoalSummary) => (goal.collaborative ? "Shared" : "Personal");

export default function GoalsPage(): JSX.Element {
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
      const payload = await fetchGoalSummaries(controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      setGoals(payload);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return;
      }

      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("We couldn’t load your goals. Please try again.");
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

  const groupedGoals = useMemo(() => ({
    active: goals,
  }), [goals]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    [],
  );

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Goals</h1>
        <p className="text-sm text-slate-600">Review every shared objective in one accessible list.</p>
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
      ) : null}

      <section aria-label="Active goals" className="grid gap-4">
        {isLoading ? (
          <CardSkeleton headerLines={2} bodyLines={4} />
        ) : groupedGoals.active.length > 0 ? (
          groupedGoals.active.map((goal) => (
            <Card key={goal.id}>
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">{goal.title}</h2>
                  <Badge variant="info">{statusLabel(goal)}</Badge>
                </div>
                <p className="text-sm text-slate-600">
                  Target {new Date(goal.targetDate).toLocaleDateString()} · {goal.progress}% funded
                </p>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Stay aligned with {goal.collaborative ? "your collaborators" : "your plan"} by contributing
                {" "}
                <span className="font-semibold">
                  {currencyFormatter.format(goal.contributionAmount)}
                </span>{" "}
                {goal.contributionLabel}.
              </CardContent>
            </Card>
          ))
        ) : (
          <EmptyState
            title="No active goals"
            description="Create a goal to start tracking progress and inviting collaborators."
          />
        )}
      </section>

      <section aria-label="Archived goals">
        <EmptyState
          title="No archived goals"
          description="When you finish a goal, we'll keep it here so you can look back."
        />
      </section>
    </div>
  );
}
