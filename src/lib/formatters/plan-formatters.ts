export interface FormatCurrencyOptions extends Intl.NumberFormatOptions {
  locale?: string;
}

const ZERO_FRACTION_CURRENCIES = new Set(["INR", "JPY", "KRW", "VND"]);

export const formatCurrency = (
  amount: number,
  currency: string,
  options: FormatCurrencyOptions = {},
): string => {
  const { locale, ...intlOptions } = options;
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const currencyCode = currency.toUpperCase();
  const defaultDigits = ZERO_FRACTION_CURRENCIES.has(currencyCode) ? 0 : 2;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits:
      intlOptions.minimumFractionDigits ?? intlOptions.maximumFractionDigits ?? defaultDigits,
    maximumFractionDigits:
      intlOptions.maximumFractionDigits ?? intlOptions.minimumFractionDigits ?? defaultDigits,
    ...intlOptions,
  });

  return formatter.format(safeAmount);
};

export const formatPercent = (
  rate: number,
  options: Intl.NumberFormatOptions & { locale?: string } = {},
): string => {
  const { locale, ...percentOptions } = options;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const formatter = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits:
      percentOptions.minimumFractionDigits ?? (Number.isInteger(safeRate) ? 0 : 1),
    maximumFractionDigits:
      percentOptions.maximumFractionDigits ?? Math.max(Number.isInteger(safeRate) ? 0 : 1, 1),
    ...percentOptions,
  });

  return formatter.format(safeRate / 100);
};

export const formatDate = (
  value: string | number | Date,
  options: { locale?: string; withDay?: boolean } = {},
): string => {
  const { locale, withDay = true } = options;
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: withDay ? "numeric" : undefined,
  });

  return formatter.format(date);
};

interface HorizonInput {
  years?: number;
  months?: number;
  totalMonths?: number;
}

export const formatHorizon = (input: HorizonInput): string => {
  const totalMonths = (() => {
    if (typeof input.totalMonths === "number" && Number.isFinite(input.totalMonths)) {
      return Math.max(Math.round(input.totalMonths), 0);
    }

    const years = Number.isFinite(input.years) ? Math.max(Math.round(input.years ?? 0), 0) : 0;
    const months = Number.isFinite(input.months)
      ? Math.max(Math.round(input.months ?? 0), 0)
      : 0;

    return years * 12 + months;
  })();

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  }

  if (parts.length === 0) {
    return "0 months";
  }

  return parts.join(" ");
};
