"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  type Compounding,
  type ContributionFrequency,
  buildCreatePayload,
  currencies,
  extractFieldErrors,
  type FormErrors,
  type FormState,
  type TouchedState,
  validateForm,
} from "@/features/goals/goal-form";
import { createGoal } from "@/lib/api/goals";
import { requiredPaymentForFutureValue, yearFractionFromDates } from "@/lib/financial";
import { ApiError as HttpApiError } from "@/lib/http";
import type { AiParseResponse } from "@/app/api/goals/ai-parse/schema";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatAmount(amount: number, currency: string): string {
  if (currency === "INR") {
    if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)}Cr`;
    if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)}L`;
    return `₹${amount.toLocaleString("en-IN")}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function toDateInputValue(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeMonthly(
  targetAmount: number,
  existingSavings: number,
  expectedRate: number,
  targetDateStr: string,
  memberCount: number,
): number {
  const perPerson = targetAmount / memberCount;
  const perPersonSavings = existingSavings / memberCount;
  const netTarget = Math.max(perPerson - perPersonSavings, 0);
  const tYears = yearFractionFromDates(new Date(), new Date(targetDateStr));
  if (tYears <= 0) return perPerson;
  return Math.max(requiredPaymentForFutureValue(netTarget, expectedRate, 12, tYears), 0);
}

function stateFromParsed(parsed: AiParseResponse): FormState {
  return {
    title: parsed.title,
    targetAmount: String(parsed.targetAmount),
    currency: parsed.currency,
    targetDate: toDateInputValue(parsed.targetDate),
    expectedReturn: String(parsed.expectedRate),
    compounding: parsed.compounding,
    contributionFrequency: parsed.contributionFrequency,
    existingSavings: String(parsed.existingSavings),
  };
}

// ─── component ──────────────────────────────────────────────────────────────

type PagePhase = "input" | "review";

export default function AiGoalPage(): JSX.Element {
  const router = useRouter();
  const { publish } = useToast();

  // Phase 1 — text input
  const [prompt, setPrompt] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Phase 2 — review / edit
  const [phase, setPhase] = useState<PagePhase>("input");
  const [parsed, setParsed] = useState<AiParseResponse | null>(null);
  const [memberCount, setMemberCount] = useState(1);

  // Standard form state (same shape as /goals/new)
  const [state, setState] = useState<FormState>({
    title: "",
    targetAmount: "",
    currency: "INR",
    targetDate: "",
    expectedReturn: "8",
    compounding: "monthly",
    contributionFrequency: "monthly",
    existingSavings: "0",
  });
  const [touched, setTouched] = useState<TouchedState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiErrors, setApiErrors] = useState<FormErrors>({});

  // ── derived ──
  const errors = useMemo(() => {
    const base = validateForm(state);
    const merged: FormErrors = { ...base };
    (Object.keys(apiErrors) as (keyof FormState)[]).forEach((f) => {
      if (apiErrors[f]) merged[f] = apiErrors[f];
    });
    return merged;
  }, [state, apiErrors]);

  const showError = (field: keyof FormState) => Boolean(touched[field] && errors[field]);

  const isComplete =
    state.title.trim().length > 0 &&
    state.targetAmount.trim().length > 0 &&
    state.currency.trim().length > 0 &&
    state.targetDate.trim().length > 0 &&
    state.expectedReturn.trim().length > 0;

  const canSubmit = isComplete && !Object.values(errors).some(Boolean);

  // Live monthly recalculation for the summary chip
  const liveMonthly = useMemo(() => {
    const amount = parseFloat(state.targetAmount);
    const rate = parseFloat(state.expectedReturn);
    const savings = parseFloat(state.existingSavings) || 0;
    if (!amount || !rate || !state.targetDate) return null;
    return computeMonthly(amount, savings, rate, state.targetDate, memberCount);
  }, [state.targetAmount, state.expectedReturn, state.targetDate, state.existingSavings, memberCount]);

  // ── handlers ──
  const handleChange =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setState((prev) => ({ ...prev, [field]: event.target.value }));
      setApiErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };

  const handleRadioChange = (
    field: "compounding" | "contributionFrequency",
    value: Compounding | ContributionFrequency,
  ) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: keyof FormState) => () =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  // ── AI parse ──
  const handleParse = async () => {
    if (isParsing || prompt.trim().length < 10) return;
    setIsParsing(true);
    setParseError(null);

    try {
      const res = await fetch("/api/goals/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "message" in data
            ? String((data as { message: unknown }).message)
            : "AI could not understand the goal. Please rephrase and try again.";
        setParseError(msg);
        return;
      }

      const result = data as AiParseResponse;
      setParsed(result);
      setMemberCount(result.memberCount);
      setState(stateFromParsed(result));
      setTouched({});
      setApiErrors({});
      setPhase("review");
    } catch {
      setParseError("Something went wrong. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const handlePromptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleParse();
    }
  };

  // ── goal create ──
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!canSubmit) {
      const allTouched = Object.keys(state).reduce<TouchedState>((acc, k) => {
        acc[k as keyof FormState] = true;
        return acc;
      }, {});
      setTouched(allTouched);
      return;
    }

    setIsSubmitting(true);
    setApiErrors({});

    const submit = async () => {
      try {
        const payload = buildCreatePayload(state);
        const goal = await createGoal(payload);
        publish({
          title: "Goal created",
          description: "We saved your goal setup. You can refine the plan anytime.",
          variant: "success",
        });
        router.replace(`/goals/${goal.id}`);
      } catch (error) {
        if (error instanceof HttpApiError && error.status === 422) {
          const fieldErrors = extractFieldErrors(error.details);
          if (Object.keys(fieldErrors).length > 0) {
            setApiErrors(fieldErrors);
            setTouched((prev) => {
              const next = { ...prev };
              (Object.keys(fieldErrors) as (keyof FormState)[]).forEach((f) => {
                next[f] = true;
              });
              return next;
            });
            return;
          }
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

  const RETURN_PRESETS = [
    { label: "HYSA", description: "~4.5%", value: "4.5" },
    { label: "Index Funds", description: "~8%", value: "8" },
    { label: "Mixed", description: "~6%", value: "6" },
  ] as const;

  // ── render ──
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
          AI goal creation
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Describe your goal</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Tell us about your goal in plain language — amounts, timeline, number of people. Our AI
          will extract the details and build a savings plan for you to review.
        </p>
      </header>

      {/* ── Prompt card (always visible) ── */}
      <Card>
        <CardHeader className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
            Describe your goal
          </p>
          <h2 className="text-xl font-semibold text-slate-900">What are you saving for?</h2>
          <p className="text-sm text-slate-500">
            Include the total amount, how many people are involved, and when you need the money.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:opacity-60"
            rows={4}
            placeholder={
              "e.g. Me and my 4 friends are planning a Thailand trip in 12 months. " +
              "We need to raise ₹3L total. What's the best savings plan for us?"
            }
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setParseError(null);
            }}
            onKeyDown={handlePromptKeyDown}
            disabled={isParsing}
            aria-label="Describe your savings goal"
          />
          {parseError ? (
            <p className="text-sm text-danger" role="alert">
              {parseError}
            </p>
          ) : null}
          <p className="text-xs text-slate-400">Tip: Press Ctrl+Enter to parse</p>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-3">
          {phase === "review" ? (
            <button
              type="button"
              className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700"
              onClick={() => setPhase("input")}
            >
              ← Edit description
            </button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            onClick={() => void handleParse()}
            disabled={isParsing || prompt.trim().length < 10}
            aria-busy={isParsing}
          >
            {isParsing ? "Parsing…" : phase === "review" ? "Re-parse" : "Parse with AI"}
          </Button>
        </CardFooter>
      </Card>

      {/* ── Review phase ── */}
      {phase === "review" && parsed !== null ? (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">

          {/* Smart summary card */}
          <div className="rounded-2xl border border-primary-200 bg-primary-50 p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 mb-1">
                  AI summary
                </p>
                <h2 className="text-xl font-semibold text-slate-900">{state.title}</h2>
              </div>
              <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">
                {memberCount} {memberCount === 1 ? "person" : "people"}
              </span>
            </div>

            {parsed.reasoning ? (
              <p className="text-sm text-slate-600 italic">{parsed.reasoning}</p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500 mb-1">Total target</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatAmount(parseFloat(state.targetAmount) || parsed.targetAmount, state.currency)}
                </p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500 mb-1">Per person</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatAmount(
                    (parseFloat(state.targetAmount) || parsed.targetAmount) / memberCount,
                    state.currency,
                  )}
                </p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500 mb-1">Monthly / person</p>
                <p className="text-lg font-semibold text-primary-700">
                  {liveMonthly != null
                    ? formatAmount(liveMonthly, state.currency)
                    : formatAmount(parsed.perPersonMonthly, state.currency)}
                </p>
              </div>
            </div>

            {memberCount > 1 ? (
              <div className="flex items-center gap-3">
                <Label htmlFor="member-count" className="text-sm text-slate-700 shrink-0">
                  Number of people
                </Label>
                <Input
                  id="member-count"
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  value={String(memberCount)}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isFinite(n) && n >= 1) setMemberCount(n);
                  }}
                  className="w-24"
                />
                <p className="text-xs text-slate-400">Adjust if needed</p>
              </div>
            ) : null}
          </div>

          {/* Goal basics */}
          <section aria-labelledby="ai-goal-basics-heading">
            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                    Goal basics
                  </p>
                  <h2 id="ai-goal-basics-heading" className="text-xl font-semibold text-slate-900">
                    Review and adjust
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  All fields are pre-filled from your description. Edit anything before creating.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-goal-title">Title</Label>
                  <Input
                    id="ai-goal-title"
                    value={state.title}
                    onChange={handleChange("title")}
                    onBlur={handleBlur("title")}
                    aria-invalid={showError("title")}
                    placeholder="E.g. Thailand trip with friends"
                    required
                  />
                  {showError("title") ? (
                    <p className="text-sm text-danger" aria-live="polite">{errors.title}</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-[2fr,1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="ai-target-amount">Total target amount</Label>
                    <Input
                      id="ai-target-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={state.targetAmount}
                      onChange={handleChange("targetAmount")}
                      onBlur={handleBlur("targetAmount")}
                      aria-invalid={showError("targetAmount")}
                      required
                    />
                    {showError("targetAmount") ? (
                      <p className="text-sm text-danger" aria-live="polite">{errors.targetAmount}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-currency">Currency</Label>
                    <Select
                      id="ai-currency"
                      value={state.currency}
                      onChange={handleChange("currency")}
                      onBlur={handleBlur("currency")}
                    >
                      {currencies.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-target-date">Target date</Label>
                  <Input
                    id="ai-target-date"
                    type="date"
                    value={state.targetDate}
                    onChange={handleChange("targetDate")}
                    onBlur={handleBlur("targetDate")}
                    aria-invalid={showError("targetDate")}
                    required
                  />
                  {showError("targetDate") ? (
                    <p className="text-sm text-danger" aria-live="polite">{errors.targetDate}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Assumptions */}
          <section aria-labelledby="ai-assumptions-heading">
            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                    Assumptions
                  </p>
                  <h2 id="ai-assumptions-heading" className="text-xl font-semibold text-slate-900">
                    Investment settings
                  </h2>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ai-expected-return" className="text-sm font-medium text-slate-700">
                      Expected annual return %
                    </Label>
                    <InfoTooltip
                      id="ai-expected-return-tooltip"
                      content="AI suggested this based on your goal type. Try 6–10% to compare scenarios."
                      label="Learn about expected return"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-1">
                    {RETURN_PRESETS.map((preset) => {
                      const isActive = state.expectedReturn === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => {
                            setState((prev) => ({ ...prev, expectedReturn: preset.value }));
                            setTouched((prev) => ({ ...prev, expectedReturn: true }));
                          }}
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
                  <Input
                    id="ai-expected-return"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.5"
                    value={state.expectedReturn}
                    onChange={handleChange("expectedReturn")}
                    onBlur={handleBlur("expectedReturn")}
                    aria-invalid={showError("expectedReturn")}
                    required
                  />
                  {showError("expectedReturn") ? (
                    <p className="text-sm text-danger" aria-live="polite">{errors.expectedReturn}</p>
                  ) : null}
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-700">
                    <span className="flex items-center gap-2">
                      Compounding
                      <InfoTooltip
                        id="ai-compounding-tooltip"
                        content="How often returns are added to your balance."
                        label="Learn about compounding"
                      />
                    </span>
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {(["monthly", "yearly"] as Compounding[]).map((option) => (
                      <label
                        key={option}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-400 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500"
                      >
                        <input
                          type="radio"
                          name="ai-compounding"
                          value={option}
                          checked={state.compounding === option}
                          onChange={() => handleRadioChange("compounding", option)}
                          className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="capitalize">{option}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-700">
                    <span className="flex items-center gap-2">
                      Contribution frequency
                      <InfoTooltip
                        id="ai-contribution-freq-tooltip"
                        content="How often you'll invest (monthly/yearly)."
                        label="Learn about contribution frequency"
                      />
                    </span>
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {(["monthly", "yearly"] as ContributionFrequency[]).map((option) => (
                      <label
                        key={option}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-400 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500"
                      >
                        <input
                          type="radio"
                          name="ai-contribution-frequency"
                          value={option}
                          checked={state.contributionFrequency === option}
                          onChange={() => handleRadioChange("contributionFrequency", option)}
                          className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="capitalize">{option}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </CardContent>
            </Card>
          </section>

          {/* Existing savings */}
          <section aria-labelledby="ai-savings-heading">
            <Card>
              <CardHeader className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                    Optional
                  </p>
                  <h2 id="ai-savings-heading" className="text-xl font-semibold text-slate-900">
                    Anything already saved?
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  Include your group&apos;s combined existing savings for this goal, if any.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="ai-existing-savings">Total existing savings</Label>
                <Input
                  id="ai-existing-savings"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={state.existingSavings}
                  onChange={handleChange("existingSavings")}
                  onBlur={handleBlur("existingSavings")}
                  aria-invalid={showError("existingSavings")}
                />
                {showError("existingSavings") ? (
                  <p className="text-sm text-danger" aria-live="polite">{errors.existingSavings}</p>
                ) : null}
              </CardContent>
              <CardFooter className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700"
                  onClick={() => router.push("/goals/new")}
                >
                  Switch to manual form
                </button>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push("/goals")}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? "Saving…" : "Create goal"}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </section>
        </form>
      ) : null}

      {/* ── Empty state hint (input phase) ── */}
      {phase === "input" ? (
        <aside
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-md"
          aria-label="Examples"
        >
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Example prompts</h2>
          <ul className="space-y-3">
            {[
              "Me and my 4 friends are planning a Thailand trip in 12 months. We need ₹3L total.",
              "I want to save $10,000 for a home down payment in 3 years.",
              "Planning a wedding for 2 people in 18 months. Budget is ₹10L.",
              "Build an emergency fund of ₹5L in 6 months, just for myself.",
            ].map((example) => (
              <li key={example}>
                <button
                  type="button"
                  className="text-left text-primary-600 hover:text-primary-800 hover:underline underline-offset-2 transition"
                  onClick={() => setPrompt(example)}
                >
                  &ldquo;{example}&rdquo;
                </button>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
