import {
  CreateGoalInputSchema,
  UpdateGoalInputSchema,
  type CreateGoalInput,
  type GoalResponse,
  type UpdateGoalInput,
} from "@/app/api/goals/schemas";
import { normalizeZodIssues } from "@/lib/validation/zod";

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

function toSchemaInput(state: FormState) {
  return {
    title: state.title,
    targetAmount: state.targetAmount,
    currency: state.currency,
    targetDate: state.targetDate,
    expectedRate: state.expectedReturn,
    compounding: state.compounding,
    contributionFrequency: state.contributionFrequency,
    existingSavings: state.existingSavings.trim().length > 0 ? state.existingSavings : undefined,
  };
}

function parseGoalFormState(state: FormState) {
  return CreateGoalInputSchema.parse(toSchemaInput(state));
}

export function validateForm(state: FormState): FormErrors {
  const result = CreateGoalInputSchema.safeParse(toSchemaInput(state));

  if (result.success) {
    return {};
  }

  const errors: FormErrors = {};
  normalizeZodIssues(result.error.issues).forEach((issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && field in defaultState && !errors[field as keyof FormState]) {
      errors[field as keyof FormState] = issue.message;
    }
  });

  return errors;
}

export function extractFieldErrors(details: unknown): FormErrors {
  const errors: FormErrors = {};

  normalizeZodIssues(details).forEach((issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && field in defaultState && !errors[field as keyof FormState]) {
      errors[field as keyof FormState] = issue.message;
    }
  });

  return errors;
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
  return parseGoalFormState(state);
}

export function buildUpdatePayload(
  state: FormState,
  initial: FormState,
): UpdateGoalInput {
  const next = parseGoalFormState(state);
  const previous = parseGoalFormState(initial);
  const payload: Record<string, unknown> = {};

  if (next.title !== previous.title) {
    payload.title = next.title;
  }

  if (next.targetAmount !== previous.targetAmount) {
    payload.targetAmount = next.targetAmount;
  }

  if (next.currency !== previous.currency) {
    payload.currency = next.currency;
  }

  if (next.targetDate.getTime() !== previous.targetDate.getTime()) {
    payload.targetDate = next.targetDate;
  }

  if (next.expectedRate !== previous.expectedRate) {
    payload.expectedRate = next.expectedRate;
  }

  if (next.compounding !== previous.compounding) {
    payload.compounding = next.compounding;
  }

  if (next.contributionFrequency !== previous.contributionFrequency) {
    payload.contributionFrequency = next.contributionFrequency;
  }

  const nextSavings = next.existingSavings ?? undefined;
  const previousSavings = previous.existingSavings ?? undefined;
  if (nextSavings !== previousSavings && nextSavings !== undefined) {
    payload.existingSavings = nextSavings;
  }

  if (Object.keys(payload).length === 0) {
    return {} as UpdateGoalInput;
  }

  return UpdateGoalInputSchema.parse(payload);
}

export function hasChanges(state: FormState, initial: FormState): boolean {
  const payload = buildUpdatePayload(state, initial);
  return Object.keys(payload).length > 0;
}
