# Demo Plan Seed Specification

This specification defines the canned data we load for the demo account (`demo@example.com`). It aligns with the shared [Financial Goal Calculation Specification](./financial-calculation-spec.md) so product demos and QA checks produce deterministic numbers.

## Account

- **Email:** `demo@example.com`
- **Authentication:** OTP delivered to the console/mail sandbox (same flow as production OTP, but intercepted locally for demos).
- **Password:** _None_. Authentication always relies on the OTP loop.

## Seed Goals

| Goal | Target Future Value (₹) | Horizon | Annual Rate | Compounding | Required Monthly Contribution (₹) | Lump Sum Required Today (₹) | Notes |
|------|-------------------------|---------|-------------|-------------|-----------------------------------|-----------------------------|-------|
| Bike | 250,000 | 2 years | 8% nominal | Monthly (`nPerYear = 12`) | 9,640.15619737948 | 213,149.09398717133 | No existing assets. |
| Plot | 1,500,000 | 10 years | 8% nominal | Monthly (`nPerYear = 12`) | 8,199.139153303662 | 675,785.1910661899 | No existing assets. |
| iPhone 17 | 120,000 | 6 months (0.5 years) | 6% nominal | Monthly (`nPerYear = 12`) | 19,751.45467729324 | 116,462.16935635895 | No existing assets. |

- Monthly contributions use the `requiredPaymentForFutureValue` formula from the finance spec with full double precision.
- Lump sums use the `requiredLumpSumForFutureValue` formula with the same precision rules.
- Display layers round to two decimals (₹) after fetching from the seed fixture.
- Total planned contributions (before interest) for each goal are:
  - Bike: `9,640.15619737948 × 24 = 231,363.7487371075`
  - Plot: `8,199.139153303662 × 120 = 983,896.6983964394`
  - iPhone 17: `19,751.45467729324 × 6 = 118,508.72806375945`

## Seeding Mechanics

1. Create (or reset) the `demo@example.com` member record with verified status so OTP login succeeds immediately after code submission.
2. Upsert the three goals above with:
   - `targetAmount` equal to the target future value.
   - `targetDate` set using the stated horizon (e.g., 2 years ahead for the Bike goal) relative to the seeding timestamp.
   - `expectedRatePercent`, `compoundingFrequency`, and `contributionCadence` set to the values listed in the table.
   - `plan.paymentPerPeriod` prefilled with the monthly contribution from the table.
   - `plan.lumpSumToday` prefilled with the lump sum requirement.
   - `plan.currency` set to `INR` and `plan.displayPrecision` set to two decimal places.
3. Ensure any dashboards or summaries call through the shared financial utilities instead of re-implementing formulas so recalculations match the spec when users tweak values.

## QA Tour Script

Follow this script to validate the seeded demo account against the [finance test plan](./financial-calculation-spec.md):

1. **Login**
   - Navigate to the Goalsplit login page.
   - Enter `demo@example.com` and request an OTP.
   - Retrieve the OTP from the console/mail sandbox and submit it. Confirm redirect to the goals overview.
2. **Goal Presence**
   - Verify exactly three goals render: *Bike*, *Plot*, and *iPhone 17*.
   - Confirm each goal shows the target amounts `₹250,000`, `₹1,500,000`, and `₹120,000` respectively (allowing for UI rounding).
3. **Plan Values**
   - Drill into each goal and capture the monthly contribution figure.
   - Cross-check against the finance spec by running the same inputs through automated tests or the calculator harness:
     - Bike → expect `₹9,640.16` per month (rounded from `9,640.15619737948`).
     - Plot → expect `₹8,199.14` per month (rounded from `8,199.139153303662`).
     - iPhone 17 → expect `₹19,751.45` per month (rounded from `19,751.45467729324`).
   - Confirm lump-sum equivalents match the pre-calculated values when formatted to two decimals: `₹213,149.09`, `₹675,785.19`, and `₹116,462.17`.
4. **Consistency Check**
   - Trigger the finance unit test suite or the calculation playground used in `docs/financial-calculation-spec.md` and supply the goal inputs. Ensure the outputs align (differences limited to display rounding).
   - Adjust one goal parameter (e.g., change the Bike horizon to 3 years) and confirm the recalculated payment still matches the finance utilities, proving the seed data ties back to shared formulas.
5. **Acceptance**
   - Document the run (screenshots and console output for OTP) and note that login plus visibility of the three goals satisfies the acceptance criterion.

When the QA tour passes, the demo seed is validated and ready for stakeholders.
