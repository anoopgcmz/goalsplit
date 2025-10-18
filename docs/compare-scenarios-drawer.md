# Compare Scenarios Drawer UX Specification

## Purpose and Entry Points
- Gives goal owners a quick way to evaluate alternate growth assumptions without leaving `/goals/[id]`.
- Opens from the "Scenario Compare Panel" via a tertiary "Compare scenarios" button. Drawer slides in from the right on desktop (max width 480px) and converts to a full-height sheet on mobile.
- Drawer traps focus while open and restores the triggering control on close. Close affordances: an "X" icon button, pressing `Escape`, or activating the backdrop.

## Layout Overview
```
┌────────────────────────── Drawer Header ──────────────────────────┐
│ Title: "Compare scenarios"    [Reset] [Close ✕]                  │
├───────────────────────────────────────────────────────────────────┤
│ Helper text: "Adjust rate or timeline to preview funding impact." │
├────────────── Controls Column ─────────────┬──── Scenario Grid ───┤
│ Rate (%) slider + value input              │ ┌──────────────────┐ │
│ Timeline adjuster (months/years)           │ │ Base Plan       │ │
│ Contribution frequency display             │ │ Scenario A      │ │
│ Existing savings summary                   │ │ Scenario B (opt)│ │
│ Save scenario button (desktop footer)      │ └──────────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│ Mobile sticky actions: [Reset] [Close] [Save scenario]            │
└───────────────────────────────────────────────────────────────────┘
```

### Controls
- **Rate slider**
  - Range `0%–20%`, defaulting to the plan's existing rate.
  - Step of `0.1` with a number input mirror for precise entry (steppers `±0.1`).
  - Labelled `Expected annual growth rate` with helper text describing historic context.
  - Slider uses native `<input type="range">` with `aria-valuetext="{value}%"`.

- **Timeline adjuster**
  - Two-segment toggle for adjusting the goal completion target.
    - Primary segmented control: `± 1 year`, `± 6 months`, `Custom…`.
    - When `Custom…` is chosen, reveal a number input (min `-60`, max `+60` months) with label `Timeline adjustment (months)`.
  - Helper text: "Negative numbers pull the target date sooner.".
  - Ensure each toggle button has `role="radio"` semantics for screen readers.

- **Meta summary**
  - Non-editable summary chips showing `Contribution frequency` and `Existing savings`. These are read-only but reflow to highlight how calculations incorporate the base plan assumptions.

- **Actions**
  - `Reset` resets controls to the base plan (rate delta = 0, timeline delta = 0).
  - `Save scenario` persists the current adjustments (implementation defined) and disabled while calculations are running.

### Scenario Grid Columns
- Render two columns by default: **Base Plan** and **Scenario Preview**. A third column labeled **Scenario B** appears when the user chooses "Add comparison" (inline button above grid).
- Each column is a `<section>` with `aria-labelledby` tied to its heading.
- Content stack (per column):
  1. Column heading (e.g., `Base Plan`, `Preview`, `Scenario B`).
  2. Metric list using definition list semantics (`<dl>`):
     - `Per-period contribution` (currency) — computed via `requiredPaymentForFutureValue`.
     - `Lump sum required today` (currency) — computed via `requiredLumpSumForFutureValue`.
     - `Total contributions` (currency) — sum of per-period contributions across the adjusted period plus existing savings.
     - `Projected growth` (currency) — `goal target - total contributions` with floor at `0`.
  3. Support copy under Preview column: `Based on +{rate delta}% growth and timeline {delta string}.`
  4. Badges for deltas vs. base (e.g., `+ $120/mo`, `- 4 months`). Positive changes use success color tokens from the design system; negative use warning tokens.

## Calculation Rules
- Use `src/lib/financial.ts` functions for all recomputations.
- **Inputs shared across columns:** target amount, existing savings, contribution frequency (monthly or annual), compounding frequency (map to `CompoundingFrequency`), base target date.
- **Derived timeline:** convert timeline adjustment into `tYears = max((baseMonths + deltaMonths) / 12, 0.25)` to avoid division by zero.
- **Per-period contribution:**
  - Use `requiredPaymentForFutureValue(netTarget, rate, nPerYear, tYears)` where `netTarget = netTargetAfterExisting(target, existing, rate, nPerYear, tYears)`.
- **Lump sum requirement:** compute using `requiredLumpSumForFutureValue(netTarget, rate, nPerYear, tYears)`.
- **Total contributions vs. growth:**
  - `totalContributions = existing + (perPeriod * periodCount)`.
  - `projectedGrowth = target - totalContributions` with floor at `0`.
- Round currency outputs to the nearest dollar for display, with a tooltip showing the cents precision.

## Server vs. Client Responsibilities
- Initial drawer open:
  - If the goal detail view already has a fresh `/plan` payload (generated in the last 5 minutes or since the last goal edit), reuse it without a new request.
  - Otherwise, call `GET /plan` once to hydrate base plan values before rendering the grid (show skeleton loaders while fetching).
- Client-side recompute:
  - Rate slider and timeline adjustments must recompute instantly in the client using the finance engine utilities; no additional `/plan` requests.
  - Adding/removing comparison columns also remains client-side—new columns clone the base plan snapshot, applying independent deltas.
- Server re-sync:
  - Trigger `/plan` refresh only when the user saves a scenario **and** the underlying goal configuration (members, contribution splits, target amount) has changed externally since the drawer opened (detected via plan version stamp). In that case, show a non-blocking toast `Refreshing plan…` and update the base column once the request resolves.

## Accessibility Requirements
- Drawer has `role="dialog"` with `aria-modal="true"` and accessible name from the title.
- All controls reachable via keyboard in logical order; slider and number inputs expose live updates via `aria-live="polite"` region placed before the scenario grid (`<div aria-live="polite" aria-atomic="true">Updated projections for {column}</div>`).
- Color-only cues supplemented with text (e.g., `+$120/mo more than base`).
- Columns collapse to stacked cards on mobile with headings promoted to buttons for quick navigation (accordion behavior with ARIA attributes).

## Acceptance Tests
1. **Drawer opens with focus management**
   - Given a user on `/goals/[id]`, when they activate "Compare scenarios", focus moves to the drawer title and `aria-modal` is true. On pressing `Escape`, the drawer closes and focus returns to the trigger.
2. **Rate slider instant recompute**
   - With the drawer open and base plan hydrated, when the user drags the rate slider by at least `+1%`, the Preview column updates per-period, lump sum, total contributions, and projected growth numbers without network latency (no new `/plan` request recorded) and the change is announced in the live region.
3. **Timeline adjustment instant recompute**
   - When the user selects `+6 months`, the Preview column updates all computed numbers within 100ms, announces the delta textually, and updates the delta badges (e.g., `+6 months`).
4. **Accessibility of controls**
   - Tabbing through controls reaches the slider, timeline toggle, Reset, Save scenario, and Close in order. Screen reader announces slider value with `%` and timeline adjustments with human-readable deltas.
5. **Reset behavior**
   - After applying adjustments in multiple columns, activating `Reset` returns all columns to base plan values instantly and the live region announces `Scenario reset to base plan`.
6. **Server refresh on external change**
   - Given the goal configuration changes while the drawer is open (simulated via mocked plan version mismatch), saving a scenario triggers exactly one `/plan` request. Base column values refresh once the request resolves, while scenario deltas remain applied relative to the new base.
