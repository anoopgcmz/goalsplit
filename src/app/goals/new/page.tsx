"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

const currencies = [
  { label: "Indian Rupee (INR)", value: "INR" },
  { label: "US Dollar (USD)", value: "USD" },
  { label: "Euro (EUR)", value: "EUR" },
  { label: "British Pound (GBP)", value: "GBP" },
];

type Compounding = "monthly" | "yearly";
type ContributionFrequency = "monthly" | "yearly";

interface FormState {
  title: string;
  targetAmount: string;
  currency: string;
  targetDate: string;
  expectedReturn: string;
  compounding: Compounding;
  contributionFrequency: ContributionFrequency;
  existingSavings: string;
}

type FormErrors = Partial<Record<keyof FormState, string | undefined>>;

type TouchedState = Partial<Record<keyof FormState, boolean>>;

const defaultState: FormState = {
  title: "",
  targetAmount: "",
  currency: "INR",
  targetDate: "",
  expectedReturn: "8",
  compounding: "monthly",
  contributionFrequency: "monthly",
  existingSavings: "0",
};

function validateForm(state: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!state.title.trim()) {
    errors.title = "Add a descriptive title.";
  }

  const amount = Number(state.targetAmount);
  if (!state.targetAmount.trim()) {
    errors.targetAmount = "Enter how much the goal costs.";
  } else if (Number.isNaN(amount) || amount <= 0) {
    errors.targetAmount = "Use a positive number.";
  }

  if (!state.currency) {
    errors.currency = "Pick a currency.";
  }

  if (!state.targetDate) {
    errors.targetDate = "Choose when you'll need the money.";
  }

  const returnRate = Number(state.expectedReturn);
  if (!state.expectedReturn.trim()) {
    errors.expectedReturn = "Enter an expected yearly return.";
  } else if (Number.isNaN(returnRate) || returnRate <= 0 || returnRate > 100) {
    errors.expectedReturn = "Use a rate between 0 and 100%.";
  }

  const savings = Number(state.existingSavings);
  if (state.existingSavings.trim() && (Number.isNaN(savings) || savings < 0)) {
    errors.existingSavings = "Savings can't be negative.";
  }

  return errors;
}

export default function NewGoalPage(): JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<FormState>(defaultState);
  const [touched, setTouched] = useState<TouchedState>({});
  const { publish } = useToast();

  const errors = useMemo(() => validateForm(state), [state]);

  const showError = (field: keyof FormState) => Boolean(touched[field] && errors[field]);

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value;
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const handleRadioChange = (field: "compounding" | "contributionFrequency", value: Compounding | ContributionFrequency) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: keyof FormState) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

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
    if (!canSubmit) {
      setTouched(
        Object.keys(defaultState).reduce<TouchedState>((acc, key) => {
          acc[key as keyof FormState] = true;
          return acc;
        }, {}),
      );
      return;
    }

    publish({
      title: "Goal created",
      description: "We saved your goal setup. You can refine the plan anytime.",
      variant: "success",
    });
    router.push("/goals");
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
                  Give your goal a clear title and the amount you&apos;re aiming for. Select the currency if it&apos;s different from INR.
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
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="timeframe-heading">
            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Timeframe</p>
                  <h2 id="timeframe-heading" className="text-xl font-semibold text-slate-900">
                    When will you need the money?
                  </h2>
                </div>
                <p className="text-sm text-slate-600">Pick a target date to align your investment schedule.</p>
              </CardHeader>
              <CardContent className="space-y-2">
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
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="assumptions-heading">
            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Assumptions</p>
                  <h2 id="assumptions-heading" className="text-xl font-semibold text-slate-900">
                    Outline how you plan to invest
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  Set expectations for returns and how frequently you&apos;ll contribute. These guide the projections we show later.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Label htmlFor="expected-return" className="text-sm font-medium text-slate-700">
                      Expected annual return %
                    </Label>
                    <InfoTooltip
                      id="expected-return-tooltip"
                      content="Try 6–10% to compare scenarios."
                      label="Learn how to pick an expected return"
                    />
                  </div>
                  <Input
                    id="expected-return"
                    name="expectedReturn"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.5"
                    value={state.expectedReturn}
                    onChange={handleChange("expectedReturn")}
                    onBlur={handleBlur("expectedReturn")}
                    aria-invalid={showError("expectedReturn")}
                    aria-describedby={showError("expectedReturn") ? "expected-return-error" : undefined}
                    required
                  />
                  {showError("expectedReturn") ? (
                    <p id="expected-return-error" className="text-sm text-red-600" aria-live="polite">
                      {errors.expectedReturn}
                    </p>
                  ) : null}
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-700">
                    <span className="flex items-center gap-2">
                      Compounding
                      <InfoTooltip
                        id="compounding-tooltip"
                        content="How often returns are added to your balance."
                        label="Learn about compounding"
                      />
                    </span>
                  </legend>
                  <p className="text-sm text-slate-500">Pick how often returns are added to your balance.</p>
                  <div className="flex flex-wrap gap-3">
                    {(["monthly", "yearly"] as Compounding[]).map((option) => {
                      const isChecked = state.compounding === option;
                      return (
                        <label
                          key={option}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-400 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500"
                        >
                          <input
                            type="radio"
                            name="compounding"
                            value={option}
                            checked={isChecked}
                            onChange={() => handleRadioChange("compounding", option)}
                            onBlur={handleBlur("compounding")}
                            className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="capitalize">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-700">
                    <span className="flex items-center gap-2">
                      Contribution frequency
                      <InfoTooltip
                        id="contribution-frequency-tooltip"
                        content="How often you’ll invest (monthly/yearly)."
                        label="Learn about contribution frequency"
                      />
                    </span>
                  </legend>
                  <p className="text-sm text-slate-500">Decide if you’ll invest monthly or once a year.</p>
                  <div className="flex flex-wrap gap-3">
                    {(["monthly", "yearly"] as ContributionFrequency[]).map((option) => {
                      const isChecked = state.contributionFrequency === option;
                      return (
                        <label
                          key={option}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-400 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500"
                        >
                          <input
                            type="radio"
                            name="contributionFrequency"
                            value={option}
                            checked={isChecked}
                            onChange={() => handleRadioChange("contributionFrequency", option)}
                            onBlur={handleBlur("contributionFrequency")}
                            className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="capitalize">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
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
                <Button type="submit" disabled={!canSubmit}>
                  Create goal
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
