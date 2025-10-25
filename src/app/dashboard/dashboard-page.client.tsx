"use client";

import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useId,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { deleteGoal, type GoalSummary } from "@/lib/api/goals";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

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

interface GoalCardProps extends GoalSummary {
  onViewPlan: (goalId: string) => void;
  onEdit: (goalId: string) => void;
  onDelete: (goalId: string) => Promise<void> | void;
  isDeleting?: boolean;
}

function GoalCard(props: GoalCardProps): JSX.Element {
  const {
    id,
    title,
    targetAmount,
    targetDate,
    contributionAmount,
    collaborative,
    progress,
    contributionLabel,
    onViewPlan,
    onEdit,
    onDelete,
    isDeleting = false,
    canManage = true,
  } = props;
  const relativeDue = getRelativeDueLabel(targetDate);
  const formattedTargetDate = dateFormatter.format(new Date(targetDate));
  const cappedProgress = Math.min(Math.max(progress, 0), 100);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasAnimatedRef = useRef(prefersReducedMotion);
  const [animatedProgress, setAnimatedProgress] = useState(
    prefersReducedMotion ? cappedProgress : 0,
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuItemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const triggerId = useId();

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

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const isInMenu = menuRef.current?.contains(target) ?? false;
      const isInTrigger = triggerRef.current?.contains(target) ?? false;

      if (isInMenu || isInTrigger) {
        return;
      }

      setIsMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const firstItem = menuItemsRef.current[0];
    if (firstItem) {
      requestAnimationFrame(() => {
        firstItem.focus();
      });
    }
  }, [isMenuOpen]);

  const handleMenuToggle = () => {
    setIsMenuOpen((current) => !current);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const setMenuItemRef = (index: number) => (node: HTMLButtonElement | null) => {
    menuItemsRef.current[index] = node;
  };

  const focusMenuItem = (index: number) => {
    const items = menuItemsRef.current.filter(
      (item): item is HTMLButtonElement => Boolean(item),
    );

    if (items.length === 0) {
      return;
    }

    const nextIndex = (index + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsMenuOpen(true);
    }
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = menuItemsRef.current.filter(
      (item): item is HTMLButtonElement => Boolean(item),
    );

    if (items.length === 0) {
      return;
    }

    const activeElement = document.activeElement as HTMLButtonElement | null;
    const currentIndex = items.findIndex((item) => item === activeElement);

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
        focusMenuItem(nextIndex);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const previousIndex = currentIndex >= 0 ? currentIndex - 1 : items.length - 1;
        focusMenuItem(previousIndex);
        break;
      }
      case "Home": {
        event.preventDefault();
        focusMenuItem(0);
        break;
      }
      case "End": {
        event.preventDefault();
        focusMenuItem(items.length - 1);
        break;
      }
      case "Escape": {
        event.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
        break;
      }
      case "Tab": {
        closeMenu();
        break;
      }
      default:
        break;
    }
  };

  const handleViewPlanClick = () => {
    onViewPlan(id);
  };

  const handleEditClick = () => {
    closeMenu();
    onEdit(id);
  };

  const handleDeleteClick = () => {
    closeMenu();
    void onDelete(id);
  };

  return (
    <Card className="flex h-full flex-col gap-5" data-goal-id={id}>
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
        {canManage ? (
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              aria-haspopup="menu"
              aria-label="Goal actions"
              className="h-8 w-8 rounded-full p-0 text-lg text-slate-500 hover:text-slate-700"
              onClick={handleMenuToggle}
              onKeyDown={handleTriggerKeyDown}
              aria-expanded={isMenuOpen}
              aria-controls={menuId}
              id={triggerId}
              ref={triggerRef}
              disabled={isDeleting}
            >
              ⋯
            </Button>
            {isMenuOpen ? (
              <div
                id={menuId}
                role="menu"
                aria-labelledby={triggerId}
                ref={menuRef}
                className="absolute right-0 top-full z-10 mt-2 w-36 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600 shadow-lg focus:outline-none"
                onKeyDown={handleMenuKeyDown}
              >
                <button
                  type="button"
                  role="menuitem"
                  ref={setMenuItemRef(0)}
                  className="flex w-full items-center justify-start rounded-xl px-3 py-2 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  onClick={handleEditClick}
                  disabled={isDeleting}
                >
                  Edit
                </button>
                <button
                  type="button"
                  role="menuitem"
                  ref={setMenuItemRef(1)}
                  className="flex w-full items-center justify-start rounded-xl px-3 py-2 text-left text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:text-red-300"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
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
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={handleViewPlanClick}
          disabled={isDeleting}
        >
          View plan
        </Button>
      </div>
    </Card>
  );
}

interface DashboardPageProps {
  goals: GoalSummary[];
}

export default function DashboardPage(props: DashboardPageProps): JSX.Element {
  const { goals } = props;

  const router = useRouter();
  const { publish } = useToast();
  const [goalList, setGoalList] = useState<GoalSummary[]>(goals);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setGoalList(goals);
  }, [goals]);

  const totalContributionAmount = useMemo(
    () => goalList.reduce((sum, goal) => sum + goal.contributionAmount, 0),
    [goalList],
  );
  const nextDeadline = useMemo(() => getNextDeadline(goalList), [goalList]);
  const activeGoalCount = goalList.length;

  const deadlineLabel = nextDeadline
    ? `${dateFormatter.format(new Date(nextDeadline.targetDate))} • ${getRelativeDueLabel(nextDeadline.targetDate)}`
    : "No deadlines scheduled";

  const handleViewPlan = (goalId: string) => {
    router.push(`/goals/${encodeURIComponent(goalId)}`);
  };

  const handleEditGoal = (goalId: string) => {
    router.push(`/goals/${encodeURIComponent(goalId)}/edit`);
  };

  const handleDeleteGoal = async (goalId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this goal? This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    const previousGoals = [...goalList];
    const removedIndex = previousGoals.findIndex((goal) => goal.id === goalId);
    const removedGoal = removedIndex >= 0 ? previousGoals[removedIndex] : undefined;

    setDeletingIds((current) => {
      const next = new Set(current);
      next.add(goalId);
      return next;
    });

    setGoalList((current) => current.filter((goal) => goal.id !== goalId));

    try {
      await deleteGoal(goalId);
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(goalId);
        return next;
      });

      publish({
        title: "Goal deleted",
        description: "The goal was removed from your dashboard.",
        variant: "success",
      });

      router.refresh();
    } catch (error) {
      console.error("Failed to delete goal", error);
      setGoalList((current) => {
        if (!removedGoal || current.some((goal) => goal.id === goalId)) {
          return current;
        }

        const next = [...current];
        const insertionIndex = removedIndex < 0 ? next.length : Math.min(removedIndex, next.length);
        next.splice(insertionIndex, 0, removedGoal);
        return next;
      });
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(goalId);
        return next;
      });

      const message =
        error instanceof Error
          ? error.message
          : "We couldn't delete the goal. Please try again.";

      publish({
        title: "Unable to delete goal",
        description: message,
        variant: "error",
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">My Goals</h1>
        <p className="text-sm text-slate-600">Track every target, how much to set aside, and when each plan will complete.</p>
      </header>

      <section aria-label="Summary" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
      </section>

      <section aria-labelledby="goal-list" className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 id="goal-list" className="text-xl font-semibold text-slate-900">
            Active plans
          </h2>
          <p className="text-sm text-slate-600">Compare what each commitment needs every month to stay on pace.</p>
        </div>

        {goalList.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {goalList.map((goal) => (
              <GoalCard
                key={goal.id}
                {...goal}
                onViewPlan={handleViewPlan}
                onEdit={handleEditGoal}
                onDelete={handleDeleteGoal}
                isDeleting={deletingIds.has(goal.id)}
              />
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
    </div>
  );
}
