import { useCallback, useMemo } from "react";

import {
  formatCurrency as formatCurrencyValue,
  formatDate as formatDateValue,
  formatHorizon as formatHorizonValue,
  formatPercent as formatPercentValue,
} from "@/lib/formatters/plan-formatters";

interface UseFormattersOptions {
  locale?: string;
  currency?: string;
}

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
    (value: number, currencyOverride?: string, formatOptions: Intl.NumberFormatOptions = {}) => {
      const resolvedCurrency = currencyOverride ?? defaultCurrency;
      const mergedOptions = { ...DEFAULT_CURRENCY_OPTIONS, ...formatOptions };

      if (resolvedCurrency) {
        return formatCurrencyValue(value, resolvedCurrency, {
          ...mergedOptions,
          locale: defaultLocale,
        });
      }

      return new Intl.NumberFormat(defaultLocale, mergedOptions).format(value);
    },
    [defaultCurrency, defaultLocale],
  );

  const formatPercent = useCallback(
    (value: number, percentOptions: Intl.NumberFormatOptions = {}) =>
      formatPercentValue(value, { ...percentOptions, locale: defaultLocale }),
    [defaultLocale],
  );

  const formatHorizon = useCallback(
    (input: FormatHorizonInput | number) => {
      if (typeof input === "number") {
        return formatHorizonValue({ totalMonths: input });
      }

      return formatHorizonValue(input);
    },
    [],
  );

  const formatDateLong = useCallback(
    (value: Date | string | number, options?: { withDay?: boolean }) =>
      formatDateValue(value, { locale: defaultLocale, ...options }),
    [defaultLocale],
  );

  return {
    formatCurrency,
    formatPercent,
    formatHorizon,
    formatDate: formatDateLong,
  } as const;
}
