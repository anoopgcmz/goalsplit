export type CompoundingFrequency = 1 | 12;

const YEAR_IN_DAYS = 365.25;
const DAYS_IN_YEAR = YEAR_IN_DAYS; // alias for clarity

export const yearFractionFromDates = (start: Date, end: Date): number => {
  const millisPerDay = 24 * 60 * 60 * 1000;
  const diffInDays = (end.getTime() - start.getTime()) / millisPerDay;
  return diffInDays / DAYS_IN_YEAR;
};

export function requiredPaymentForFutureValue(
  FV: number,
  ratePercent: number,
  nPerYear: CompoundingFrequency,
  tYears: number
): number {
  const periodCount = nPerYear * tYears;

  if (periodCount <= 0) {
    return Infinity;
  }

  if (ratePercent === 0) {
    return FV / periodCount;
  }

  const i = (ratePercent / 100) / nPerYear;
  const denominator = Math.pow(1 + i, periodCount) - 1;

  if (Math.abs(denominator) < Number.EPSILON) {
    return FV / periodCount;
  }

  const numerator = i * FV;
  return numerator / denominator;
}

export function requiredLumpSumForFutureValue(
  FV: number,
  ratePercent: number,
  nPerYear: CompoundingFrequency,
  tYears: number
): number {
  if (tYears <= 0) {
    return FV;
  }

  if (ratePercent === 0) {
    return FV;
  }

  const periodicRate = (ratePercent / 100) / nPerYear;
  const periodCount = nPerYear * tYears;
  return FV / Math.pow(1 + periodicRate, periodCount);
}

export function futureValueOfPresent(
  PV: number,
  ratePercent: number,
  nPerYear: CompoundingFrequency,
  tYears: number
): number {
  if (tYears <= 0) {
    return PV;
  }

  if (ratePercent === 0) {
    return PV;
  }

  const periodicRate = (ratePercent / 100) / nPerYear;
  const periodCount = nPerYear * tYears;
  return PV * Math.pow(1 + periodicRate, periodCount);
}

export function netTargetAfterExisting(
  FV: number,
  existing: number,
  ratePercent: number,
  nPerYear: CompoundingFrequency,
  tYears: number
): number {
  const existingFV = futureValueOfPresent(existing, ratePercent, nPerYear, tYears);
  return Math.max(FV - existingFV, 0);
}
