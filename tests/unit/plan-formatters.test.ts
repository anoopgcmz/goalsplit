import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, formatHorizon, formatPercent } from "@/lib/formatters/plan-formatters";

describe("plan formatters", () => {
  it("formats currency with locale defaults", () => {
    expect(formatCurrency(250000, "INR", { locale: "en-IN" })).toBe("₹2,50,000");
    expect(formatCurrency(250000.25, "USD", { locale: "en-US" })).toBe("$250,000.25");
  });

  it("applies zero fraction digits for zero-decimal currencies", () => {
    expect(formatCurrency(1234.56, "JPY")).toBe("¥1,235");
  });

  it("formats percent with sensible defaults", () => {
    expect(formatPercent(8)).toBe("8%");
    expect(formatPercent(7.5)).toBe("7.5%");
  });

  it("formats date in long form", () => {
    const result = formatDate("2028-03-01T00:00:00.000Z", { locale: "en-US" });
    expect(result).toContain("March");
    expect(result).toContain("2028");
  });

  it("formats horizon with pluralization", () => {
    expect(formatHorizon({ years: 3, months: 2 })).toBe("3 years 2 months");
    expect(formatHorizon({ years: 0, months: 0 })).toBe("0 months");
    expect(formatHorizon({ totalMonths: 14 })).toBe("1 year 2 months");
  });
});
