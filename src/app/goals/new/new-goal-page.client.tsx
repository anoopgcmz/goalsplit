"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  type ContributionFrequency,
  buildCreatePayload,
  currencies,
  defaultState,
  detectDefaultCurrency,
  extractFieldErrors,
  type FormErrors,
  type FormState,
  type TouchedState,
  validateForm,
} from "@/features/goals/goal-form";
import { createGoal } from "@/lib/api/goals";
import { ApiError as HttpApiError } from "@/lib/http";
import {
  yearFractionFromDates,
  netTargetAfterExisting,
  requiredPaymentForFutureValue,
  type CompoundingFrequency,
} from "@/lib/financial";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function NewGoalPage(): JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => ({
    ...defaultState,
    currency: detectDefaultCurrency(),
  }));
  const [touched, setTouched] = useState<TouchedState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiErrors, setApiErrors] = useState<FormErrors>({});
  const { publish } = useToast();

  const errors = useMemo(() => {
    const baseErrors = validateForm(state);
    const merged: FormErrors = { ...baseErrors };

    (Object.keys(apiErrors) as (keyof FormState)[]).forEach((field) => {
      const message = apiErrors[field];
      if (message) {
        merged[field] = message;
      }
    });

    return merged;
  }, [state, apiErrors]);

  const showError = (field: keyof FormState) => Boolean(touched[field] && errors[field]);

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value;
    setState((prev) => ({ ...prev, [field]: value }));
    setApiErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }

      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleRadioChange = (field: "contributionFrequency", value: ContributionFrequency) => {
    setState((prev) => ({ ...prev, [field]: value }));
    setApiErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }

      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleBlur = (field: keyof FormState) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const RETURN_PRESETS = [
    { label: "Conservative", description: "~6%", value: "6" },
    { label: "Moderate", description: "~10%", value: "10" },
    { label: "Aggressive", description: "~14%", value: "14" },
  ] as const;

  const handlePresetClick = (value: string) => {
    setState((prev) => ({ ...prev, expectedReturn: value }));
    setTouched((prev) => ({ ...prev, expectedReturn: true }));
  };

  const investmentProjection = useMemo(() => {
    const targetAmount = parseFloat(state.targetAmount);
    const rate = parseFloat(state.expectedReturn);
    const existing = parseFloat(state.existingSavings || "0") || 0;

    if (!state.targetDate || isNaN(targetAmount) || targetAmount <= 0 || isNaN(rate) || rate < 0) {
      return null;
    }

    const now = new Date();
    const targetDate = new Date(state.targetDate);
    const tYears = yearFractionFromDates(now, targetDate);

    if (tYears <= 0) return null;

    const compoundN: CompoundingFrequency = state.compounding === "monthly" ? 12 : 1;
    const contribN: CompoundingFrequency = state.contributionFrequency === "monthly" ? 12 : 1;
    const netTarget = netTargetAfterExisting(targetAmount, existing, rate, compoundN, tYears);
    const payment = requiredPaymentForFutureValue(netTarget, rate, contribN, tYears);

    return { payment: isFinite(payment) && payment > 0 ? payment : null, tYears };
  }, [state.targetAmount, state.expectedReturn, state.existingSavings, state.targetDate, state.compounding, state.contributionFrequency]);

  const isComplete =
    state.title.trim().length > 0 &&
    state.targetAmount.trim().length > 0 &&
    state.currency.trim().length > 0 &&
    state.targetDate.trim().length > 0 &&
    state.expectedReturn.trim().length > 0;

  const hasErrors = Object.values(errors).some((error) => Boolean(error));
  const canSubmit = isComplete && !hasErrors;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (!canSubmit) {
      setTouched(
        Object.keys(defaultState).reduce<TouchedState>((acc, key) => {
          acc[key as keyof FormState] = true;
          return acc;
        }, {}),
      );
      return;
    }

    setIsSubmitting(true);
    setApiErrors({});

    const payload = buildCreatePayload(state);

    const submit = async () => {
      try {
        const goal = await createGoal(payload);

        publish({
          title: "Goal created",
          description: "We saved your goal setup. You can refine the plan anytime.",
          variant: "success",
        });
        router.replace(`/goals/${goal.id}`);
      } catch (error) {
        if (error instanceof HttpApiError) {
          if (error.status === 422) {
            const fieldErrors = extractFieldErrors(error.details);

            if (Object.keys(fieldErrors).length > 0) {
              setApiErrors(fieldErrors);
              setTouched((prev) => {
                const next = { ...prev };
                (Object.keys(fieldErrors) as (keyof FormState)[]).forEach((field) => {
                  next[field] = true;
                });
                return next;
              });
              return;
            }
          }

          publish({
            title: "We couldn't save that goal",
            description: error.message,
            variant: "error",
          });
          return;
        }

        publish({
          title: "We couldn't save that goal",
          description:
            error instanceof Error
              ? error.message
              : "Something unexpected happened. Please try again.",
          variant: "error",
        });
      } finally {
        setIsSubmitting(false);
      }
    };

    void submit();
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Create a goal</p>
        <h1 className="text-3xl font-semibold text-slate-900">Plan a new savings goal</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Use this guided form to capture the basics, your investment assumptions, and anything you have already saved. You can
          refine the numbers after reviewing the projection.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <form aria-describedby="goal-form-helper" className="space-y-6" onSubmit={handleSubmit} noValidate>
          <span id="goal-form-helper" className="sr-only">
            All required fields must be completed before you can create a goal.
          </span>

          <section aria-labelledby="goal-basics-heading">
            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Goal basics</p>
                  <h2 id="goal-basics-heading" className="text-xl font-semibold text-slate-900">
                    Describe what you&apos;re saving for
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  Give your goal a clear title and the amount you&apos;re aiming for. We&apos;ve pre-selected a currency based on your region — change it if needed.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-title">Title</Label>
                  <Input
                    id="goal-title"
                    name="title"
                    value={state.title}
                    onChange={handleChange("title")}
                    onBlur={handleBlur("title")}
                    aria-invalid={showError("title")}
                    aria-describedby={showError("title") ? "goal-title-error" : undefined}
                    placeholder="E.g. Renovate the kitchen"
                    required
                  />
                  {showError("title") ? (
                    <p id="goal-title-error" className="text-sm text-red-600" aria-live="polite">
                      {errors.title}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-[2fr,1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="target-amount">Target amount</Label>
                    <Input
                      id="target-amount"
                      name="targetAmount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={state.targetAmount}
                      onChange={handleChange("targetAmount")}
                      onBlur={handleBlur("targetAmount")}
                      aria-invalid={showError("targetAmount")}
                      aria-describedby={showError("targetAmount") ? "target-amount-error" : undefined}
                      placeholder="750000"
                      required
                    />
                    {showError("targetAmount") ? (
                      <p id="target-amount-error" className="text-sm text-red-600" aria-live="polite">
                        {errors.targetAmount}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      id="currency"
                      name="currency"
                      value={state.currency}
                      onChange={handleChange("currency")}
                      onBlur={handleBlur("currency")}
                      aria-invalid={showError("currency")}
                      aria-describedby={showError("currency") ? "currency-error" : undefined}
                      required
                    >
                      {currencies.map((currency) => (
                        <option key={currency.value} value={currency.value}>
                          {currency.label}
                        </option>
                      ))}
                    </Select>
                    {showError("currency") ? (
                      <p id="currency-error" className="text-sm text-red-600" aria-live="polite">
                        {errors.currency}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target-date">Target date</Label>
                  <Input
                    id="target-date"
                    name="targetDate"
                    type="date"
                    value={state.targetDate}
                    onChange={handleChange("targetDate")}
                    onBlur={handleBlur("targetDate")}
                    aria-invalid={showError("targetDate")}
                    aria-describedby={showError("targetDate") ? "target-date-error target-date-helper" : "target-date-helper"}
                    required
                  />
                  <p id="target-date-helper" className="text-sm text-slate-500">
                    Pick when you&apos;ll need the money.
                  </p>
                  {showError("targetDate") ? (
                    <p id="target-date-error" className="text-sm text-red-600" aria-live="polite">
                      {errors.targetDate}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="investment-heading">
            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Investment projection</p>
                  <h2 id="investment-heading" className="text-xl font-semibold text-slate-900">
                    Adjust your savings plan
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  Drag the slider to explore how your return rate affects the contribution needed. Fill in the goal basics above to see live numbers.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Live result box */}
                <div className="rounded-xl border border-primary-200 bg-gradient-to-br from-primary-50 to-primary-100 p-5 text-center">
                  {investmentProjection?.payment != null ? (
                    <>
                      <p className="text-sm font-medium capitalize text-primary-700">
                        {state.contributionFrequency} contribution needed
                      </p>
                      <p className="mt-1 text-4xl font-bold text-primary-900">
                        {formatCurrency(investmentProjection.payment, state.currency)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        over {investmentProjection.tYears.toFixed(1)} years &middot; {state.expectedReturn}% annual return
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Fill in the goal amount and target date above to see your required contribution.
                    </p>
                  )}
                </div>

                {/* Return rate slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="expected-return" className="text-sm font-medium text-slate-700">
                      Expected annual return
                    </Label>
                    <span className="text-sm font-semibold text-primary-700">{state.expectedReturn}%</span>
                  </div>
                  <input
                    id="expected-return"
                    type="range"
                    min={0}
                    max={20}
                    step={0.5}
                    value={state.expectedReturn === "" ? 0 : Number(state.expectedReturn)}
                    onChange={(event) => {
                      setState((prev) => ({ ...prev, expectedReturn: event.target.value }));
                      setTouched((prev) => ({ ...prev, expectedReturn: true }));
                    }}
                    onBlur={handleBlur("expectedReturn")}
                    aria-invalid={showError("expectedReturn")}
                    className="h-2 w-full cursor-pointer rounded-full bg-slate-200 accent-primary-600"
                    aria-label="Expected annual return slider"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>0%</span>
                    <span>20%</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {RETURN_PRESETS.map((preset) => {
                      const isActive = state.expectedReturn === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => handlePresetClick(preset.value)}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                            isActive
                              ? "border-primary-500 bg-primary-50 text-primary-700"
                              : "border-slate-300 bg-white text-slate-600 hover:border-primary-400 hover:text-primary-700"
                          }`}
                          aria-pressed={isActive}
                        >
                          {preset.label} <span className="opacity-75">{preset.description}</span>
                        </button>
                      );
                    })}
                  </div>
                  {showError("expectedReturn") ? (
                    <p id="expected-return-error" className="text-sm text-red-600" aria-live="polite">
                      {errors.expectedReturn}
                    </p>
                  ) : null}
                </div>

                {/* Contribution frequency toggle */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">How often will you contribute?</Label>
                  <div className="flex gap-2">
                    {(["monthly", "yearly"] as ContributionFrequency[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleRadioChange("contributionFrequency", option)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                          state.contributionFrequency === option
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-slate-300 bg-white text-slate-600 hover:border-primary-400"
                        }`}
                        aria-pressed={state.contributionFrequency === option}
                      >
                        <span className="capitalize">{option}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="optional-heading">
            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Optional</p>
                  <h2 id="optional-heading" className="text-xl font-semibold text-slate-900">
                    Anything already saved?
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  Including your current balance helps show how close you are to the goal.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="existing-savings">Existing savings for this goal</Label>
                <Input
                  id="existing-savings"
                  name="existingSavings"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={state.existingSavings}
                  onChange={handleChange("existingSavings")}
                  onBlur={handleBlur("existingSavings")}
                  aria-invalid={showError("existingSavings")}
                  aria-describedby={showError("existingSavings") ? "existing-savings-error" : undefined}
                />
                {showError("existingSavings") ? (
                  <p id="existing-savings-error" className="text-sm text-red-600" aria-live="polite">
                    {errors.existingSavings}
                  </p>
                ) : null}
              </CardContent>
              <CardFooter className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => router.push("/goals")}>Cancel</Button>
                <Button type="submit" disabled={!canSubmit || isSubmitting} aria-busy={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Create goal"}
                </Button>
              </CardFooter>
            </Card>
          </section>
        </form>

        <aside
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-md"
          aria-label="What you&apos;ll see"
        >
          <h2 className="text-lg font-semibold text-slate-900">What you&apos;ll see</h2>
          <p>
            Once you create the goal we&apos;ll calculate the monthly contributions needed, forecast your progress, and highlight any
            gaps.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Projected balance chart with your contributions and growth.</li>
            <li>Milestones for each year so you can track progress.</li>
            <li>Next steps to fine-tune contributions or adjust assumptions.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
