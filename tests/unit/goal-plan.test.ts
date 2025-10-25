import { describe, expect, it } from "vitest";

import type { GoalResponse } from "@/app/api/goals/schemas";
import { buildGoalPlan } from "@/lib/goals/plan";

describe("buildGoalPlan", () => {
  const baseGoal: GoalResponse = {
    id: "goal-1",
    ownerId: "user-1",
    title: "Past target goal",
    targetAmount: 10000,
    currency: "USD",
    targetDate: new Date("2000-01-01T00:00:00.000Z").toISOString(),
    expectedRate: 5,
    compounding: "monthly",
    contributionFrequency: "monthly",
    existingSavings: 0,
    isShared: false,
    members: [
      {
        userId: "user-1",
        role: "owner",
        splitPercent: 100,
      },
    ],
    createdAt: new Date("1999-01-01T00:00:00.000Z").toISOString(),
    updatedAt: new Date("1999-01-01T00:00:00.000Z").toISOString(),
  };

  it("returns finite contribution amounts when no periods remain", () => {
    const plan = buildGoalPlan(baseGoal);

    expect(Number.isFinite(plan.totals.perPeriod)).toBe(true);
    expect(plan.totals.perPeriod).toBe(0);
    expect(plan.members.every((member) => Number.isFinite(member.perPeriod))).toBe(
      true,
    );
    expect(plan.members[0]?.perPeriod).toBe(0);
    expect(plan.warnings).toContain(
      "No contribution periods remain; recurring contribution amount is undefined.",
    );
  });
});
