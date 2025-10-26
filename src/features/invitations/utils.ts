const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 1000 * 60 * 60 * 24 * 365 },
  { unit: "month", ms: 1000 * 60 * 60 * 24 * 30 },
  { unit: "week", ms: 1000 * 60 * 60 * 24 * 7 },
  { unit: "day", ms: 1000 * 60 * 60 * 24 },
  { unit: "hour", ms: 1000 * 60 * 60 },
  { unit: "minute", ms: 1000 * 60 },
  { unit: "second", ms: 1000 },
];

export const formatRelativeTime = (date: string | number | Date): string => {
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) {
    return "just now";
  }

  const delta = target.getTime() - Date.now();
  const absoluteDelta = Math.abs(delta);

  for (const { unit, ms } of TIME_UNITS) {
    if (absoluteDelta >= ms || unit === "second") {
      const value = Math.round(delta / ms);
      return relativeTimeFormatter.format(value, unit);
    }
  }

  return "just now";
};

export const formatDateTime = (date: string | number | Date): string => {
  const formatter = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "Unknown";
  }

  return formatter.format(value);
};

export const formatCurrency = (value: number, currency: string, options?: Intl.NumberFormatOptions) => {
  const formatter = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...options,
  });

  return formatter.format(value);
};
