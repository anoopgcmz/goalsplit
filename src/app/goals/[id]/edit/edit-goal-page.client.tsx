"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { GoalResponse } from "@/app/api/goals/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  buildUpdatePayload,
  currencies,
  extractFieldErrors,
  hasChanges,
  mapGoalToFormState,
  type FormErrors,
  type FormState,
  type TouchedState,
  validateForm,
} from "@/features/goals/goal-form";
import { updateGoal } from "@/lib/api/goals";
import { ApiError as HttpApiError } from "@/lib/http";

interface EditGoalPageProps {
  goal: GoalResponse;
}

export default function EditGoalPage(props: EditGoalPageProps): JSX.Element {
  const { goal } = props;
  const router = useRouter();
  const { publish } = useToast();

  const initialFormState = useMemo(() => mapGoalToFormState(goal), [goal]);
  const initialRef = useRef<FormState>(initialFormState);
  const [state, setState] = useState<FormState>(initialFormState);
  const [touched, setTouched] = useState<TouchedState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiErrors, setApiErrors] = useState<FormErrors>({});

  useEffect(() => {
    initialRef.current = initialFormState;
    setState(initialFormState);
    setTouched({});
    setApiErrors({});
  }, [initialFormState]);

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

  const handleRadioChange = (
    field: "compounding" | "contributionFrequency",
    value: "monthly" | "yearly",
  ) => {
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

  const isComplete =
    state.title.trim().length > 0 &&
    state.targetAmount.trim().length > 0 &&
    state.currency.trim().length > 0 &&
    state.targetDate.trim().length > 0 &&
    state.expectedReturn.trim().length > 0;

  const hasErrors = Object.values(errors).some((error) => Boolean(error));
  const dirty = hasChanges(state, initialRef.current);
  const canSubmit = isComplete && !hasErrors && dirty;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (!canSubmit) {
      setTouched(
        Object.keys(state).reduce<TouchedState>((acc, key) => {
          acc[key as keyof FormState] = true;
          return acc;
        }, {}),
      );
      return;
    }

    setIsSubmitting(true);
    setApiErrors({});

    const payload = buildUpdatePayload(state, initialRef.current);

    if (Object.keys(payload).length === 0) {
      publish({
        title: "No changes to save",
        description: "Update a field before saving your goal.",
        variant: "info",
      });
      setIsSubmitting(false);
      return;
    }

    const submit = async () => {
      try {
        await updateGoal(goal.id, payload);

        publish({
          title: "Goal updated",
          description: "Your latest changes are now saved.",
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
            title: "We couldn't save your changes",
            description: error.message,
            variant: "error",
          });
          return;
        }

        publish({
          title: "We couldn't save your changes",
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
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Update goal</p>
        <h1 className="text-3xl font-semibold text-slate-900">Edit your savings plan</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Adjust the basics or your assumptions. We&apos;ll recalculate the projection once you review the goal details.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <form aria-describedby="goal-form-helper" className="space-y-6" onSubmit={handleSubmit} noValidate>
          <span id="goal-form-helper" className="sr-only">
            All required fields must be completed before you can update a goal.
          </span>

          <section aria-labelledby="goal-basics-heading">
            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Goal basics</p>
                  <h2 id="goal-basics-heading" className="text-xl font-semibold text-slate-900">
                    Update what you&apos;re saving for
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  Refresh the goal title, amount, or currency so your plan matches what you&apos;re aiming for.
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
                <p className="text-sm text-slate-600">Adjust the target date to realign your saving schedule.</p>
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
                    Update your growth expectations
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  Refine your expected return and compounding approach for a realistic plan.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="expected-return">Expected yearly return (%)</Label>
                    <Input
                      id="expected-return"
                      name="expectedReturn"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.1"
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

                  <div className="space-y-2">
                    <Label htmlFor="compounding">Compounding frequency</Label>
                    <div className="flex flex-wrap gap-2" id="compounding">
                      <Button
                        type="button"
                        variant={state.compounding === "monthly" ? "default" : "outline"}
                        onClick={() => handleRadioChange("compounding", "monthly")}
                        aria-pressed={state.compounding === "monthly"}
                      >
                        Monthly
                      </Button>
                      <Button
                        type="button"
                        variant={state.compounding === "yearly" ? "default" : "outline"}
                        onClick={() => handleRadioChange("compounding", "yearly")}
                        aria-pressed={state.compounding === "yearly"}
                      >
                        Yearly
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contribution-frequency">Contribution frequency</Label>
                  <div className="flex flex-wrap items-center gap-2" id="contribution-frequency">
                    <Button
                      type="button"
                      variant={state.contributionFrequency === "monthly" ? "default" : "outline"}
                      onClick={() => handleRadioChange("contributionFrequency", "monthly")}
                      aria-pressed={state.contributionFrequency === "monthly"}
                    >
                      Monthly
                    </Button>
                    <Button
                      type="button"
                      variant={state.contributionFrequency === "yearly" ? "default" : "outline"}
                      onClick={() => handleRadioChange("contributionFrequency", "yearly")}
                      aria-pressed={state.contributionFrequency === "yearly"}
                    >
                      Yearly
                    </Button>
                    <InfoTooltip>
                      We&apos;ll use this to calculate your ongoing contributions and project your progress.
                    </InfoTooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="existing-savings-heading">
            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Existing savings</p>
                  <h2 id="existing-savings-heading" className="text-xl font-semibold text-slate-900">
                    Update what you&apos;ve already set aside
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  Enter what you currently have saved so we can adjust the remaining amount automatically.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="existing-savings">Existing savings</Label>
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
                  placeholder="50000"
                />
                {showError("existingSavings") ? (
                  <p id="existing-savings-error" className="text-sm text-red-600" aria-live="polite">
                    {errors.existingSavings}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardFooter className="flex items-center justify-between gap-4">
              <p className="text-sm text-slate-600">
                We&apos;ll rerun the plan with your updates when you return to the goal details.
              </p>
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </CardFooter>
          </Card>
        </form>

        <aside className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">What happens next?</h2>
          <p>
            After saving, you&apos;ll head back to your goal overview. We&apos;ll refresh the projections so you can confirm the impact of
            your adjustments.
          </p>
          <p className="text-xs text-slate-500">
            Need to change members or splits? Head to the sharing section on the goal details page.
          </p>
        </aside>
      </div>
    </div>
  );
}
