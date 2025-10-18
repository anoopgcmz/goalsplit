# Financial Goal Calculation Specification

This document defines the required financial projection utilities and their shared rules. All functions **must be pure** (no external side-effects, no reliance on external state) and implemented exactly as specified.

## Shared Types and Constants

```ts
type CompoundingFrequency = 1 | 12;

type CurrencyAmount = number; // Always store in whole currency units (₹) using double precision.
```

- `ratePercent` represents the nominal annual interest rate expressed as a percentage (e.g. `8` for 8%).
- `nPerYear` is the number of compounding periods per year and also the cadence for recurring payments (`1` = annual, `12` = monthly).
- Convert percentages to decimals with `rate = ratePercent / 100`.
- Periodic rate: `periodicRate = rate / nPerYear`.
- Total periods (can be fractional): `periodCount = nPerYear * tYears`.
- All calculations assume **end-of-period compounding and payments** (ordinary annuity convention). No intra-period contributions or interest are recognised.
- Do not mutate arguments. Always return freshly computed numbers.

### Rounding Rules

1. **Computation:** Retain full IEEE-754 double precision for all intermediate and returned values. Never round during computation.
2. **Display:** Round values only when formatting for UI, typically to 2 decimal places (₹). Consumers of these functions are responsible for presentation rounding.

### Edge Case Conventions

- **Zero or negative time horizon (`tYears <= 0`):** Treat the target date as due immediately. Skip compounding and return/pay the present value.
- **Zero nominal rate (`ratePercent === 0`):** Treat as simple accumulation without interest. Use linear formulas (see function specifics).
- **Less than one full period (`periodCount < 1`):** Handle using the general formulas (they support fractional exponents). For payment schedules, if `periodCount < 1`, interpret as a single payment due at the end of the lone partial period.
- **Past target dates:** Equivalent to `tYears <= 0`. Return the present requirement, and `requiredPaymentForFutureValue` should throw a domain error or return `Infinity` if no future periods remain. The recommended behaviour is to return `Infinity` to signal impossibility.
- **Existing assets exceeding the goal:** Cap the additional requirement at `0` to avoid negative funding needs.

## Function Specifications

### `requiredPaymentForFutureValue`

```ts
function requiredPaymentForFutureValue(
  FV: number,
  ratePercent: number,
  nPerYear: CompoundingFrequency,
  tYears: number
): number
```

Calculates the level end-of-period contribution per compounding period necessary to reach a target future value `FV`.

Implementation rules:

1. Compute `periodCount = nPerYear * tYears`.
2. If `periodCount <= 0`, return `Infinity` (no periods remain to make contributions).
3. If `ratePercent === 0`, return `FV / periodCount`.
4. Otherwise compute the periodic rate `i = (ratePercent / 100) / nPerYear` and use the future value of an ordinary annuity:
   
   ```ts
   const numerator = i * FV;
   const denominator = Math.pow(1 + i, periodCount) - 1;
   return numerator / denominator;
   ```

   When `denominator` underflows (very small `i`), fall back to the zero-rate formula.

### `requiredLumpSumForFutureValue`

```ts
function requiredLumpSumForFutureValue(
  FV: number,
  ratePercent: number,
  nPerYear: CompoundingFrequency,
  tYears: number
): number
```

Determines the present-value lump sum needed today to attain `FV` after `tYears` with end-of-period compounding.

Implementation rules:

1. If `tYears <= 0`, return `FV` (no time for growth).
2. If `ratePercent === 0`, return `FV` (no compounding benefit).
3. Otherwise compute `periodicRate = (ratePercent / 100) / nPerYear` and `periodCount = nPerYear * tYears`, then
   
   ```ts
   return FV / Math.pow(1 + periodicRate, periodCount);
   ```

### `futureValueOfPresent`

```ts
function futureValueOfPresent(
  PV: number,
  ratePercent: number,
  nPerYear: CompoundingFrequency,
  tYears: number
): number
```

Projects the future value of an existing lump-sum `PV` under the given assumptions.

Implementation rules:

1. If `tYears <= 0`, return `PV`.
2. If `ratePercent === 0`, return `PV`.
3. Otherwise compute `periodicRate` and `periodCount` as above and return `PV * Math.pow(1 + periodicRate, periodCount)`.

### `netTargetAfterExisting`

```ts
function netTargetAfterExisting(
  FV: number,
  existing: number,
  ratePercent: number,
  nPerYear: CompoundingFrequency,
  tYears: number
): number
```

Calculates the additional future value that still needs to be funded after allowing an existing lump-sum amount to compound.

Implementation rules:

1. Compute `existingFV = futureValueOfPresent(existing, ratePercent, nPerYear, tYears)`.
2. Return `Math.max(FV - existingFV, 0)`.

## Typed Test Plan for Sample User X

The following scenarios illustrate the expected outputs for Sample User X.

```ts
interface CalculationScenario {
  goal: string;
  FV: number;
  existing: number;
  ratePercent: number;
  nPerYear: CompoundingFrequency;
  tYears: number;
  expected: {
    paymentPerPeriod: number;
    lumpSumToday: number;
    futureValueOfExisting: number;
    netTarget: number;
  };
}
```

| goal   | FV (₹) | existing (₹) | ratePercent | nPerYear | tYears | paymentPerPeriod (₹) | lumpSumToday (₹) | futureValueOfExisting (₹) | netTarget (₹) |
|--------|--------|--------------|-------------|----------|--------|----------------------|------------------|----------------------------|---------------|
| Bike   | 250,000 | 50,000       | 8           | 12       | 2      | 9,640.15619737948    | 213,149.09398717133 | 58,644.39658726548         | 191,355.60341273452 |
| Plot   | 1,500,000 | 300,000     | 8           | 12       | 10     | 8,199.139153303662   | 675,785.1910661899 | 665,892.0703634132         | 834,107.9296365868 |
| iPhone | 120,000 | 10,000       | 6           | 12       | 0.5    | 19,751.45467729324   | 116,462.16935635895 | 10,303.77509393766         | 109,696.22490606234 |

All expected values reflect full-precision computation before any display rounding.

## Acceptance Criteria

- All four functions are implemented with the TypeScript signatures above and adhere strictly to the described rules.
- Edge-case handling (zero rates, zero/negative horizons, less-than-one period, and past targets) must match the specification.
- Unit tests covering the scenarios in the test plan (and the highlighted edge cases) must pass using the exact expected values listed.
