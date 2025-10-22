import { useCallback, useMemo } from "react";

interface UseFormattersOptions {
  locale?: string;
  currency?: string;
}

type FormatCurrencyOptions = Intl.NumberFormatOptions;

type FormatPercentOptions = Intl.NumberFormatOptions;

interface FormatHorizonInput {
  years?: number;
  months?: number;
  totalMonths?: number;
}

const DEFAULT_CURRENCY_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};

export function useFormatters(options: UseFormattersOptions = {}) {
  const { locale, currency } = options;

  const defaultLocale = useMemo(() => locale ?? undefined, [locale]);
  const defaultCurrency = useMemo(() => currency ?? undefined, [currency]);

  const formatCurrency = useCallback(
    (value: number, currencyOverride?: string, formatOptions: FormatCurrencyOptions = {}) => {
      const resolvedCurrency = currencyOverride ?? defaultCurrency;
      const mergedOptions = { ...DEFAULT_CURRENCY_OPTIONS, ...formatOptions };

      try {
        if (resolvedCurrency) {
          return new Intl.NumberFormat(defaultLocale, {
            ...mergedOptions,
            style: "currency",
            currency: resolvedCurrency,
          }).format(value);
        }

        return new Intl.NumberFormat(defaultLocale, mergedOptions).format(value);
      } catch (error) {
        const fractionDigits =
          typeof mergedOptions.maximumFractionDigits === "number"
            ? mergedOptions.maximumFractionDigits
            : typeof mergedOptions.minimumFractionDigits === "number"
            ? mergedOptions.minimumFractionDigits
            : DEFAULT_CURRENCY_OPTIONS.maximumFractionDigits ?? 2;

        const safeDigits = Number.isFinite(fractionDigits) ? fractionDigits : 2;
        const fallbackValue = Number.isFinite(value) ? value : 0;

        if (resolvedCurrency) {
          return `${resolvedCurrency} ${fallbackValue.toFixed(safeDigits)}`;
        }

        return fallbackValue.toFixed(safeDigits);
      }
    },
    [defaultCurrency, defaultLocale],
  );

  const formatPercent = useCallback(
    (value: number, percentOptions: FormatPercentOptions = {}) => {
      const normalizedValue = Number.isFinite(value) ? value : 0;
      const decimal = normalizedValue / 100;
      const defaultDigits = Number.isInteger(normalizedValue) ? 0 : 1;
      const mergedOptions: Intl.NumberFormatOptions = {
        style: "percent",
        minimumFractionDigits: percentOptions.minimumFractionDigits ?? defaultDigits,
        maximumFractionDigits: percentOptions.maximumFractionDigits ?? Math.max(defaultDigits, 1),
        ...percentOptions,
      };

      try {
        return new Intl.NumberFormat(defaultLocale, mergedOptions).format(decimal);
      } catch (error) {
        const digits =
          typeof mergedOptions.maximumFractionDigits === "number"
            ? mergedOptions.maximumFractionDigits
            : mergedOptions.minimumFractionDigits ?? defaultDigits;
        const safeDigits = Number.isFinite(digits) ? digits : defaultDigits;
        return `${normalizedValue.toFixed(safeDigits)}%`;
      }
    },
    [defaultLocale],
  );

  const formatHorizon = useCallback((input: FormatHorizonInput | number) => {
    const totalMonths = (() => {
      if (typeof input === "number") {
        return Number.isFinite(input) ? Math.max(Math.round(input), 0) : 0;
      }

      if (typeof input.totalMonths === "number") {
        return Number.isFinite(input.totalMonths)
          ? Math.max(Math.round(input.totalMonths), 0)
          : 0;
      }

      const years = Number.isFinite(input.years ?? 0) ? Math.max(Math.round(input.years ?? 0), 0) : 0;
      const months = Number.isFinite(input.months ?? 0) ? Math.max(Math.round(input.months ?? 0), 0) : 0;
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
  }, []);

  return {
    formatCurrency,
    formatPercent,
    formatHorizon,
  } as const;
}
