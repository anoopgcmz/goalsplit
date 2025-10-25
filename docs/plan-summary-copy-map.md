# Plan summary copy sources

This note maps each plain-language line in the redesigned Plan tab to its server data source.

## At-a-Glance card
- **You’re aiming for {TargetAmount} by {Date}.** — Uses `plan.goal.targetAmount` and `plan.goal.targetDate` from `/api/goals/:id/plan`.
- **Put {PerPeriod} per {period} starting now.** — Uses `plan.totals.perPeriod` and `plan.assumptions.contributionFrequency`.
- **We’re assuming {Rate}% per year, compounded {Compounding}.** — Uses `plan.assumptions.expectedRate` and `plan.assumptions.compounding`. When the rate is zero the copy swaps to “We’re assuming 0% growth…”
- **Or invest {LumpSumNow} today instead.** — Uses `plan.totals.lumpSumNow`.
- **You already have {ExistingSavings}…** — Optional sentence rendered only when `plan.goal.existingSavings > 0`.

## Timeline sentence
- Monthly version references `plan.totals.perPeriod`, `plan.assumptions.expectedRate`, `plan.goal.targetAmount`, and `plan.goal.targetDate`.
- Yearly version references `plan.horizon.years`, `plan.horizon.months`, and `plan.goal.targetAmount`.
- The short-horizon notice appears when `plan.horizon.totalPeriods < 1`.

## Explain it like I’m 12
- Bullets reuse the same `plan.goal` and `plan.totals` fields listed above; the third bullet reads `plan.assumptions.expectedRate`.

## Shared goals quick view
- Table rows use each member’s `name`, `email`, `perPeriod`, and `splitPercent` supplied inside `plan.members`.
- The footer sentence totals `plan.totals.perPeriod`.

## Compare panel
- Original column always reflects the server values from `plan.totals.perPeriod` and `plan.goal.targetDate`.
- Adjusted column shows the locally adjusted scenario computed by `calculateScenario` with the current slider inputs.
- When the adjustment is infeasible the helper message uses the difference between the adjusted requirement and `plan.totals.perPeriod`, along with a gently extended date.
