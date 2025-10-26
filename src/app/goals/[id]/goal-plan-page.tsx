"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
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
import { cn } from "@/lib/utils";

type ContributionFrequency = GoalPlanResponse["assumptions"]["contributionFrequency"];
type CompoundingFrequency = GoalPlanResponse["assumptions"]["compounding"];

interface GoalPlanPageProps {
  goalId: string;
  initialPlan?: GoalPlanResponse | null;
  initialUser?: AuthUser | null;
}

interface ScenarioOptions {
  ratePercent?: number;
  timelineOffsetMonths?: number;
}

interface ScenarioMetrics {
  perPeriod: number;
  lumpSum: number;
  contributionsTotal: number;
  growthTotal: number;
  contributionPercent: number;
  growthPercent: number;
  periodCount: number;
  targetDate: Date;
  years: number;
  months: number;
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

  return {
    perPeriod,
    lumpSum,
    contributionsTotal,
    growthTotal,
    contributionPercent,
    growthPercent,
    periodCount: totalPeriods,
    targetDate: adjustedTargetDate,
    years: breakdown.years,
    months: breakdown.months,
    ratePercent,
  };
};

const PlanSummaryCard = (props: {
  plan: GoalPlanResponse;
  formatCurrency: (
    value: number,
    currencyOverride?: string,
    options?: Intl.NumberFormatOptions,
  ) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
}) => {
  const { plan, formatCurrency, formatPercent } = props;
  const periodLabel = frequencyToLabel(plan.assumptions.contributionFrequency);

  const targetAmountLabel = formatCurrency(plan.goal.targetAmount);
  const expectedReturnLabel = formatPercent(plan.assumptions.expectedRate, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  const perPeriodValue = Number.isFinite(plan.totals.perPeriod)
    ? formatCurrency(roundCurrency(plan.totals.perPeriod))
    : null;
  const lumpSumValue = Number.isFinite(plan.totals.lumpSumNow)
    ? formatCurrency(roundCurrency(plan.totals.lumpSumNow))
    : null;
  const existingSavingsValue = plan.goal.existingSavings > 0
    ? formatCurrency(roundCurrency(plan.goal.existingSavings))
    : null;

  const perPeriodLabel = perPeriodValue ? `${perPeriodValue} per ${periodLabel}` : "—";
  const lumpSumLabel = lumpSumValue ?? "—";

  return (
    <Card className="rounded-2xl border border-border/50 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Plan summary
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Current plan snapshot</h2>
        </header>

        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium uppercase text-muted-foreground">Goal info</h3>
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-sm font-medium text-muted-foreground">Target amount</span>
              <span className="text-lg font-semibold text-primary">{targetAmountLabel}</span>
              {existingSavingsValue ? (
                <Fragment>
                  <span className="text-sm font-medium text-muted-foreground">Existing savings</span>
                  <span className="text-lg font-semibold text-primary">{existingSavingsValue}</span>
                </Fragment>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
            <h3 className="text-sm font-medium uppercase text-muted-foreground">Contribution</h3>
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-sm font-medium text-muted-foreground">Required contribution</span>
              <span className="text-lg font-semibold text-primary">{perPeriodLabel}</span>
              <span className="text-sm font-medium text-muted-foreground">Lump-sum equivalent</span>
              <span className="text-lg font-semibold text-primary">{lumpSumLabel}</span>
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
            <h3 className="text-sm font-medium uppercase text-muted-foreground">Returns</h3>
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-sm font-medium text-muted-foreground">Expected return / year</span>
              <span className="text-lg font-semibold text-primary">{expectedReturnLabel}</span>
            </div>
          </div>
        </div>
      </div>
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
  formatCurrency: (
    value: number,
    currencyOverride?: string,
    options?: Intl.NumberFormatOptions,
  ) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatHorizon: (input: { years?: number; months?: number; totalMonths?: number } | number) => string;
  onReset: () => Promise<void> | void;
  isResetting: boolean;
}) => {
  const { plan, baseScenario, formatCurrency, formatPercent, formatHorizon, onReset, isResetting } = props;
  const { publish } = useToast();
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

  const minAdjustment = -36;
  const maxAdjustment = 36;
  const periodLabel = frequencyToLabel(plan.assumptions.contributionFrequency);

  const isInfeasible = !Number.isFinite(adjustedScenario.perPeriod) || adjustedScenario.perPeriod <= 0;

  const baseReturnLabel = formatPercent(baseScenario.ratePercent, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  const adjustedReturnLabel = formatPercent(ratePercent, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });

  const basePerPeriodValue = Number.isFinite(plan.totals.perPeriod)
    ? roundCurrency(plan.totals.perPeriod)
    : null;
  const adjustedPerPeriodValue = Number.isFinite(adjustedScenario.perPeriod)
    ? roundCurrency(adjustedScenario.perPeriod)
    : null;

  const toPerPeriodLabel = (value: number | null) => {
    if (value == null) {
      return "—";
    }

    const suffix = periodLabel === "month" ? "mo" : "yr";
    return `${formatCurrency(value)} / ${suffix}`;
  };

  const basePerPeriodLabel = toPerPeriodLabel(basePerPeriodValue);
  const adjustedPerPeriodLabel = isInfeasible ? "—" : toPerPeriodLabel(adjustedPerPeriodValue);

  const baseDurationLabel = formatHorizon({
    years: plan.horizon.years,
    months: plan.horizon.months,
  });
  const adjustedDurationLabel = formatHorizon({
    years: adjustedScenario.years,
    months: adjustedScenario.months,
  });

  const offsetLabel = timelineOffsetMonths === 0
    ? "On schedule"
    : `${timelineOffsetMonths > 0 ? "+" : "−"}${formatHorizon({ totalMonths: Math.abs(timelineOffsetMonths) })}`;

  const firstUpdateRef = useRef(true);
  const lastFeasibleRef = useRef<boolean | null>(null);
  const lastPerPeriodRef = useRef<number | null>(null);

  useEffect(() => {
    if (firstUpdateRef.current) {
      firstUpdateRef.current = false;
      lastFeasibleRef.current = !isInfeasible;
      lastPerPeriodRef.current = adjustedPerPeriodValue ?? null;
      return;
    }

    if (isInfeasible) {
      if (lastFeasibleRef.current !== false) {
        publish({
          title: "Adjustment needs changes",
          description: "This combination can’t reach the target. Try easing the date or return.",
          variant: "error",
        });
      }
      lastFeasibleRef.current = false;
      lastPerPeriodRef.current = null;
      return;
    }

    if (adjustedPerPeriodValue != null && adjustedPerPeriodValue !== lastPerPeriodRef.current) {
      publish({
        title: "Comparison updated",
        description: `${formatCurrency(adjustedPerPeriodValue)} per ${periodLabel} required under this tweak.`,
        variant: "success",
      });
      lastPerPeriodRef.current = adjustedPerPeriodValue;
    }

    lastFeasibleRef.current = true;
  }, [adjustedPerPeriodValue, formatCurrency, isInfeasible, periodLabel, publish]);

  const handleReset = () => {
    setRatePercent(baseScenario.ratePercent);
    setTimelineOffsetMonths(0);
    lastFeasibleRef.current = null;
    lastPerPeriodRef.current = null;
    void onReset();
  };

  return (
    <motion.section
      layout
      transition={{ duration: 0.3, ease: "easeInOut" }}
      aria-labelledby="quick-tweaks-title"
      className="space-y-6"
    >
      <Card className="rounded-2xl border border-border/50 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <header className="space-y-2">
            <p
              id="quick-tweaks-title"
              className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Compare with Quick Tweaks
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Adjust assumptions in real time
            </h2>
          </header>

          <div className="space-y-6" aria-live="polite">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="quick-tweaks-rate" className="text-sm font-medium text-muted-foreground">
                  Expected return (% per year)
                </label>
                <span className="text-sm font-semibold text-slate-900">{adjustedReturnLabel}</span>
              </div>
              <input
                id="quick-tweaks-rate"
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={ratePercent}
                onChange={(event) => setRatePercent(Number(event.target.value))}
                className="h-2 w-full cursor-pointer rounded-full bg-slate-200 accent-primary-600"
                aria-describedby="quick-tweaks-rate-hint"
              />
              <div id="quick-tweaks-rate-hint" className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>20%</span>
              </div>
            </div>

            <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
              <div className="flex items-center justify-between">
                <label htmlFor="quick-tweaks-timeline" className="text-sm font-medium text-muted-foreground">
                  Target date offset
                </label>
                <span className="text-sm font-semibold text-slate-900">{offsetLabel}</span>
              </div>
              <input
                id="quick-tweaks-timeline"
                type="range"
                min={minAdjustment}
                max={maxAdjustment}
                step={3}
                value={timelineOffsetMonths}
                onChange={(event) => setTimelineOffsetMonths(Number(event.target.value))}
                className="h-2 w-full cursor-pointer rounded-full bg-slate-200 accent-primary-600"
                aria-describedby="quick-tweaks-timeline-hint"
              />
              <div id="quick-tweaks-timeline-hint" className="flex justify-between text-xs text-muted-foreground">
                <span>−3 yrs</span>
                <span>On track</span>
                <span>+3 yrs</span>
              </div>
            </div>

            <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
              <div className="overflow-hidden rounded-xl border border-border/50">
                <table className="min-w-full table-fixed">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-sm font-medium text-muted-foreground">
                      <th scope="col" className="px-4 py-3 font-medium">Setting</th>
                      <th scope="col" className="px-4 py-3 font-medium">Original</th>
                      <th scope="col" className="px-4 py-3 font-medium">Adjusted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-sm">
                    <tr className="text-slate-900">
                      <th scope="row" className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Expected return
                      </th>
                      <td className="px-4 py-3 text-lg font-semibold text-primary">{baseReturnLabel}</td>
                      <td className="px-4 py-3 text-lg font-semibold text-primary">{adjustedReturnLabel}</td>
                    </tr>
                    <tr className="text-slate-900">
                      <th scope="row" className="px-4 py-3 text-left font-medium text-muted-foreground">Duration</th>
                      <td className="px-4 py-3 text-lg font-semibold text-primary">{baseDurationLabel}</td>
                      <td className="px-4 py-3 text-lg font-semibold text-primary">{adjustedDurationLabel}</td>
                    </tr>
                    <tr className="text-slate-900">
                      <th scope="row" className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Required investment
                      </th>
                      <td className="px-4 py-3 text-lg font-semibold text-primary">{basePerPeriodLabel}</td>
                      <td className="px-4 py-3 text-lg font-semibold text-primary">{adjustedPerPeriodLabel}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={handleReset} disabled={isResetting}>
                {isResetting ? "Resetting…" : "Reset to original"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.section>
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
    const pathLength = issue.path.length;
    const field = pathLength > 0 ? issue.path[pathLength - 1] : undefined;
    if (field === "email" || field === "defaultSplitPercent" || field === "fixedAmount") {
      errors[field] = errors[field] ?? issue.message;
      return;
    }

    generalMessages.push(issue.message);
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
  const inviteModeHelperId = `${baseId}-invite-mode-helper`;

  const composeAriaDescribedBy = (...ids: (string | undefined)[]) => {
    const value = ids.filter(Boolean).join(" ");
    return value.length > 0 ? value : undefined;
  };

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

  const tableDescribedBy = composeAriaDescribedBy(
    sectionDescriptionId,
    percentWarningActive ? percentWarningId : undefined,
    overflowWarningActive ? overflowWarningId : undefined,
  );

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
  const [inviteMode, setInviteMode] = useState<"percent" | "fixed">("percent");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteErrors, setInviteErrors] = useState<InviteFieldErrors>({});
  const inviteEmailRef = useRef<HTMLInputElement | null>(null);
  const inviteSplitRef = useRef<HTMLInputElement | null>(null);
  const inviteFixedRef = useRef<HTMLInputElement | null>(null);

  const getInviteDefaultSplit = () => {
    const remainingPercent = Math.max(0, 100 - computation.percentSum);
    const defaultSplit =
      computation.percentEligibleCount > 0 && remainingPercent > 0 ? remainingPercent : 50;
    return clamp(defaultSplit, 0, 100).toFixed(1);
  };

  const openInvite = () => {
    setInviteSplit(getInviteDefaultSplit());
    setInviteFixed("");
    setInviteMode("percent");
    setInviteErrors({});
    setInviteStatus("idle");
    setInviteMessage(null);
    setIsInviteOpen(true);
  };

  const closeInvite = () => {
    setIsInviteOpen(false);
    setInviteEmail("");
    setInviteFixed("");
    setInviteSplit(getInviteDefaultSplit());
    setInviteMode("percent");
    setInviteStatus("idle");
    setInviteMessage(null);
    setInviteErrors({});
  };

  useEffect(() => {
    if (!isInviteOpen) {
      return;
    }

    const id = requestAnimationFrame(() => {
      inviteEmailRef.current?.focus({ preventScroll: true });
      inviteEmailRef.current?.select?.();
    });

    return () => cancelAnimationFrame(id);
  }, [isInviteOpen]);

  const focusActiveInviteField = () => {
    if (!isInviteOpen) {
      return;
    }

    const target = inviteMode === "percent" ? inviteSplitRef.current : inviteFixedRef.current;
    if (target && !target.disabled) {
      requestAnimationFrame(() => {
        target.focus({ preventScroll: true });
        target.select?.();
      });
    }
  };

  const focusInviteEmailField = () => {
    if (!isInviteOpen) {
      return;
    }

    requestAnimationFrame(() => {
      inviteEmailRef.current?.focus({ preventScroll: true });
      inviteEmailRef.current?.select?.();
    });
  };

  const handleInviteModeChange = (mode: "percent" | "fixed") => {
    if (mode === inviteMode) {
      requestAnimationFrame(() => {
        if (mode === "percent") {
          inviteSplitRef.current?.focus({ preventScroll: true });
          inviteSplitRef.current?.select?.();
        } else {
          inviteFixedRef.current?.focus({ preventScroll: true });
          inviteFixedRef.current?.select?.();
        }
      });
      return;
    }

    setInviteMode(mode);
    setInviteStatus((prev) => (prev === "error" ? "idle" : prev));
    setInviteMessage((prev) => (prev?.startsWith("✅") ? prev : null));
    setInviteErrors((prev) => {
      if (!prev.defaultSplitPercent && !prev.fixedAmount) {
        return prev;
      }
      const next = { ...prev };
      delete next.defaultSplitPercent;
      delete next.fixedAmount;
      return next;
    });

    if (mode === "percent") {
      setInviteSplit((current) => (current.trim().length > 0 ? current : getInviteDefaultSplit()));
      setInviteFixed("");
    } else {
      setInviteFixed((current) => current.trim().length > 0 ? current : "");
      setInviteSplit("");
    }

    requestAnimationFrame(() => {
      const target = mode === "percent" ? inviteSplitRef.current : inviteFixedRef.current;
      target?.focus({ preventScroll: true });
      target?.select?.();
    });
  };

  const handleInviteModeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    mode: "percent" | "fixed",
  ) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      handleInviteModeChange("percent");
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      handleInviteModeChange("fixed");
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleInviteModeChange(mode);
    }
  };

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageMembers) {
      return;
    }

    setInviteStatus("submitting");
    setInviteMessage(null);
    setInviteErrors({});
    focusInviteEmailField();

    const trimmedSplit = inviteSplit.trim();
    const trimmedFixed = inviteFixed.trim();

    if (inviteMode === "percent" && trimmedSplit.length === 0) {
      setInviteStatus("error");
      setInviteErrors({ defaultSplitPercent: "Enter a default percentage to continue." });
      focusActiveInviteField();
      return;
    }

    if (inviteMode === "fixed" && trimmedFixed.length === 0) {
      setInviteStatus("error");
      setInviteErrors({ fixedAmount: "Enter a fixed amount to continue." });
      focusActiveInviteField();
      return;
    }

    try {
      const candidate = {
        email: inviteEmail,
        defaultSplitPercent:
          inviteMode === "percent" && trimmedSplit.length > 0 ? trimmedSplit : undefined,
        fixedAmount: inviteMode === "fixed" && trimmedFixed.length > 0 ? trimmedFixed : null,
      };

      const validation = CreateGoalInviteInputSchema.safeParse(candidate);

      if (!validation.success) {
        const normalized = normalizeZodIssues(validation.error.issues);
        const { errors, generalMessages } = mapInviteIssues(normalized);

        const hasFieldErrors = Object.keys(errors).length > 0;
        if (hasFieldErrors) {
          setInviteErrors(errors);
        }

        const message =
          generalMessages[0] ??
          (Object.keys(errors).length > 0
            ? "Please fix the highlighted fields before sending."
            : "We couldn't send that invite. Check the details and try again.");

        setInviteStatus("error");
        setInviteMessage(message);
        const activeContributionError =
          inviteMode === "percent" ? errors.defaultSplitPercent : errors.fixedAmount;
        if (errors.email) {
          focusInviteEmailField();
        } else if (activeContributionError) {
          focusActiveInviteField();
        } else if (hasFieldErrors) {
          focusInviteEmailField();
        } else {
          focusInviteEmailField();
        }
        return;
      }

      const parsedInput = validation.data;
      setInviteEmail(parsedInput.email);

      const payload = await sendGoalInvite(goalId, parsedInput);

      const successMessage =
        payload?.inviteUrl != null
          ? `✅ Invitation sent successfully.\nShare this link if needed:\n${payload.inviteUrl}`
          : "✅ Invitation sent successfully.";

      setInviteStatus("success");
      setInviteMessage(successMessage);
      setInviteErrors({});
      setInviteEmail("");
      setInviteSplit(getInviteDefaultSplit());
      setInviteFixed("");
      publish({
        title: "Invitation ready",
        description:
          payload?.inviteUrl != null
            ? "Share the invite link with your collaborator."
            : "We emailed your collaborator a link to join.",
        variant: "success",
      });
      focusInviteEmailField();
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
            const activeContributionError =
              inviteMode === "percent" ? errors.defaultSplitPercent : errors.fixedAmount;
            if (activeContributionError) {
              focusActiveInviteField();
            } else {
              focusInviteEmailField();
            }
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
            focusInviteEmailField();
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
        focusInviteEmailField();
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
      focusInviteEmailField();
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
  const isPercentMode = inviteMode === "percent";
  const isFixedMode = inviteMode === "fixed";
  const inviteSplitError = isPercentMode ? inviteErrors.defaultSplitPercent : undefined;
  const inviteFixedError = isFixedMode ? inviteErrors.fixedAmount : undefined;
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
                ref={inviteEmailRef}
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
                aria-describedby={composeAriaDescribedBy(
                  inviteHelperId,
                  inviteStatusId,
                  inviteEmailErrorId,
                )}
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
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-slate-900">Contribution type</legend>
              <div
                className="grid grid-cols-2 gap-2"
                role="radiogroup"
                aria-describedby={inviteModeHelperId}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={isPercentMode}
                  onClick={() => handleInviteModeChange("percent")}
                  onKeyDown={(event) => handleInviteModeKeyDown(event, "percent")}
                  className={cn(
                    "w-full rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isPercentMode
                      ? "border-primary-200 bg-primary-50 text-primary-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:text-slate-900",
                  )}
                >
                  Percentage
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isFixedMode}
                  onClick={() => handleInviteModeChange("fixed")}
                  onKeyDown={(event) => handleInviteModeKeyDown(event, "fixed")}
                  className={cn(
                    "w-full rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isFixedMode
                      ? "border-primary-200 bg-primary-50 text-primary-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:text-slate-900",
                  )}
                >
                  Fixed amount
                </button>
              </div>
              <p id={inviteModeHelperId} className="text-xs text-slate-500">
                Enter either a percentage or a fixed amount, not both.
              </p>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${baseId}-invite-split`}>Default split %</Label>
                <Input
                  id={`${baseId}-invite-split`}
                  inputMode="decimal"
                  ref={inviteSplitRef}
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
                  disabled={!isPercentMode}
                  aria-describedby={composeAriaDescribedBy(inviteModeHelperId, inviteSplitErrorId)}
                  aria-invalid={isPercentMode && inviteSplitError ? "true" : undefined}
                  className={cn(
                    !isPercentMode && "border-slate-200 text-slate-400",
                    inviteSplitError && "border-rose-400 focus-visible:ring-rose-500",
                  )}
                />
                {inviteSplitError ? (
                  <p id={inviteSplitErrorId} className="text-xs text-rose-600">
                    {inviteSplitError}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${baseId}-invite-fixed`}>Fixed amount</Label>
                <Input
                  id={`${baseId}-invite-fixed`}
                  inputMode="decimal"
                  ref={inviteFixedRef}
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
                  disabled={!isFixedMode}
                  aria-describedby={composeAriaDescribedBy(inviteModeHelperId, inviteFixedErrorId)}
                  aria-invalid={isFixedMode && inviteFixedError ? "true" : undefined}
                  className={cn(
                    !isFixedMode && "border-slate-200 text-slate-400",
                    inviteFixedError && "border-rose-400 focus-visible:ring-rose-500",
                  )}
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

      <PlanSummaryCard plan={plan} formatCurrency={formatCurrency} formatPercent={formatPercent} />

      <SharedContributions
        plan={plan}
        formatCurrency={formatCurrency}
        formatPercent={formatPercent}
      />

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

      <ScenarioCompare
        plan={plan}
        baseScenario={baseScenario}
        formatCurrency={formatCurrency}
        formatPercent={formatPercent}
        formatHorizon={formatHorizon}
        onReset={() => loadPlan({ silent: true })}
        isResetting={isRefreshing}
      />
    </div>
  );
}
