"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useToast } from "@/components/ui/toast";
import type { AuthUser } from "@/app/api/auth/schemas";
import {
  CreateGoalInviteInputSchema,
  UpdateGoalMembersInputSchema,
  type GoalPlanResponse,
} from "@/app/api/goals/schemas";
import {
  netTargetAfterExisting,
  requiredLumpSumForFutureValue,
  requiredPaymentForFutureValue,
} from "@/lib/financial";
import { useFormatters } from "@/lib/hooks/use-formatters";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import {
  fetchGoalPlan,
  removeMember as removeGoalMember,
  sendGoalInvite,
  updateMembers as updateGoalMembers,
} from "@/lib/api/goals";
import { getCurrentUser } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/request";
import { ApiError as HttpApiError } from "@/lib/http";
import { normalizeZodIssues } from "@/lib/validation/zod";

type ContributionFrequency = GoalPlanResponse["assumptions"]["contributionFrequency"];
type CompoundingFrequency = GoalPlanResponse["assumptions"]["compounding"];

interface GoalPlanPageProps {
  goalId: string;
  initialPlan?: GoalPlanResponse | null;
  initialUser?: AuthUser | null;
}

interface ProjectionPoint {
  period: number;
  total: number;
  contributions: number;
  growth: number;
}

interface ScenarioProjection {
  perPeriod: number;
  lumpSum: number;
  contributionsTotal: number;
  growthTotal: number;
  contributionPercent: number;
  growthPercent: number;
  periodCount: number;
  targetDate: Date;
  points: ProjectionPoint[];
  years: number;
  months: number;
}

interface ScenarioOptions {
  ratePercent?: number;
  timelineOffsetMonths?: number;
}

interface ScenarioMetrics extends ScenarioProjection {
  ratePercent: number;
}

const frequencyToLabel = (frequency: ContributionFrequency) =>
  frequency === "monthly" ? "month" : "year";

const contributionFrequencyToNPerYear = (frequency: ContributionFrequency) =>
  frequency === "monthly" ? 12 : 1;

const compoundingFrequencyToNPerYear = (frequency: CompoundingFrequency) =>
  frequency === "monthly" ? 12 : 1;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const addMonths = (date: Date, months: number) => {
  const newDate = new Date(date.getTime());
  const desiredMonth = newDate.getMonth() + months;
  newDate.setMonth(desiredMonth);
  return newDate;
};

const deriveHorizonBreakdown = (totalPeriods: number, nPerYear: number) => {
  const totalMonths = (totalPeriods / nPerYear) * 12;
  const clampedMonths = Math.max(totalMonths, 0);
  let years = Math.floor(clampedMonths / 12);
  let months = Math.round(clampedMonths - years * 12);

  if (months === 12) {
    years += 1;
    months = 0;
  }

  return { years, months };
};

const roundCurrency = (value: number) =>
  Number.isFinite(value) ? Math.max(value, 0) : 0;

const buildProjectionPoints = (
  plan: GoalPlanResponse,
  periodCount: number,
  perPeriod: number,
  lumpSum: number,
  ratePercent: number,
): ProjectionPoint[] => {
  const frequency = plan.assumptions.contributionFrequency;
  const nPerYear = contributionFrequencyToNPerYear(frequency);
  const periodLabelCount = periodCount > 0 ? Math.max(1, Math.round(periodCount)) : 1;
  const periodicRate = nPerYear > 0 ? ratePercent / 100 / nPerYear : 0;
  const target = plan.goal.targetAmount;
  const existing = plan.goal.existingSavings ?? 0;
  const finitePerPeriod = Number.isFinite(perPeriod) ? perPeriod : 0;
  const finiteLump = Number.isFinite(lumpSum) ? lumpSum : 0;

  const points: ProjectionPoint[] = [];

  let balance = existing + finiteLump;
  let contributions = existing + finiteLump;

  points.push({
    period: 0,
    total: Math.min(balance, target),
    contributions,
    growth: Math.max(Math.min(balance, target) - contributions, 0),
  });

  for (let i = 1; i <= periodLabelCount; i += 1) {
    if (periodCount > 0) {
      balance += finitePerPeriod;
      contributions += finitePerPeriod;
    }

    if (periodicRate > 0) {
      const growth = balance * periodicRate;
      balance += growth;
    }

    const total = Math.min(balance, target);
    const growthPortion = Math.max(total - contributions, 0);

    points.push({
      period: i,
      total,
      contributions,
      growth: growthPortion,
    });
  }

  const last = points[points.length - 1];
  if (last) {
    last.total = target;
    last.growth = Math.max(target - contributions, 0);
  }

  return points;
};

const calculateScenario = (
  plan: GoalPlanResponse,
  options: ScenarioOptions = {},
): ScenarioMetrics => {
  const baseYears = plan.horizon.totalPeriods / plan.horizon.nPerYear;
  const adjustmentMonths = options.timelineOffsetMonths ?? 0;
  const adjustedYears = Math.max(baseYears + adjustmentMonths / 12, 0);
  const ratePercent = options.ratePercent ?? plan.assumptions.expectedRate;
  const contributionFrequency = plan.assumptions.contributionFrequency;
  const contributionNPerYear = contributionFrequencyToNPerYear(contributionFrequency);
  const compoundingNPerYear = compoundingFrequencyToNPerYear(plan.assumptions.compounding);
  const existing = plan.goal.existingSavings ?? 0;
  const target = plan.goal.targetAmount;

  const netTarget = netTargetAfterExisting(
    target,
    existing,
    ratePercent,
    compoundingNPerYear,
    adjustedYears,
  );

  const perPeriod = requiredPaymentForFutureValue(
    netTarget,
    ratePercent,
    contributionNPerYear,
    adjustedYears,
  );

  const lumpSum = requiredLumpSumForFutureValue(
    netTarget,
    ratePercent,
    compoundingNPerYear,
    adjustedYears,
  );

  const totalPeriods = contributionNPerYear * adjustedYears;
  const finitePerPeriod = Number.isFinite(perPeriod) ? perPeriod : 0;
  const finiteLump = Number.isFinite(lumpSum) ? lumpSum : 0;
  const contributionsTotal = existing + finiteLump + finitePerPeriod * totalPeriods;
  const growthTotal = Math.max(target - contributionsTotal, 0);
  const contributionPercent = target > 0 ? clamp((contributionsTotal / target) * 100, 0, 100) : 0;
  const growthPercent = target > 0 ? clamp(100 - contributionPercent, 0, 100) : 0;
  const baseTargetDate = new Date(plan.goal.targetDate);
  const adjustedTargetDate = adjustmentMonths !== 0 ? addMonths(baseTargetDate, adjustmentMonths) : baseTargetDate;
  const breakdown = deriveHorizonBreakdown(totalPeriods, contributionNPerYear);

  const points = buildProjectionPoints(
    plan,
    totalPeriods,
    perPeriod,
    lumpSum,
    ratePercent,
  );

  return {
    perPeriod,
    lumpSum,
    contributionsTotal,
    growthTotal,
    contributionPercent,
    growthPercent,
    periodCount: totalPeriods,
    targetDate: adjustedTargetDate,
    points,
    years: breakdown.years,
    months: breakdown.months,
    ratePercent,
  };
};

const ChartSection = (props: {
  plan: GoalPlanResponse;
  scenario: ScenarioMetrics;
  formatCurrency: (value: number) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
}) => {
  const { plan, scenario, formatCurrency, formatPercent } = props;
  const periodLabel = frequencyToLabel(plan.assumptions.contributionFrequency);
  const chartId = "goal-plan-chart";
  const prefersReducedMotion = usePrefersReducedMotion();
  const linePathRef = useRef<SVGPathElement | null>(null);
  const areaPathRef = useRef<SVGPathElement | null>(null);

  const maxValue = useMemo(() => {
    const totals = scenario.points.map((point) => point.total);
    return Math.max(plan.goal.targetAmount, ...totals, 1);
  }, [plan.goal.targetAmount, scenario.points]);

  const pathData = useMemo(() => {
    if (scenario.points.length <= 1) {
      return "";
    }

    return scenario.points
      .map((point, index) => {
        const x = (index / (scenario.points.length - 1)) * 100;
        const y = 100 - (point.total / maxValue) * 100;
        const command = index === 0 ? "M" : "L";
        return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [scenario.points, maxValue]);

  useEffect(() => {
    if (prefersReducedMotion) {
      const lineElement = linePathRef.current;
      const areaElement = areaPathRef.current;

      if (lineElement) {
        lineElement.style.removeProperty("strokeDasharray");
        lineElement.style.removeProperty("strokeDashoffset");
        lineElement.style.removeProperty("transition");
      }

      if (areaElement) {
        areaElement.style.removeProperty("opacity");
        areaElement.style.removeProperty("transition");
      }

      return;
    }

    const lineElement = linePathRef.current;

    if (!lineElement) {
      return;
    }

    const areaElement = areaPathRef.current;
    const length = lineElement.getTotalLength();
    lineElement.style.strokeDasharray = `${length}`;
    lineElement.style.strokeDashoffset = `${length}`;
    lineElement.style.transition = "stroke-dashoffset 600ms ease-out";

    if (areaElement) {
      areaElement.style.opacity = "0";
      areaElement.style.transition = "opacity 600ms ease-out";
    }

    const raf = requestAnimationFrame(() => {
      lineElement.style.strokeDashoffset = "0";
      if (areaElement) {
        areaElement.style.opacity = "1";
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      lineElement.style.removeProperty("strokeDasharray");
      lineElement.style.removeProperty("strokeDashoffset");
      lineElement.style.removeProperty("transition");
      if (areaElement) {
        areaElement.style.removeProperty("opacity");
        areaElement.style.removeProperty("transition");
      }
    };
  }, [pathData, prefersReducedMotion]);

  return (
    <section className="space-y-4" aria-labelledby="projection-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="projection-title" className="text-lg font-semibold text-slate-900">
            Projection
          </h2>
          <p className="text-sm text-slate-600">
            Total goal value over time based on current assumptions.
          </p>
        </div>
      </div>

      <figure aria-labelledby="projection-title" aria-describedby={`${chartId}-description`}>
        <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <svg
            className="h-full w-full"
            viewBox="0 0 100 100"
            role="img"
            aria-hidden="true"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="projection-line" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" fill="#eff6ff" />
            {pathData ? (
              <Fragment>
                <path
                  ref={linePathRef}
                  d={`${pathData}`}
                  fill="none"
                  stroke="#1d4ed8"
                  strokeWidth="1.5"
                />
                <path
                  ref={areaPathRef}
                  d={`${pathData} L100,100 L0,100 Z`}
                  fill="url(#projection-line)"
                  stroke="none"
                />
              </Fragment>
            ) : null}
          </svg>
        </div>
        <figcaption id={`${chartId}-description`} className="sr-only">
          Data table of goal projection values across each {periodLabel}.
        </figcaption>
      </figure>

      <div className="overflow-x-auto">
        <table className="sr-only">
          <caption className="sr-only">
            Projection data table listing total value, contributions, and growth per {periodLabel}.
          </caption>
          <thead>
            <tr>
              <th scope="col">{periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}</th>
              <th scope="col">Total value</th>
              <th scope="col">Your contributions</th>
              <th scope="col">Growth</th>
            </tr>
          </thead>
          <tbody>
            {scenario.points.map((point) => (
              <tr key={point.period}>
                <th scope="row">{point.period}</th>
                <td>{formatCurrency(point.total)}</td>
                <td>{formatCurrency(point.contributions)}</td>
                <td>{formatCurrency(point.growth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-600">Contributions vs growth</p>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="bg-primary-500"
            style={{ width: `${scenario.contributionPercent}%` }}
            aria-hidden="true"
          />
          <div
            className="bg-emerald-400"
            style={{ width: `${scenario.growthPercent}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-primary-500" aria-hidden="true" />
            <span>
              Your contributions: {formatCurrency(roundCurrency(scenario.contributionsTotal))} (
              {formatPercent(scenario.contributionPercent, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              )
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>
              Growth: {formatCurrency(roundCurrency(scenario.growthTotal))} (
              {formatPercent(scenario.growthPercent, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              )
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

const PlanSummaryCard = (props: {
  plan: GoalPlanResponse;
  formatCurrency: (value: number, currencyOverride?: string, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number, options?: { withDay?: boolean }) => string;
}) => {
  const { plan, formatCurrency, formatPercent, formatDate } = props;
  const periodLabel = frequencyToLabel(plan.assumptions.contributionFrequency);
  const perPeriodValue = Number.isFinite(plan.totals.perPeriod)
    ? formatCurrency(roundCurrency(plan.totals.perPeriod))
    : null;
  const lumpSumValue = Number.isFinite(plan.totals.lumpSumNow)
    ? formatCurrency(roundCurrency(plan.totals.lumpSumNow))
    : null;
  const targetAmount = formatCurrency(plan.goal.targetAmount);
  const targetDate = formatDate(plan.goal.targetDate, { withDay: false });
  const rate = plan.assumptions.expectedRate;
  const rateLabel = formatPercent(rate, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  const compoundingLabel = plan.assumptions.compounding === "monthly" ? "monthly" : "yearly";
  const existingSavings = plan.goal.existingSavings > 0 ? formatCurrency(plan.goal.existingSavings) : null;

  const perPeriodSentence = perPeriodValue
    ? `Put ${perPeriodValue} per ${periodLabel} starting now.`
    : "Set a future date to see what to put in.";
  const lumpSumSentence = lumpSumValue
    ? `Or invest ${lumpSumValue} today instead.`
    : "We can’t suggest a lump sum yet.";
  const rateSentence =
    rate === 0
      ? "We’re assuming 0% growth; your plan depends only on what you put in."
      : `We’re assuming ${rateLabel} per year, compounded ${compoundingLabel}.`;

  return (
    <Card className="bg-white">
      <CardHeader className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Plan summary</p>
        <h2 className="text-3xl font-semibold text-slate-900">Your plan in one glance</h2>
      </CardHeader>
      <CardContent className="space-y-3 text-base font-medium text-slate-900">
        <p>You’re aiming for {targetAmount} by {targetDate}.</p>
        <p>{perPeriodSentence}</p>
        <p>{rateSentence}</p>
        <p>{lumpSumSentence}</p>
        {existingSavings ? <p>You already have {existingSavings}, which reduces what you need.</p> : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold text-slate-700">Assumed return</span>
          <InfoTooltip
            label="What does assumed return mean?"
            content="A guess for planning, not a recommendation."
          />
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold text-slate-700">Compounding</span>
          <InfoTooltip
            label="What is compounding?"
            content="How often growth is added to your balance (monthly or yearly)."
          />
        </span>
      </CardFooter>
    </Card>
  );
};

const PlanWarnings = (props: { warnings?: string[] }) => {
  const { warnings } = props;

  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" aria-live="polite" role="status">
      {warnings.map((warning) => (
        <div
          key={warning}
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
        >
          {warning}
        </div>
      ))}
    </div>
  );
};

const TimelineNarrative = (props: {
  plan: GoalPlanResponse;
  formatCurrency: (value: number, currencyOverride?: string, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number, options?: { withDay?: boolean }) => string;
  formatHorizon: (input: { years?: number; months?: number; totalMonths?: number } | number) => string;
}) => {
  const { plan, formatCurrency, formatPercent, formatDate, formatHorizon } = props;
  const rateLabel = formatPercent(plan.assumptions.expectedRate, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  const perPeriodValue = Number.isFinite(plan.totals.perPeriod)
    ? formatCurrency(roundCurrency(plan.totals.perPeriod))
    : null;
  const periodLabel = frequencyToLabel(plan.assumptions.contributionFrequency);
  const targetAmount = formatCurrency(plan.goal.targetAmount);
  const targetDate = formatDate(plan.goal.targetDate, { withDay: false });

  const years = Math.max(plan.horizon.years, 0);
  const months = Math.max(plan.horizon.months, 0);
  const horizonParts: string[] = [];
  if (years > 0) {
    horizonParts.push(`${years} ${years === 1 ? "year" : "years"}`);
  }
  if (months > 0) {
    horizonParts.push(`${months} ${months === 1 ? "month" : "months"}`);
  }
  const fallbackHorizon = formatHorizon({ years, months });
  const horizonText =
    horizonParts.length === 0
      ? fallbackHorizon
      : horizonParts.length === 2
      ? `${horizonParts[0]} and ${horizonParts[1]}`
      : horizonParts[0];

  const sentence =
    plan.assumptions.contributionFrequency === "monthly"
      ? perPeriodValue
        ? `Saving ${perPeriodValue} each ${periodLabel} at ${rateLabel} should get you to ${targetAmount} by ${targetDate}.`
        : `Keep a future date so we can show how monthly savings reach ${targetAmount}.`
      : `At this pace and return, in ${horizonText}, your plan is on track to reach ${targetAmount}.`;

  const showShortHorizon = plan.horizon.totalPeriods < 1;

  return (
    <div className="space-y-2" aria-live="polite">
      <p className="text-base font-medium text-slate-700">{sentence}</p>
      {showShortHorizon ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Growth has little effect in this short time.
        </p>
      ) : null}
    </div>
  );
};

const ExplainSection = (props: {
  plan: GoalPlanResponse;
  formatCurrency: (value: number, currencyOverride?: string, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number, options?: { withDay?: boolean }) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
}) => {
  const { plan, formatCurrency, formatDate, formatPercent } = props;
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const periodLabel = frequencyToLabel(plan.assumptions.contributionFrequency);
  const perPeriodValue = Number.isFinite(plan.totals.perPeriod)
    ? formatCurrency(roundCurrency(plan.totals.perPeriod))
    : null;
  const targetAmount = formatCurrency(plan.goal.targetAmount);
  const targetDate = formatDate(plan.goal.targetDate, { withDay: false });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white" aria-labelledby={`${contentId}-title`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left text-base font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span id={`${contentId}-title`}>Explain it like I’m 12</span>
        <span className="text-sm font-medium text-primary-600">{isOpen ? "Hide" : "Show"}</span>
      </button>
      <div
        id={contentId}
        hidden={!isOpen}
        className="space-y-3 border-t border-slate-200 px-4 py-4 text-base text-slate-700"
      >
        <ul className="list-disc space-y-2 pl-5">
          <li>You want {targetAmount} by {targetDate}.</li>
          <li>
            {perPeriodValue
              ? `You’ll put in ${perPeriodValue} every ${periodLabel}.`
              : "We need a target date before we can show your contributions."}
          </li>
          <li>We assume your money grows by {formatPercent(plan.assumptions.expectedRate)} each year (that’s an estimate, not a promise).</li>
          {plan.goal.existingSavings > 0 ? (
            <li>You already saved {formatCurrency(plan.goal.existingSavings)} today.</li>
          ) : null}
        </ul>
      </div>
    </section>
  );
};

const SharedContributions = (props: {
  plan: GoalPlanResponse;
  formatCurrency: (value: number, currencyOverride?: string, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
}) => {
  const { plan, formatCurrency, formatPercent } = props;

  if (!plan.goal.isShared) {
    return null;
  }

  const periodLabel = frequencyToLabel(plan.assumptions.contributionFrequency);

  return (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold text-slate-900">Who pays what</h3>
      <Table>
        <TableHead>
          <TableRow className="bg-slate-50">
            <TableHeaderCell className="text-left text-xs">Person</TableHeaderCell>
            <TableHeaderCell className="text-left text-xs">Per {periodLabel}</TableHeaderCell>
            <TableHeaderCell className="text-left text-xs">Share</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {plan.members.map((member) => {
            const name = member.name ?? member.email ?? member.userId;
            const perMemberValue = formatCurrency(roundCurrency(member.perPeriod));
            const shareLabel =
              member.splitPercent != null
                ? formatPercent(member.splitPercent, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
                : "Fixed";

            return (
              <TableRow key={member.userId} className="odd:bg-white even:bg-slate-50/50">
                <TableCell className="font-medium text-slate-900">{name}</TableCell>
                <TableCell>{perMemberValue}</TableCell>
                <TableCell>{shareLabel}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-sm font-medium text-slate-700">
        Together you’ll contribute {formatCurrency(roundCurrency(plan.totals.perPeriod))} per {periodLabel}.
      </p>
    </section>
  );
};

const ScenarioCompare = (props: {
  plan: GoalPlanResponse;
  baseScenario: ScenarioMetrics;
  formatCurrency: (value: number, currencyOverride?: string, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number, options?: { withDay?: boolean }) => string;
  onReset: () => Promise<void> | void;
  isResetting: boolean;
}) => {
  const { plan, baseScenario, formatCurrency, formatPercent, formatDate, onReset, isResetting } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [ratePercent, setRatePercent] = useState(baseScenario.ratePercent);
  const [timelineOffsetMonths, setTimelineOffsetMonths] = useState(0);

  const adjustedScenario = useMemo(
    () => calculateScenario(plan, { ratePercent, timelineOffsetMonths }),
    [plan, ratePercent, timelineOffsetMonths],
  );

  useEffect(() => {
    setRatePercent(baseScenario.ratePercent);
    setTimelineOffsetMonths(0);
  }, [baseScenario.ratePercent]);

  const minAdjustment = -Math.round((plan.horizon.totalPeriods / plan.horizon.nPerYear) * 12);
  const maxAdjustment = 240;
  const periodLabel = frequencyToLabel(plan.assumptions.contributionFrequency);

  const handleNudge = (delta: number) => {
    setTimelineOffsetMonths((prev) => clamp(prev + delta, minAdjustment, maxAdjustment));
  };

  const handleReset = () => {
    setRatePercent(baseScenario.ratePercent);
    setTimelineOffsetMonths(0);
    void onReset();
  };

  const basePerPeriod = Number.isFinite(plan.totals.perPeriod)
    ? formatCurrency(roundCurrency(plan.totals.perPeriod))
    : "Not available";
  const adjustedPerPeriod = Number.isFinite(adjustedScenario.perPeriod)
    ? formatCurrency(roundCurrency(adjustedScenario.perPeriod))
    : "Not available";

  const baseDateLabel = formatDate(plan.goal.targetDate, { withDay: false });
  const adjustedDateLabel = formatDate(adjustedScenario.targetDate, { withDay: false });
  const isInfeasible = !Number.isFinite(adjustedScenario.perPeriod) || adjustedScenario.perPeriod <= 0;

  let suggestion: string | null = null;
  if (isInfeasible) {
    const easedOffset = Math.min(maxAdjustment, Math.max(timelineOffsetMonths, 0) + 6);
    const easedScenario = calculateScenario(plan, { ratePercent, timelineOffsetMonths: easedOffset });
    const suggestedAmount = Number.isFinite(easedScenario.perPeriod)
      ? easedScenario.perPeriod
      : plan.totals.perPeriod;
    const deltaValue = Math.max(
      Math.abs(suggestedAmount - plan.totals.perPeriod),
      Math.abs(plan.totals.perPeriod * 0.1),
    );
    const deltaLabel = formatCurrency(roundCurrency(deltaValue));
    const easedDate = formatDate(addMonths(new Date(plan.goal.targetDate), easedOffset), { withDay: false });
    suggestion = `This plan looks tight. Try adding ${deltaLabel} per ${periodLabel} or moving your date to ${easedDate}.`;
  }

  const nudgeButtons = [
    { label: "−1 year", value: -12 },
    { label: "−6 months", value: -6 },
    { label: "+6 months", value: 6 },
    { label: "+1 year", value: 12 },
  ];

  return (
    <section className="space-y-4" aria-labelledby="scenario-compare-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="scenario-compare-title" className="text-lg font-semibold text-slate-900">
            Compare with quick tweaks
          </h2>
          <p className="text-sm text-slate-600">See how a new return or target date changes your plan.</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls="scenario-controls"
        >
          {isOpen ? "Close panel" : "Try a different return or date"}
        </Button>
      </div>

      {isOpen ? (
        <div id="scenario-controls" className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="compare-rate" className="flex items-center justify-between text-sm font-medium text-slate-700">
                  <span>Assumed return</span>
                  <span>{formatPercent(ratePercent, { maximumFractionDigits: 1, minimumFractionDigits: 0 })}</span>
                </label>
                <input
                  id="compare-rate"
                  type="range"
                  min={0}
                  max={20}
                  step={0.5}
                  value={ratePercent}
                  onChange={(event) => setRatePercent(Number(event.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">Slide between 0% and 20% to test other growth guesses.</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Nudge the date</p>
                <div className="flex flex-wrap gap-2">
                  {nudgeButtons.map((button) => (
                    <Button
                      key={button.label}
                      type="button"
                      variant="secondary"
                      className="px-3 py-1 text-sm"
                      onClick={() => handleNudge(button.value)}
                    >
                      {button.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  Current offset: {timelineOffsetMonths} months. New date becomes {adjustedDateLabel}.
                </p>
              </div>
            </div>

            <div className="space-y-4" aria-live="polite">
              <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Original</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{basePerPeriod}</p>
                  <p className="text-xs text-slate-600">Per {periodLabel}</p>
                  <p className="mt-3 text-sm font-medium text-slate-900">{baseDateLabel}</p>
                  <p className="text-xs text-slate-600">Target date</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Adjusted</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{adjustedPerPeriod}</p>
                  <p className="text-xs text-slate-600">Per {periodLabel}</p>
                  <p className="mt-3 text-sm font-medium text-slate-900">{adjustedDateLabel}</p>
                  <p className="text-xs text-slate-600">Target date</p>
                </div>
              </div>
              {suggestion ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                  {suggestion}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={handleReset} disabled={isResetting}>
              {isResetting ? "Resetting…" : "Reset to original"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

type EditableColumnKey = "split" | "fixed";

interface MemberRowState {
  userId: string;
  role: GoalPlanResponse["members"][number]["role"];
  name: string | null;
  email?: string;
  splitPercent: string;
  fixedAmount: string;
}

interface MemberFieldErrorState {
  splitPercent?: string;
  fixedAmount?: string;
}

type MemberFieldErrors = Record<string, MemberFieldErrorState>;

interface InviteFieldErrors {
  email?: string;
  defaultSplitPercent?: string;
  fixedAmount?: string;
}

interface ComputedMemberRow extends MemberRowState {
  splitValue: number | null;
  fixedValue: number | null;
  perPeriod: number;
}

interface MemberComputationResult {
  rows: ComputedMemberRow[];
  percentSum: number;
  percentEligibleCount: number;
  hasOverflow: boolean;
  fixedTotal: number;
  totalPerPeriod: number;
  isTotalFinite: boolean;
}

const NUMERIC_EPSILON = 1e-6;
const PERCENT_TOLERANCE = 0.5;

const parseNumericInput = (value: string): number | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

const initializeMemberRows = (members: GoalPlanResponse["members"]): MemberRowState[] =>
  members.map((member) => ({
    userId: member.userId,
    role: member.role,
    name: member.name ?? null,
    email: member.email,
    splitPercent: member.splitPercent != null ? member.splitPercent.toString() : "",
    fixedAmount: member.fixedAmount != null ? member.fixedAmount.toString() : "",
  }));

const serializeRows = (rows: MemberRowState[]): string =>
  JSON.stringify(
    rows.map((row) => ({
      userId: row.userId,
      role: row.role,
      splitPercent: row.splitPercent.trim(),
      fixedAmount: row.fixedAmount.trim(),
    })),
  );

const mapMemberIssues = (
  issues: ReturnType<typeof normalizeZodIssues>,
  rows: MemberRowState[],
): {
  errors: MemberFieldErrors;
  generalMessages: string[];
  firstError: { rowIndex: number; field: EditableColumnKey } | null;
} => {
  const errors: MemberFieldErrors = {};
  const generalMessages: string[] = [];
  let firstError: { rowIndex: number; field: EditableColumnKey } | null = null;

  issues.forEach((issue) => {
    if (issue.path[0] !== "members") {
      if (issue.path.length === 0) {
        generalMessages.push(issue.message);
      }
      return;
    }

    const indexCandidate = issue.path[1];
    const rowIndex =
      typeof indexCandidate === "number"
        ? indexCandidate
        : typeof indexCandidate === "string"
        ? Number.parseInt(indexCandidate, 10)
        : Number.NaN;

    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= rows.length) {
      generalMessages.push(issue.message);
      return;
    }

    const fieldSegment = issue.path[2];
    const fieldKey =
      fieldSegment === "splitPercent"
        ? "splitPercent"
        : fieldSegment === "fixedAmount"
        ? "fixedAmount"
        : null;

    if (!fieldKey) {
      generalMessages.push(issue.message);
      return;
    }

    const member = rows[rowIndex];
    if (!member) {
      generalMessages.push(issue.message);
      return;
    }

    errors[member.userId] = {
      ...errors[member.userId],
      [fieldKey]: issue.message,
    };

    if (!firstError) {
      firstError = { rowIndex, field: fieldKey === "splitPercent" ? "split" : "fixed" };
    }
  });

  return { errors, generalMessages, firstError };
};

const mapInviteIssues = (issues: ReturnType<typeof normalizeZodIssues>) => {
  const errors: InviteFieldErrors = {};
  const generalMessages: string[] = [];

  issues.forEach((issue) => {
    const field = issue.path[0];
    if (field === "email" || field === "defaultSplitPercent" || field === "fixedAmount") {
      errors[field] = errors[field] ?? issue.message;
      return;
    }

    if (issue.path.length === 0) {
      generalMessages.push(issue.message);
    }
  });

  return { errors, generalMessages };
};

const computeMemberAllocations = (
  rows: MemberRowState[],
  totalPerPeriod: number,
): MemberComputationResult => {
  const isTotalFinite = Number.isFinite(totalPerPeriod);
  const normalizedTotal = isTotalFinite ? totalPerPeriod : 0;

  const computedRows: ComputedMemberRow[] = rows.map((row) => {
    const rawSplit = parseNumericInput(row.splitPercent);
    const rawFixed = parseNumericInput(row.fixedAmount);
    const splitValue = rawSplit != null ? Math.max(rawSplit, 0) : null;
    const fixedValue = rawFixed != null ? Math.max(rawFixed, 0) : null;

    return {
      ...row,
      splitValue,
      fixedValue,
      perPeriod: fixedValue ?? 0,
    };
  });

  const fixedTotal = computedRows.reduce((sum, row) => sum + (row.fixedValue ?? 0), 0);

  let remaining = normalizedTotal - fixedTotal;
  let hasOverflow = false;

  if (isTotalFinite && remaining < -NUMERIC_EPSILON) {
    hasOverflow = true;
    remaining = 0;
  }

  const percentEligible = computedRows.filter((row) => row.fixedValue == null);
  const percentSum = percentEligible.reduce((sum, row) => sum + (row.splitValue ?? 0), 0);

  if (percentEligible.length > 0 && percentSum > NUMERIC_EPSILON) {
    percentEligible.forEach((row) => {
      const ratio = (row.splitValue ?? 0) / percentSum;
      const contribution = isTotalFinite ? remaining * ratio : 0;
      row.perPeriod += contribution;
    });
  }

  return {
    rows: computedRows,
    percentSum,
    percentEligibleCount: percentEligible.length,
    hasOverflow,
    fixedTotal,
    totalPerPeriod: normalizedTotal,
    isTotalFinite,
  };
};

interface MembersSectionProps {
  goalId: string;
  members: GoalPlanResponse["members"];
  totalPerPeriod: number;
  formatCurrency: (value: number) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
  canManageMembers: boolean;
  onMembersUpdated?: () => Promise<void> | void;
  isPlanRefreshing: boolean;
}

function MembersSection(props: MembersSectionProps): JSX.Element {
  const {
    goalId,
    members,
    totalPerPeriod,
    formatCurrency,
    formatPercent,
    canManageMembers,
    onMembersUpdated,
    isPlanRefreshing,
  } = props;
  const { publish } = useToast();
  const [rows, setRows] = useState<MemberRowState[]>(() => initializeMemberRows(members));
  const rowsRef = useRef<MemberRowState[]>(rows);
  const lastSavedRef = useRef<string>(serializeRows(rows));
  const isSavingRef = useRef(false);
  const hasPendingSaveRef = useRef(false);
  const [isSavingMembers, setIsSavingMembers] = useState(false);
  const [memberErrors, setMemberErrors] = useState<MemberFieldErrors>({});
  const [pendingRemovalUserId, setPendingRemovalUserId] = useState<string | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const baseId = useId();
  const splitHintId = `${baseId}-split-hint`;
  const fixedHintId = `${baseId}-fixed-hint`;
  const sectionDescriptionId = `${baseId}-members-description`;
  const percentWarningId = `${baseId}-percent-warning`;
  const overflowWarningId = `${baseId}-overflow-warning`;
  const captionId = `${baseId}-members-caption`;
  const splitHeaderId = `${baseId}-split-header`;
  const fixedHeaderId = `${baseId}-fixed-header`;
  const titleId = `${baseId}-title`;
  const inviteStatusId = `${baseId}-invite-status`;
  const inviteHelperId = `${baseId}-invite-helper`;

  useEffect(() => {
    const nextRows = initializeMemberRows(members);
    setRows(nextRows);
    rowsRef.current = nextRows;
    lastSavedRef.current = serializeRows(nextRows);
    hasPendingSaveRef.current = false;
    isSavingRef.current = false;
    setIsSavingMembers(false);
    setMemberErrors({});
  }, [members]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const computation = useMemo(
    () => computeMemberAllocations(rows, totalPerPeriod),
    [rows, totalPerPeriod],
  );

  const columnOrder: readonly EditableColumnKey[] = ["split", "fixed"];
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const registerInputRef = useCallback(
    (rowIndex: number, column: EditableColumnKey) => {
      return (element: HTMLInputElement | null) => {
        const key = `${rowIndex}-${column}`;
        if (element) {
          inputRefs.current[key] = element;
        } else {
          delete inputRefs.current[key];
        }
      };
    },
    [],
  );

  const focusCell = useCallback((rowIndex: number, column: EditableColumnKey) => {
    const key = `${rowIndex}-${column}`;
    const element = inputRefs.current[key];
    if (element) {
      element.focus();
      element.select?.();
    }
  }, []);

  const commitChanges = useCallback(async () => {
    if (!canManageMembers) {
      return;
    }

    const snapshot = rowsRef.current;
    const serialized = serializeRows(snapshot);

    if (serialized === lastSavedRef.current) {
      return;
    }

    if (isSavingRef.current) {
      hasPendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    hasPendingSaveRef.current = false;
    setIsSavingMembers(true);

    const payload = snapshot.map((row) => {
      const splitValue = parseNumericInput(row.splitPercent);
      const fixedValue = parseNumericInput(row.fixedAmount);

      return {
        userId: row.userId,
        role: row.role,
        splitPercent: splitValue ?? null,
        fixedAmount: fixedValue ?? null,
      };
    });

    const applyIssues = (
      issues: ReturnType<typeof normalizeZodIssues>,
      notify = true,
    ) => {
      const { errors, generalMessages, firstError } = mapMemberIssues(issues, snapshot);

      if (Object.keys(errors).length > 0) {
        setMemberErrors(errors);
      }

      if (firstError) {
        focusCell(firstError.rowIndex, firstError.field);
      }

      if (notify) {
        const message =
          generalMessages[0] ??
          (Object.keys(errors).length > 0 ? "Check the highlighted fields." : null);

        if (message) {
          publish({
            title: "Update failed",
            description: message,
            variant: "error",
          });
        }
      }

      return Object.keys(errors).length > 0 || generalMessages.length > 0;
    };

    const validation = UpdateGoalMembersInputSchema.safeParse({ members: payload });

    if (!validation.success) {
      applyIssues(normalizeZodIssues(validation.error.issues));
      isSavingRef.current = false;
      setIsSavingMembers(false);
      return;
    }

    try {
      const response = await updateGoalMembers(goalId, validation.data);
      const serverMembers = new Map(
        response.members.map((member) => [member.userId, member]),
      );

      const nextRows: MemberRowState[] = snapshot.map((row) => {
        const serverMember = serverMembers.get(row.userId);
        return {
          ...row,
          splitPercent:
            serverMember?.splitPercent != null
              ? serverMember.splitPercent.toString()
              : "",
          fixedAmount:
            serverMember?.fixedAmount != null
              ? serverMember.fixedAmount.toString()
              : "",
        };
      });

      const knownIds = new Set(nextRows.map((row) => row.userId));
      response.members.forEach((member) => {
        if (!knownIds.has(member.userId)) {
          nextRows.push({
            userId: member.userId,
            role: member.role,
            name: null,
            email: undefined,
            splitPercent:
              member.splitPercent != null ? member.splitPercent.toString() : "",
            fixedAmount:
              member.fixedAmount != null ? member.fixedAmount.toString() : "",
          });
          knownIds.add(member.userId);
        }
      });

      rowsRef.current = nextRows;
      lastSavedRef.current = serializeRows(nextRows);
      setRows(nextRows);
      setMemberErrors({});

      if (onMembersUpdated) {
        await onMembersUpdated();
      }
    } catch (error) {
      if (error instanceof HttpApiError) {
        if (error.status === 422) {
          const handled = applyIssues(normalizeZodIssues(error.details));
          if (handled) {
            return;
          }
        }

        publish({
          title: "Update failed",
          description: error.message,
          variant: "error",
        });
        return;
      }

      const message = isApiError(error)
        ? error.message
        : "We couldn't update these contributions. Check your connection and try again.";
      publish({
        title: "Update failed",
        description: message,
        variant: "error",
      });
    } finally {
      isSavingRef.current = false;
      setIsSavingMembers(false);

      if (hasPendingSaveRef.current) {
        hasPendingSaveRef.current = false;
        void commitChanges();
      }
    }
  }, [canManageMembers, focusCell, goalId, onMembersUpdated, publish]);

  const percentWarningActive =
    computation.percentEligibleCount > 0 &&
    Math.abs(computation.percentSum - 100) > PERCENT_TOLERANCE;
  const overflowWarningActive = computation.hasOverflow && computation.isTotalFinite;

  const tableDescribedBy = [sectionDescriptionId]
    .concat(percentWarningActive ? [percentWarningId] : [])
    .concat(overflowWarningActive ? [overflowWarningId] : [])
    .join(" ") || undefined;

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    column: EditableColumnKey,
  ) => {
    if (!canManageMembers) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      void commitChanges();
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const offset = event.key === "ArrowUp" ? -1 : 1;
      const nextRow = rowIndex + offset;
      if (nextRow >= 0 && nextRow < computation.rows.length) {
        focusCell(nextRow, column);
      }
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const target = event.currentTarget;
      const selectionStart = target.selectionStart ?? 0;
      const selectionEnd = target.selectionEnd ?? 0;
      const isAtStart = selectionStart === 0 && selectionEnd === 0;
      const isAtEnd =
        selectionStart === target.value.length && selectionEnd === target.value.length;
      const columnIndex = columnOrder.indexOf(column);

      if (event.key === "ArrowLeft" && isAtStart && columnIndex > 0) {
        event.preventDefault();
        focusCell(rowIndex, columnOrder[columnIndex - 1]!);
      } else if (
        event.key === "ArrowRight" &&
        isAtEnd &&
        columnIndex < columnOrder.length - 1
      ) {
        event.preventDefault();
        focusCell(rowIndex, columnOrder[columnIndex + 1]!);
      }
    }
  };

  const handleSplitChange = (rowIndex: number, value: string) => {
    if (!canManageMembers) {
      return;
    }

    const userId = rowsRef.current[rowIndex]?.userId;
    setRows((prev) => {
      const next = prev.map((row, index) =>
        index === rowIndex ? { ...row, splitPercent: value } : row,
      );
      rowsRef.current = next;
      return next;
    });

    if (userId) {
      setMemberErrors((prev) => {
        const existing = prev[userId];
        if (!existing?.splitPercent) {
          return prev;
        }

        const next = { ...prev };
        const nextEntry: MemberFieldErrorState = { ...existing };
        delete nextEntry.splitPercent;

        if (Object.keys(nextEntry).length === 0) {
          delete next[userId];
        } else {
          next[userId] = nextEntry;
        }

        return next;
      });
    }
  };

  const handleFixedChange = (rowIndex: number, value: string) => {
    if (!canManageMembers) {
      return;
    }

    const userId = rowsRef.current[rowIndex]?.userId;
    setRows((prev) => {
      const next = prev.map((row, index) =>
        index === rowIndex ? { ...row, fixedAmount: value } : row,
      );
      rowsRef.current = next;
      return next;
    });

    if (userId) {
      setMemberErrors((prev) => {
        const existing = prev[userId];
        if (!existing?.fixedAmount) {
          return prev;
        }

        const next = { ...prev };
        const nextEntry: MemberFieldErrorState = { ...existing };
        delete nextEntry.fixedAmount;

        if (Object.keys(nextEntry).length === 0) {
          delete next[userId];
        } else {
          next[userId] = nextEntry;
        }

        return next;
      });
    }
  };

  const requestRemoveMember = (userId: string) => {
    if (!canManageMembers || isRemovingMember) {
      return;
    }

    setPendingRemovalUserId(userId);
  };

  const confirmRemoveMember = async () => {
    if (!canManageMembers || !pendingRemovalUserId) {
      setPendingRemovalUserId(null);
      return;
    }

    setIsRemovingMember(true);

    try {
      await removeGoalMember(goalId, pendingRemovalUserId);

      setRows((prev) => {
        const next = prev.filter((row) => row.userId !== pendingRemovalUserId);
        rowsRef.current = next;
        lastSavedRef.current = serializeRows(next);
        return next;
      });

      publish({
        title: "Collaborator removed",
        description: "Collaborator removed and access revoked.",
        variant: "success",
      });

      setPendingRemovalUserId(null);

      if (onMembersUpdated) {
        await onMembersUpdated();
      }
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : "We couldn't remove this collaborator. Check your connection and try again.";
      publish({
        title: "Removal failed",
        description: message,
        variant: "error",
      });
    } finally {
      setIsRemovingMember(false);
    }
  };

  const cancelRemoveMember = () => {
    setPendingRemovalUserId(null);
  };

  const handleRebalance = () => {
    if (!canManageMembers) {
      return;
    }

    let updated = false;
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      const eligible = next
        .map((row) => ({
          row,
          percent: parseNumericInput(row.splitPercent) ?? 0,
          hasFixed: parseNumericInput(row.fixedAmount) != null,
        }))
        .filter((entry) => !entry.hasFixed);

      if (eligible.length === 0) {
        return prev;
      }

      const total = eligible.reduce((sum, entry) => sum + entry.percent, 0);

      if (total <= NUMERIC_EPSILON) {
        const share = eligible.length > 0 ? 100 / eligible.length : 0;
        eligible.forEach((entry) => {
          const nextValue = clamp(share, 0, 100).toFixed(1);
          if (entry.row.splitPercent !== nextValue) {
            updated = true;
            entry.row.splitPercent = nextValue;
          }
        });
        if (updated) {
          rowsRef.current = next;
        }
        return updated ? next : prev;
      }

      eligible.forEach((entry) => {
        const ratio = entry.percent / total;
        const nextValue = clamp(ratio * 100, 0, 100).toFixed(1);
        if (entry.row.splitPercent !== nextValue) {
          updated = true;
          entry.row.splitPercent = nextValue;
        }
      });

      if (updated) {
        rowsRef.current = next;
      }

      return updated ? next : prev;
    });

    if (updated) {
      publish({
        title: "Splits rebalanced",
        description: "Percent contributions now total 100%.",
        variant: "success",
      });
      void commitChanges();
    }
  };

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSplit, setInviteSplit] = useState("50.0");
  const [inviteFixed, setInviteFixed] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteErrors, setInviteErrors] = useState<InviteFieldErrors>({});

  const openInvite = () => {
    const remainingPercent = Math.max(0, 100 - computation.percentSum);
    const defaultSplit =
      computation.percentEligibleCount > 0 && remainingPercent > 0 ? remainingPercent : 50;
    setInviteSplit(clamp(defaultSplit, 0, 100).toFixed(1));
    setInviteErrors({});
    setInviteStatus("idle");
    setInviteMessage(null);
    setIsInviteOpen(true);
  };

  const closeInvite = () => {
    setIsInviteOpen(false);
    setInviteEmail("");
    setInviteFixed("");
    setInviteStatus("idle");
    setInviteMessage(null);
    setInviteErrors({});
  };

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageMembers) {
      return;
    }

    setInviteStatus("submitting");
    setInviteMessage(null);
    setInviteErrors({});

    try {
      const candidate = {
        email: inviteEmail,
        defaultSplitPercent: inviteSplit.trim().length > 0 ? inviteSplit : undefined,
        fixedAmount: inviteFixed.trim().length > 0 ? inviteFixed : null,
      };

      const validation = CreateGoalInviteInputSchema.safeParse(candidate);

      if (!validation.success) {
        const normalized = normalizeZodIssues(validation.error.issues);
        const { errors, generalMessages } = mapInviteIssues(normalized);

        if (Object.keys(errors).length > 0) {
          setInviteErrors(errors);
        }

        const message =
          generalMessages[0] ??
          (Object.keys(errors).length > 0
            ? "Please fix the highlighted fields before sending."
            : "We couldn't send that invite. Check the details and try again.");

        setInviteStatus("error");
        setInviteMessage(message);
        return;
      }

      const parsedInput = validation.data;
      setInviteEmail(parsedInput.email);

      const payload = await sendGoalInvite(goalId, parsedInput);

      const successMessage =
        payload?.inviteUrl != null
          ? `Invitation ready. Share this link if needed:\n${payload.inviteUrl}`
          : "Invitation sent. We'll email the collaborator shortly.";

      setInviteStatus("success");
      setInviteMessage(successMessage);
      setInviteErrors({});
      publish({
        title: "Invitation ready",
        description:
          payload?.inviteUrl != null
            ? "Share the invite link with your collaborator."
            : "We emailed your collaborator a link to join.",
        variant: "success",
      });
    } catch (error) {
      if (error instanceof HttpApiError) {
        if (error.status === 422) {
          const normalized = normalizeZodIssues(error.details);
          const { errors, generalMessages } = mapInviteIssues(normalized);

          if (Object.keys(errors).length > 0) {
            setInviteErrors(errors);
            setInviteStatus("error");
            setInviteMessage(
              generalMessages[0] ?? "Please fix the highlighted fields before sending.",
            );
            return;
          }

          if (generalMessages.length > 0) {
            setInviteStatus("error");
            setInviteMessage(generalMessages[0]);
            publish({
              title: "Invite failed",
              description: generalMessages[0],
              variant: "error",
            });
            return;
          }
        }

        setInviteStatus("error");
        setInviteMessage(error.message);
        publish({
          title: "Invite failed",
          description: error.message,
          variant: "error",
        });
        return;
      }

      setInviteStatus("error");
      const message = isApiError(error)
        ? error.message
        : "We couldn't send that invite. Check your connection and try again.";
      setInviteMessage(message);
      publish({
        title: "Invite failed",
        description: message,
        variant: "error",
      });
    }
  };

  const tableRows = computation.rows;
  const showActions = canManageMembers;
  const pendingRemovalRow = pendingRemovalUserId
    ? rows.find((row) => row.userId === pendingRemovalUserId) ?? null
    : null;
  const removalDisplayName = pendingRemovalRow?.name?.trim().length
    ? pendingRemovalRow.name
    : pendingRemovalRow?.email ?? "this collaborator";
  const inviteEmailError = inviteErrors.email;
  const inviteSplitError = inviteErrors.defaultSplitPercent;
  const inviteFixedError = inviteErrors.fixedAmount;
  const inviteEmailErrorId = inviteEmailError ? `${baseId}-invite-email-error` : undefined;
  const inviteSplitErrorId = inviteSplitError ? `${baseId}-invite-split-error` : undefined;
  const inviteFixedErrorId = inviteFixedError ? `${baseId}-invite-fixed-error` : undefined;
  const sectionDescription = canManageMembers
    ? "Adjust how contributions are split between collaborators."
    : "See how contributions are split between collaborators.";
  const splitHintText = canManageMembers
    ? "Enter the percent of the remaining contribution this member should cover."
    : "Percent of the goal this member is responsible for.";
  const fixedHintText = canManageMembers
    ? "Enter a fixed contribution amount per period for this member."
    : "Fixed contribution amount this member covers each period.";
  const tableCaption = canManageMembers
    ? "Manage each member's share of the goal. Required amounts update instantly as you edit the table."
    : "Review each member's share of the goal. Only the owner can make changes.";
  const percentWarningHelp = canManageMembers
    ? "Adjust them to reach 100%, or let us rebalance automatically."
    : "Ask the goal owner to rebalance or update the splits.";

  return (
    <section className="space-y-4" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            Members
          </h2>
          <p id={sectionDescriptionId} className="text-sm text-slate-600">
            {sectionDescription}
          </p>
        </div>
        {canManageMembers ? (
          <Button type="button" onClick={openInvite}>
            Invite collaborator
          </Button>
        ) : null}
      </div>

      <p id={splitHintId} className="sr-only">
        {splitHintText}
      </p>
      <p id={fixedHintId} className="sr-only">
        {fixedHintText}
      </p>

      {percentWarningActive ? (
        <div
          id={percentWarningId}
          className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:items-center sm:justify-between"
          role="status"
          aria-live="polite"
        >
          <p className="flex-1">
            Split percentages currently add up to {formatPercent(computation.percentSum, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}.
            {" "}
            {percentWarningHelp}
          </p>
          {canManageMembers ? (
            <Button type="button" variant="secondary" onClick={handleRebalance}>
              Rebalance to 100%
            </Button>
          ) : null}
        </div>
      ) : null}

      {overflowWarningActive ? (
        <div
          id={overflowWarningId}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          role="alert"
        >
          <p>
            Fixed contributions total {formatCurrency(roundCurrency(computation.fixedTotal))} which
            exceeds the required {formatCurrency(roundCurrency(computation.totalPerPeriod))} per
            period.
          </p>
          <p>
            {canManageMembers
              ? "Reduce fixed amounts or adjust the splits."
              : "Ask the goal owner to reduce fixed amounts or adjust the splits."}
          </p>
        </div>
      ) : null}

      <Table aria-describedby={tableDescribedBy} aria-labelledby={titleId}>
        <caption id={captionId} className="px-4 py-3 text-left text-sm text-slate-600">
          {tableCaption}
        </caption>
        <TableHead>
          <TableRow>
            <TableHeaderCell className="w-64">Member</TableHeaderCell>
            <TableHeaderCell>Role</TableHeaderCell>
            <TableHeaderCell id={splitHeaderId}>Split %</TableHeaderCell>
            <TableHeaderCell id={fixedHeaderId}>Fixed amount</TableHeaderCell>
            <TableHeaderCell>Required per period</TableHeaderCell>
            {showActions ? <TableHeaderCell className="text-right">Actions</TableHeaderCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {tableRows.map((row, rowIndex) => {
            const rowLabelId = `${baseId}-member-${rowIndex}`;
            const primaryLabel = row.name ?? row.email ?? `Member ${rowIndex + 1}`;
            const secondaryLabel =
              row.name && row.email
                ? row.email
                : !row.name && !row.email
                ? `ID: ${row.userId}`
                : null;
            const rowError = memberErrors[row.userId] ?? {};
            const splitError = rowError.splitPercent;
            const fixedError = rowError.fixedAmount;
            const splitErrorId = splitError ? `${baseId}-split-error-${rowIndex}` : undefined;
            const fixedErrorId = fixedError ? `${baseId}-fixed-error-${rowIndex}` : undefined;
            const splitDescribedBy = [splitHintId]
              .concat(percentWarningActive ? [percentWarningId] : [])
              .concat(splitErrorId ? [splitErrorId] : [])
              .join(" ")
              .trim();
            const fixedDescribedBy = [fixedHintId]
              .concat(overflowWarningActive ? [overflowWarningId] : [])
              .concat(fixedErrorId ? [fixedErrorId] : [])
              .join(" ")
              .trim();
            const formattedPerPeriod = Number.isFinite(row.perPeriod)
              ? formatCurrency(roundCurrency(row.perPeriod))
              : "—";

            return (
              <TableRow key={row.userId}>
                <th
                  scope="row"
                  id={rowLabelId}
                  className="px-4 py-3 text-sm font-semibold text-slate-900"
                >
                  <div className="space-y-1">
                    <p>{primaryLabel}</p>
                    {secondaryLabel ? (
                      <p className="text-xs font-medium text-slate-500">{secondaryLabel}</p>
                    ) : null}
                  </div>
                </th>
                <TableCell className="text-sm text-slate-600">
                  {row.role === "owner" ? "Owner" : "Collaborator"}
                </TableCell>
                <TableCell>
                  <Input
                    ref={registerInputRef(rowIndex, "split")}
                    value={row.splitPercent}
                    inputMode="decimal"
                    onChange={(event) => handleSplitChange(rowIndex, event.target.value)}
                    onKeyDown={(event) => handleCellKeyDown(event, rowIndex, "split")}
                    onBlur={() => {
                      void commitChanges();
                    }}
                    aria-labelledby={`${rowLabelId} ${splitHeaderId}`.trim()}
                    aria-describedby={splitDescribedBy.length > 0 ? splitDescribedBy : undefined}
                    aria-invalid={splitError ? "true" : undefined}
                    aria-readonly={canManageMembers ? undefined : "true"}
                    className={splitError ? "border-rose-400 focus-visible:ring-rose-500" : undefined}
                    placeholder="0"
                    readOnly={!canManageMembers}
                  />
                  {splitError ? (
                    <p id={splitErrorId} className="mt-1 text-xs text-rose-600">
                      {splitError}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Input
                    ref={registerInputRef(rowIndex, "fixed")}
                    value={row.fixedAmount}
                    inputMode="decimal"
                    onChange={(event) => handleFixedChange(rowIndex, event.target.value)}
                    onKeyDown={(event) => handleCellKeyDown(event, rowIndex, "fixed")}
                    onBlur={() => {
                      void commitChanges();
                    }}
                    aria-labelledby={`${rowLabelId} ${fixedHeaderId}`.trim()}
                    aria-describedby={fixedDescribedBy.length > 0 ? fixedDescribedBy : undefined}
                    aria-invalid={fixedError ? "true" : undefined}
                    aria-readonly={canManageMembers ? undefined : "true"}
                    className={fixedError ? "border-rose-400 focus-visible:ring-rose-500" : undefined}
                    placeholder="0"
                    readOnly={!canManageMembers}
                  />
                  {fixedError ? (
                    <p id={fixedErrorId} className="mt-1 text-xs text-rose-600">
                      {fixedError}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="font-medium text-slate-900">
                  {formattedPerPeriod}
                </TableCell>
                {showActions ? (
                  <TableCell className="text-right">
                    {row.role === "owner" ? (
                      <span className="text-sm text-slate-400">Owner</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-sm font-semibold text-rose-600 hover:bg-rose-50"
                        disabled={isRemovingMember}
                        onClick={() => requestRemoveMember(row.userId)}
                      >
                        Remove
                      </Button>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {(isSavingMembers || isPlanRefreshing) && canManageMembers ? (
        <p className="text-xs text-slate-500" role="status" aria-live="polite">
          {isSavingMembers ? "Saving changes…" : "Refreshing plan…"}
        </p>
      ) : null}

      {canManageMembers ? (
        <Dialog
          open={isInviteOpen}
          onClose={closeInvite}
          title="Invite a collaborator"
          description="Send an invite email to share this goal."
          footer={
            <>
              <Button type="button" variant="secondary" onClick={closeInvite}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="invite-collaborator-form"
                disabled={inviteStatus === "submitting"}
              >
                {inviteStatus === "submitting" ? "Sending…" : "Send invite"}
              </Button>
            </>
          }
        >
          <form
            id="invite-collaborator-form"
            className="space-y-4"
            onSubmit={(event) => {
              void handleInviteSubmit(event);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${baseId}-invite-email`}>Collaborator email</Label>
              <Input
                id={`${baseId}-invite-email`}
                type="email"
                value={inviteEmail}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setInviteEmail(nextValue);
                  if (inviteErrors.email) {
                    setInviteErrors((prev) => {
                      if (!prev.email) {
                        return prev;
                      }
                      const next = { ...prev };
                      delete next.email;
                      return next;
                    });
                  }
                }}
                required
                aria-describedby={[inviteHelperId, inviteStatusId, inviteEmailErrorId]
                  .filter(Boolean)
                  .join(" ") || undefined}
                aria-invalid={inviteEmailError ? "true" : undefined}
                className={inviteEmailError ? "border-rose-400 focus-visible:ring-rose-500" : undefined}
              />
              {inviteEmailError ? (
                <p id={inviteEmailErrorId} className="text-xs text-rose-600">
                  {inviteEmailError}
                </p>
              ) : null}
              <p id={inviteHelperId} className="text-xs text-slate-500">
                We’ll email an invite link.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${baseId}-invite-split`}>Default split %</Label>
                <Input
                  id={`${baseId}-invite-split`}
                  inputMode="decimal"
                  value={inviteSplit}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setInviteSplit(nextValue);
                    if (inviteErrors.defaultSplitPercent) {
                      setInviteErrors((prev) => {
                        if (!prev.defaultSplitPercent) {
                          return prev;
                        }
                        const next = { ...prev };
                        delete next.defaultSplitPercent;
                        return next;
                      });
                    }
                  }}
                  aria-describedby={inviteSplitErrorId ?? undefined}
                  aria-invalid={inviteSplitError ? "true" : undefined}
                  className={inviteSplitError ? "border-rose-400 focus-visible:ring-rose-500" : undefined}
                />
                {inviteSplitError ? (
                  <p id={inviteSplitErrorId} className="text-xs text-rose-600">
                    {inviteSplitError}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${baseId}-invite-fixed`}>Fixed amount (optional)</Label>
                <Input
                  id={`${baseId}-invite-fixed`}
                  inputMode="decimal"
                  value={inviteFixed}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setInviteFixed(nextValue);
                    if (inviteErrors.fixedAmount) {
                      setInviteErrors((prev) => {
                        if (!prev.fixedAmount) {
                          return prev;
                        }
                        const next = { ...prev };
                        delete next.fixedAmount;
                        return next;
                      });
                    }
                  }}
                  placeholder="0"
                  aria-describedby={inviteFixedErrorId ?? undefined}
                  aria-invalid={inviteFixedError ? "true" : undefined}
                  className={inviteFixedError ? "border-rose-400 focus-visible:ring-rose-500" : undefined}
                />
                {inviteFixedError ? (
                  <p id={inviteFixedErrorId} className="text-xs text-rose-600">
                    {inviteFixedError}
                  </p>
                ) : null}
              </div>
            </div>
            <p
              id={inviteStatusId}
              role="status"
              aria-live="polite"
              className={
                inviteMessage
                  ? inviteStatus === "error"
                    ? "text-sm text-rose-600"
                    : "whitespace-pre-line text-sm text-emerald-700"
                  : "sr-only"
              }
            >
              {inviteMessage ?? ""}
            </p>
          </form>
        </Dialog>
      ) : null}

      {canManageMembers ? (
        <ConfirmDialog
          open={pendingRemovalRow != null}
          onCancel={cancelRemoveMember}
          onConfirm={() => {
            void confirmRemoveMember();
          }}
          confirmLabel="Remove"
          loadingLabel="Removing…"
          tone="danger"
          isConfirming={isRemovingMember}
          title="Remove collaborator?"
          description="We’ll contact the server to revoke their access."
        >
          {pendingRemovalRow ? (
            <p>
              Are you sure you want to remove <span className="font-semibold">{removalDisplayName}</span>?
              If the server confirms the removal, they won’t be able to view or contribute to this goal anymore.
            </p>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

export default function GoalPlanPage(props: GoalPlanPageProps): JSX.Element {
  const { goalId, initialPlan = null, initialUser = null } = props;
  const { publish } = useToast();
  const [plan, setPlan] = useState<GoalPlanResponse | null>(initialPlan);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(initialPlan == null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(initialUser);
  const planAbortRef = useRef<AbortController | null>(null);

  const loadPlan = useCallback(async (options?: { silent?: boolean }) => {
    planAbortRef.current?.abort();
    const controller = new AbortController();
    planAbortRef.current = controller;

    const silent = options?.silent ?? false;

    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
        setError(null);
      }
      const payload = await fetchGoalPlan(goalId, controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      setPlan(payload);
      setError(null);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return;
      }
      if (isApiError(err)) {
        if (silent) {
          publish({
            title: "Refresh failed",
            description: err.message,
            variant: "error",
          });
        } else {
          setError(err.message);
        }
      } else {
        const message =
          (err as Error).message || "We couldn't load this goal plan. Try again later.";
        if (silent) {
          publish({
            title: "Refresh failed",
            description: message,
            variant: "error",
          });
        } else {
          setError(message);
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        if (silent) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
        planAbortRef.current = null;
      }
    }
  }, [goalId, publish]);

  useEffect(() => {
    if (initialPlan) {
      setPlan(initialPlan);
      setIsLoading(false);
      setError(null);

      return () => {
        planAbortRef.current?.abort();
      };
    }

    void loadPlan();

    return () => {
      planAbortRef.current?.abort();
    };
  }, [initialPlan, loadPlan]);

  useEffect(() => {
    if (initialUser) {
      return;
    }

    const controller = new AbortController();

    const fetchCurrentUser = async () => {
      try {
        const userData = await getCurrentUser(controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setCurrentUser(userData);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
      }
    };

    void fetchCurrentUser();

    return () => controller.abort();
  }, [initialUser]);

  const { formatCurrency, formatPercent, formatHorizon, formatDate } = useFormatters({
    currency: plan?.goal.currency,
  });

  const baseScenario = useMemo(() => (plan ? calculateScenario(plan) : null), [plan]);

  if (isLoading) {
    return (
      <div className="space-y-10" aria-busy="true">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <CardSkeleton headerLines={2} bodyLines={4} />
        <CardSkeleton headerLines={2} bodyLines={6} />
        <TableSkeleton rowCount={5} columnCount={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Goal plan</p>
          <h1 className="text-3xl font-semibold text-slate-900">We hit a snag</h1>
        </header>
        <ErrorState
          description={error}
          retryLabel="Retry loading"
          onRetry={() => {
            void loadPlan();
          }}
        />
      </div>
    );
  }

  if (!plan || !baseScenario) {
    return (
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Goal plan</p>
          <h1 className="text-3xl font-semibold text-slate-900">Plan unavailable</h1>
        </header>
        <ErrorState
          title="Plan unavailable"
          description="We couldn’t find the details for this goal. It may have been removed or you may not have access."
          retryLabel="Refresh"
          onRetry={() => {
            void loadPlan();
          }}
        />
      </div>
    );
  }

  const assumptionRateLabel = formatPercent(plan.assumptions.expectedRate, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const chips = [
    { label: "Target date", value: formatDate(plan.goal.targetDate) },
    { label: "Currency", value: plan.goal.currency },
    {
      label: "Assumption",
      value: `Assumed ${assumptionRateLabel} / ${plan.assumptions.compounding}`,
    },
  ];

  const ownerId = plan.members.find((member) => member.role === "owner")?.userId ?? null;
  const canManageMembers =
    currentUser != null && ownerId != null && ownerId === currentUser.id;
  const showMembersSection = plan.goal.isShared || canManageMembers;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Goal plan</p>
          <h1 className="text-3xl font-semibold text-slate-900">{plan.goal.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Badge key={chip.label} variant="info">
              <span className="font-semibold">{chip.label}:</span>
              <span className="ml-1 font-medium">{chip.value}</span>
            </Badge>
          ))}
        </div>
      </header>

      <PlanWarnings warnings={plan.warnings} />

      <div className="space-y-10 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="space-y-6">
          <PlanSummaryCard
            plan={plan}
            formatCurrency={formatCurrency}
            formatPercent={formatPercent}
            formatDate={formatDate}
          />
          <TimelineNarrative
            plan={plan}
            formatCurrency={formatCurrency}
            formatPercent={formatPercent}
            formatDate={formatDate}
            formatHorizon={formatHorizon}
          />
          <ExplainSection
            plan={plan}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            formatPercent={formatPercent}
          />
          <SharedContributions
            plan={plan}
            formatCurrency={formatCurrency}
            formatPercent={formatPercent}
          />
        </div>

        <div className="space-y-6">
          <ChartSection
            plan={plan}
            scenario={baseScenario}
            formatCurrency={formatCurrency}
            formatPercent={formatPercent}
          />
          <ScenarioCompare
            plan={plan}
            baseScenario={baseScenario}
            formatCurrency={formatCurrency}
            formatPercent={formatPercent}
            formatDate={formatDate}
            onReset={() => loadPlan({ silent: true })}
            isResetting={isRefreshing}
          />
        </div>
      </div>

      {showMembersSection ? (
        <MembersSection
          goalId={goalId}
          members={plan.members}
          totalPerPeriod={plan.totals.perPeriod}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          canManageMembers={canManageMembers}
          onMembersUpdated={() => loadPlan({ silent: true })}
          isPlanRefreshing={isRefreshing}
        />
      ) : null}
    </div>
  );
}
