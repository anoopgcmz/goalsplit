"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { GoalPlanResponse } from "@/app/api/goals/schemas";
import {
  netTargetAfterExisting,
  requiredLumpSumForFutureValue,
  requiredPaymentForFutureValue,
} from "@/lib/financial";

type ContributionFrequency = GoalPlanResponse["assumptions"]["contributionFrequency"];
type CompoundingFrequency = GoalPlanResponse["assumptions"]["compounding"];

interface GoalPlanPageProps {
  goalId: string;
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

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);

const ScenarioValue = (props: { label: string; value: string; secondary?: string }) => {
  const { label, value, secondary } = props;

  return (
    <div>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      {secondary ? (
        <p className="text-sm text-slate-500">{secondary}</p>
      ) : null}
    </div>
  );
};

const ChartSection = (props: {
  plan: GoalPlanResponse;
  scenario: ScenarioMetrics;
  formatCurrency: (value: number) => string;
}) => {
  const { plan, scenario, formatCurrency } = props;
  const periodLabel = frequencyToLabel(plan.assumptions.contributionFrequency);
  const chartId = "goal-plan-chart";

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
                <path d={`${pathData}`} fill="none" stroke="#1d4ed8" strokeWidth="1.5" />
                <path
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
              {scenario.contributionPercent.toFixed(1)}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>
              Growth: {formatCurrency(roundCurrency(scenario.growthTotal))} (
              {scenario.growthPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

const PlanSummaryCard = (props: {
  plan: GoalPlanResponse;
  scenario: ScenarioMetrics;
  formatCurrency: (value: number) => string;
}) => {
  const { plan, scenario, formatCurrency } = props;
  const periodLabel = frequencyToLabel(plan.assumptions.contributionFrequency);
  const perPeriodDisplay = Number.isFinite(scenario.perPeriod)
    ? formatCurrency(roundCurrency(scenario.perPeriod))
    : "Not available";
  const lumpSumDisplay = Number.isFinite(scenario.lumpSum)
    ? formatCurrency(roundCurrency(scenario.lumpSum))
    : "Not available";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
              Plan summary
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">What it takes</h2>
          </div>
          <p className="text-sm text-slate-500">
            Horizon: {scenario.years} {scenario.years === 1 ? "year" : "years"} &bull; {scenario.months}{" "}
            {scenario.months === 1 ? "month" : "months"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-sm font-medium text-slate-600">Invest per {periodLabel}</p>
          <p className="text-4xl font-semibold text-slate-900">{perPeriodDisplay}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">Lump sum today</p>
          <p className="text-lg font-semibold text-slate-900">{lumpSumDisplay}</p>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="font-medium text-slate-900">Your contributions vs growth</div>
        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
          <span>
            Contributions: {formatCurrency(roundCurrency(scenario.contributionsTotal))} (
            {scenario.contributionPercent.toFixed(1)}%)
          </span>
          <span>
            Growth: {formatCurrency(roundCurrency(scenario.growthTotal))} (
            {scenario.growthPercent.toFixed(1)}%)
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};

const ScenarioCompare = (props: {
  plan: GoalPlanResponse;
  baseScenario: ScenarioMetrics;
  formatCurrency: (value: number) => string;
}) => {
  const { plan, baseScenario, formatCurrency } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [ratePercent, setRatePercent] = useState(baseScenario.ratePercent);
  const [timelineOffsetMonths, setTimelineOffsetMonths] = useState(0);

  const adjustedScenario = useMemo(
    () => calculateScenario(plan, { ratePercent, timelineOffsetMonths }),
    [plan, ratePercent, timelineOffsetMonths],
  );

  const baseTargetDate = new Date(plan.goal.targetDate);
  const minAdjustment = -Math.round((plan.horizon.totalPeriods / plan.horizon.nPerYear) * 12);
  const maxAdjustment = 240; // allow extending by up to 20 years

  const handleTimelineChange = (delta: number) => {
    setTimelineOffsetMonths((prev) => clamp(prev + delta, minAdjustment, maxAdjustment));
  };

  return (
    <section className="space-y-4" aria-labelledby="scenario-compare-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="scenario-compare-title" className="text-lg font-semibold text-slate-900">
            Scenario comparison
          </h2>
          <p className="text-sm text-slate-600">
            Explore how changing your assumptions affects contributions.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls="scenario-controls"
        >
          {isOpen ? "Hide compare" : "Compare scenarios"}
        </Button>
      </div>

      {isOpen ? (
        <div
          id="scenario-controls"
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label htmlFor="rate-slider" className="flex items-center justify-between text-sm font-medium text-slate-700">
                  <span>Expected return rate</span>
                  <span>{ratePercent.toFixed(1)}%</span>
                </label>
                <input
                  id="rate-slider"
                  type="range"
                  min={0}
                  max={20}
                  step={0.5}
                  value={ratePercent}
                  onChange={(event) => setRatePercent(Number(event.target.value))}
                  className="mt-2 w-full"
                  aria-valuemin={0}
                  aria-valuemax={20}
                  aria-valuenow={ratePercent}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Adjust the annual return percentage to see new projections.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Timeline adjustment</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={() => handleTimelineChange(-12)} variant="secondary">
                    −12 months
                  </Button>
                  <Button type="button" onClick={() => handleTimelineChange(12)} variant="secondary">
                    +12 months
                  </Button>
                  <Button type="button" onClick={() => handleTimelineChange(-1)} variant="secondary">
                    −1 month
                  </Button>
                  <Button type="button" onClick={() => handleTimelineChange(1)} variant="secondary">
                    +1 month
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="timeline-input" className="text-sm text-slate-600">
                    Offset (months)
                  </label>
                  <input
                    id="timeline-input"
                    type="number"
                    value={timelineOffsetMonths}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setTimelineOffsetMonths(clamp(next, minAdjustment, maxAdjustment));
                    }}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Current target: {formatDate(baseTargetDate)}. Adjustment moves this date to {formatDate(adjustedScenario.targetDate)}.
                </p>
              </div>
            </div>

            <div className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Compare numbers</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Original</p>
                  <ScenarioValue
                    label={`Invest per ${frequencyToLabel(plan.assumptions.contributionFrequency)}`}
                    value={
                      Number.isFinite(baseScenario.perPeriod)
                        ? formatCurrency(roundCurrency(baseScenario.perPeriod))
                        : "Not available"
                    }
                    secondary={`Rate ${baseScenario.ratePercent.toFixed(1)}% • Horizon ${baseScenario.years}y ${baseScenario.months}m`}
                  />
                  <ScenarioValue
                    label="Lump sum today"
                    value={
                      Number.isFinite(baseScenario.lumpSum)
                        ? formatCurrency(roundCurrency(baseScenario.lumpSum))
                        : "Not available"
                    }
                    secondary={`Target ${formatDate(new Date(plan.goal.targetDate))}`}
                  />
                  <ScenarioValue
                    label="Your contributions"
                    value={formatCurrency(roundCurrency(baseScenario.contributionsTotal))}
                    secondary={`${baseScenario.contributionPercent.toFixed(1)}% of goal`}
                  />
                  <ScenarioValue
                    label="Projected growth"
                    value={formatCurrency(roundCurrency(baseScenario.growthTotal))}
                    secondary={`${baseScenario.growthPercent.toFixed(1)}% of goal`}
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Adjusted</p>
                  <ScenarioValue
                    label={`Invest per ${frequencyToLabel(plan.assumptions.contributionFrequency)}`}
                    value={
                      Number.isFinite(adjustedScenario.perPeriod)
                        ? formatCurrency(roundCurrency(adjustedScenario.perPeriod))
                        : "Not available"
                    }
                    secondary={`Rate ${adjustedScenario.ratePercent.toFixed(1)}% • Horizon ${adjustedScenario.years}y ${adjustedScenario.months}m`}
                  />
                  <ScenarioValue
                    label="Lump sum today"
                    value={
                      Number.isFinite(adjustedScenario.lumpSum)
                        ? formatCurrency(roundCurrency(adjustedScenario.lumpSum))
                        : "Not available"
                    }
                    secondary={`Target ${formatDate(adjustedScenario.targetDate)}`}
                  />
                  <ScenarioValue
                    label="Your contributions"
                    value={formatCurrency(roundCurrency(adjustedScenario.contributionsTotal))}
                    secondary={`${adjustedScenario.contributionPercent.toFixed(1)}% of goal`}
                  />
                  <ScenarioValue
                    label="Projected growth"
                    value={formatCurrency(roundCurrency(adjustedScenario.growthTotal))}
                    secondary={`${adjustedScenario.growthPercent.toFixed(1)}% of goal`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default function GoalPlanPage(props: GoalPlanPageProps): JSX.Element {
  const { goalId } = props;
  const [plan, setPlan] = useState<GoalPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchPlan = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/goals/${goalId}/plan`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("We couldn't load this goal plan. Try again later.");
        }

        const payload = (await response.json()) as GoalPlanResponse;
        setPlan(payload);
        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchPlan();

    return () => controller.abort();
  }, [goalId]);

  const formatter = useMemo(() => {
    if (!plan) {
      return (value: number) => value.toLocaleString();
    }

    return (value: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: plan.goal.currency,
        maximumFractionDigits: 2,
      }).format(value);
  }, [plan]);

  const baseScenario = useMemo(() => (plan ? calculateScenario(plan) : null), [plan]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Goal plan</p>
          <h1 className="text-3xl font-semibold text-slate-900">Loading goal plan…</h1>
        </header>
        <p className="text-sm text-slate-600">Fetching projection details for this goal.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Goal plan</p>
          <h1 className="text-3xl font-semibold text-slate-900">We hit a snag</h1>
        </header>
        <p className="text-sm text-slate-600">{error}</p>
      </div>
    );
  }

  if (!plan || !baseScenario) {
    return (
      <div className="space-y-4">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Goal plan</p>
          <h1 className="text-3xl font-semibold text-slate-900">Plan unavailable</h1>
        </header>
          <p className="text-sm text-slate-600">
            We couldn&apos;t find the details for this goal. It may have been removed or you may not have access.
          </p>
      </div>
    );
  }

  const chips = [
    { label: "Target date", value: formatDate(new Date(plan.goal.targetDate)) },
    { label: "Currency", value: plan.goal.currency },
    {
      label: "Assumption",
      value: `Assumed ${plan.assumptions.expectedRate.toFixed(1)}% / ${plan.assumptions.compounding}`,
    },
  ];

  const formatCurrency = (value: number) => formatter(value);

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

      <PlanSummaryCard plan={plan} scenario={baseScenario} formatCurrency={formatCurrency} />

      <ChartSection plan={plan} scenario={baseScenario} formatCurrency={formatCurrency} />

      <ScenarioCompare plan={plan} baseScenario={baseScenario} formatCurrency={formatCurrency} />
    </div>
  );
}
