# UI/API Wiring Readiness Checklist

All items checked to confirm the UI is ready for API integration. Evidence links point to the relevant screens or components in this repo.

| Status | Item | Evidence |
| --- | --- | --- |
| ✅ | All pages exist and navigate correctly | [App shell navigation](../src/components/layout/app-shell.tsx#L12-L115) wires Dashboard, Goals, and New goal routes with responsive drawer behaviour, auto-closing on route change, and skip link support. |
| ✅ | Forms validate and show errors | [New goal form](../src/app/goals/new/page.tsx#L24-L165) centralises validation, toggles `aria-invalid`, and surfaces inline error copy; [login flow](../src/app/login/page.tsx#L25-L240) provides per-step loading and error feedback. |
| ✅ | Loading/empty/error states covered | [Goal plan page](../src/app/goals/[id]/goal-plan-page.tsx#L152-L232) renders skeletons, retries, and empty fallbacks; [Goals list](../src/app/goals/page.tsx#L19-L55) includes an archived empty state component. |
| ✅ | Numbers formatted and accessible | [Formatter hook](../src/lib/hooks/use-formatters.ts#L18-L86) wraps `Intl` with fallbacks, and [plan summary usage](../src/app/goals/[id]/goal-plan-page.tsx#L476-L519) applies consistent currency/percent copy. |
| ✅ | Scenario compare works locally | [ScenarioCompare drawer](../src/app/goals/[id]/goal-plan-page.tsx#L535-L773) stores adjustments in state, clamps ranges, and re-computes projections with accessible controls. |
| ✅ | Members & invite flows complete (UI) | [MembersSection](../src/app/goals/[id]/goal-plan-page.tsx#L905-L1484) covers editable splits, removal confirmations, and invite modal with status messaging; [invite acceptance](../src/app/shared/accept/page.tsx#L86-L341) handles token load, error, and retry UI. |
| ✅ | Copy & disclaimers in place | [Global footer](../src/components/layout/app-shell.tsx#L116-L129) includes planning disclaimers; headings and helper text across forms emphasise non-advisory language. |
| ✅ | Responsive & a11y checks passed | [App shell](../src/components/layout/app-shell.tsx#L24-L114) provides focus-managed mobile nav, skip link, and ARIA roles; [member table inputs](../src/app/goals/[id]/goal-plan-page.tsx#L933-L1149) supply captions, helper IDs, and keyboard arrow handling. |

