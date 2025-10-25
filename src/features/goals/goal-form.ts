import type {
  CreateGoalInput,
  GoalResponse,
  UpdateGoalInput,
} from "@/app/api/goals/schemas";

export const currencies = [
  { label: "Indian Rupee (INR)", value: "INR" },
  { label: "US Dollar (USD)", value: "USD" },
  { label: "Euro (EUR)", value: "EUR" },
  { label: "British Pound (GBP)", value: "GBP" },
];

export type Compounding = "monthly" | "yearly";
export type ContributionFrequency = "monthly" | "yearly";

export interface FormState {
  title: string;
  targetAmount: string;
  currency: string;
  targetDate: string;
  expectedReturn: string;
  compounding: Compounding;
  contributionFrequency: ContributionFrequency;
  existingSavings: string;
}

export type FormErrors = Partial<Record<keyof FormState, string | undefined>>;

export type TouchedState = Partial<Record<keyof FormState, boolean>>;

export const defaultState: FormState = {
  title: "",
  targetAmount: "",
  currency: "INR",
  targetDate: "",
  expectedReturn: "8",
  compounding: "monthly",
  contributionFrequency: "monthly",
  existingSavings: "0",
};

export function validateForm(state: FormState): FormErrors {
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

export function extractFieldErrors(details: unknown): FormErrors {
  if (!details || typeof details !== "object") {
    return {};
  }

  const issues = (details as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) {
    return {};
  }

  return issues.reduce<FormErrors>((acc, issue) => {
    if (!issue || typeof issue !== "object") {
      return acc;
    }

    const path = Array.isArray((issue as { path?: unknown }).path)
      ? ((issue as { path?: unknown }).path as unknown[])
      : [];
    const message = (issue as { message?: unknown }).message;
    const field = path[0];

    if (typeof field === "string" && typeof message === "string" && field in defaultState) {
      acc[field as keyof FormState] = message;
    }

    return acc;
  }, {});
}

function toDateInputValue(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function mapGoalToFormState(goal: GoalResponse): FormState {
  const targetDate = new Date(goal.targetDate);

  return {
    title: goal.title,
    targetAmount: goal.targetAmount.toString(),
    currency: goal.currency,
    targetDate: Number.isNaN(targetDate.getTime()) ? "" : toDateInputValue(targetDate),
    expectedReturn: goal.expectedRate.toString(),
    compounding: goal.compounding,
    contributionFrequency: goal.contributionFrequency,
    existingSavings:
      goal.existingSavings == null
        ? "0"
        : Number.isFinite(goal.existingSavings)
        ? goal.existingSavings.toString()
        : "0",
  };
}

export function buildCreatePayload(state: FormState): CreateGoalInput {
  return {
    title: state.title.trim(),
    targetAmount: Number(state.targetAmount),
    currency: state.currency,
    targetDate: new Date(state.targetDate).toISOString(),
    expectedRate: Number(state.expectedReturn),
    compounding: state.compounding,
    contributionFrequency: state.contributionFrequency,
    existingSavings:
      state.existingSavings.trim().length > 0 ? Number(state.existingSavings) : undefined,
  };
}

export function buildUpdatePayload(
  state: FormState,
  initial: FormState,
): UpdateGoalInput {
  const payload: Record<string, unknown> = {};

  const nextTitle = state.title.trim();
  const initialTitle = initial.title.trim();
  if (nextTitle !== initialTitle) {
    payload.title = nextTitle;
  }

  const nextAmount = Number(state.targetAmount);
  const initialAmount = Number(initial.targetAmount);
  if (!Number.isNaN(nextAmount) && nextAmount !== initialAmount) {
    payload.targetAmount = nextAmount;
  }

  if (state.currency !== initial.currency) {
    payload.currency = state.currency;
  }

  if (state.targetDate && initial.targetDate) {
    const nextDate = new Date(state.targetDate);
    const initialDate = new Date(initial.targetDate);
    if (nextDate.toISOString() !== initialDate.toISOString()) {
      payload.targetDate = nextDate.toISOString();
    }
  } else if (state.targetDate !== initial.targetDate && state.targetDate) {
    payload.targetDate = new Date(state.targetDate).toISOString();
  }

  const nextRate = Number(state.expectedReturn);
  const initialRate = Number(initial.expectedReturn);
  if (!Number.isNaN(nextRate) && nextRate !== initialRate) {
    payload.expectedRate = nextRate;
  }

  if (state.compounding !== initial.compounding) {
    payload.compounding = state.compounding;
  }

  if (state.contributionFrequency !== initial.contributionFrequency) {
    payload.contributionFrequency = state.contributionFrequency;
  }

  const nextSavings = state.existingSavings.trim().length > 0 ? Number(state.existingSavings) : undefined;
  const initialSavings = initial.existingSavings.trim().length > 0 ? Number(initial.existingSavings) : undefined;
  if (nextSavings !== initialSavings && nextSavings !== undefined) {
    payload.existingSavings = nextSavings;
  }

  return payload as UpdateGoalInput;
}

export function hasChanges(state: FormState, initial: FormState): boolean {
  const payload = buildUpdatePayload(state, initial);
  return Object.keys(payload).length > 0;
}
