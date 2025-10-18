# Annotated Wireframes

> All wireframes assume a desktop width of 1280px with responsive considerations noted inline. Components are designed with accessible labels, `aria-describedby` hooks, keyboard-focus outlines, and minimum 44px tap targets.

## /dashboard

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header (App title, user menu)                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ Page Title: "Your Goals"        [Add Goal ▸] (primary button, top-right)     │
│ ─ breadcrumb/nav (aria-label="Breadcrumb")                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Filter Row                                                                   │
│ ┌───────────┐  ┌───────────┐  ┌────────────────────────────────────────────┐ │
│ │ Status ▼ │  │ Owner ▼   │  │ Search input (with label, description)      │ │
│ └───────────┘  └───────────┘  └────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Goal Cards Grid (responsive 1–3 columns)                                     │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Title + [Shared] badge (aria-label)                                        │ │
│ │ Time left: 2 years 4 months (accessible text)                              │ │
│ │ Per-period need: $540/mo (data from /plan, aria-describedby="card-need")  │ │
│ │ Progress bar + amount saved                                                │ │
│ │ Secondary actions: View Plan, Manage Members (icon buttons with labels)    │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ "Add Goal" card (dashed border, large target)                             │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Accessibility notes**
- `Add Goal` primary button: `aria-label="Add a new goal"`, keyboard focus order after page title.
- Each card is a `<section>` with `aria-labelledby` linking to the goal title.
- Shared badge uses `<span role="status">` for assistive announcement.
- Card actions reachable via keyboard; focus ring maintained.

## /goals/new

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header                                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Breadcrumb: Goals ▸ New Goal                                                 │
│ Page Title: "Create a Goal"                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Form (two-column on desktop, single column on mobile)                        │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Fieldset: Goal Basics                                                     │ │
│ │ Label: Goal Title [_____________________] (description for character max) │ │
│ │ Label: Target Amount [_______] Currency [USD ▼]                           │ │
│ │ Label: Target Date [  date picker  ] (aria-describedby for format)        │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Fieldset: Growth Assumptions                                             │ │
│ │ Expected Rate [%____]   Compounding [Annual ▼]                            │ │
│ │ Contribution Frequency [Monthly ▼]                                        │ │
│ │ Existing Savings [_______] (with helper text)                             │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ Sticky footer: [Cancel] [Save Goal]                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Accessibility notes**
- All form controls use explicit `<label for>` relationships.
- Helper text surfaces validation via `aria-describedby` with inline error lists.
- Date picker supports keyboard input and arrow-key navigation.
- Sticky footer buttons have 48px height and full-width spacing for touch.

## /goals/[id]

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header + Breadcrumb                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Title: "Summer Home" [Shared badge] [Edit Goal]                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Summary Row (cards)                                                          │
│ ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                      │
│ │ Plan Summary  │  │ Lump Sum Need │  │ Assumptions   │                      │
│ │ Total goal,   │  │ Upfront amount│  │ Expected rate │                      │
│ │ saved, gap    │  │ to close gap  │  │ Frequency etc │                      │
│ └───────────────┘  └───────────────┘  └───────────────┘                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Members Table                                                                │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Columns: Member | Role | Contribution (Split % | Fixed) | Actions         │ │
│ │ Row add button "Invite Member" (opens dialog)                             │ │
│ │ Toggle between % and fixed per member with radio group                     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Invite Dialog (modal)                                                        │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Title: "Invite a collaborator"                                            │ │
│ │ Email input, role select, contribution preset                              │ │
│ │ [Cancel] [Send Invite]                                                     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Scenario Compare Panel                                                       │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Tabs: Base Plan | Optimistic | Pessimistic                                 │ │
│ │ Chart area with table of per-period need                                   │ │
│ │ Download CSV button                                                         │ │
│ │ Link: "Compare scenarios" (opens drawer, see compare-scenarios-drawer.md)   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Accessibility notes**
- Summary cards use semantic `<article>` and `aria-live="polite"` for updated values.
- Members table uses `<table>` with `<caption>` describing purpose; radio toggles grouped.
- Modal traps focus, close on Escape, and restores focus.
- Scenario tabs implemented with `role="tablist"`/`aria-selected` semantics and arrow-key support.

## /shared/accept

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Centered Card                                                                │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Logo                                                                      │ │
│ │ Heading: "Accept shared goal invite"                                      │ │
│ │ Summary: goal title, inviter, contribution share                           │ │
│ │ Form:                                                                     │ │
│ │   • Email (prefilled if query param)                                      │ │
│ │   • Display Name                                                          │ │
│ │   • Password / SSO buttons                                                │ │
│ │ Consent checkbox (aria-describedby for terms)                             │ │
│ │ [Decline] [Accept & Join Goal]                                            │ │
│ │ Progress indicator for multi-step (account -> confirmation)               │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ Confirmation screen with success icon + CTA to open goal                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Accessibility notes**
- Card centered within responsive container; maintains minimum 16px padding.
- Buttons have at least 44px height and visible focus states.
- Form inputs connect to helper text using `aria-describedby`; invalid states announced.
- SSO buttons have `aria-label` describing provider.

---

# Component Inventories & Prop Types

## /dashboard components

```ts
export interface DashboardPageProps {
  goals: GoalCardProps[];
  filters: {
    statusOptions: SelectOption[];
    ownerOptions: SelectOption[];
    selectedStatus?: string;
    selectedOwner?: string;
    searchQuery?: string;
  };
  onCreateGoal: () => void;
}

export interface GoalCardProps {
  id: string;
  title: string;
  isShared: boolean;
  timeRemainingLabel: string;
  perPeriodNeed: string;
  currency: string;
  progressPercent: number;
  savedAmountLabel: string;
  updatedAtIso: string;
  onViewPlan: (goalId: string) => void;
  onManageMembers: (goalId: string) => void;
}

export interface AddGoalCardProps {
  onClick: () => void;
  ariaLabel?: string;
}

export interface FilterBarProps {
  statusOptions: SelectOption[];
  ownerOptions: SelectOption[];
  selectedStatus?: string;
  selectedOwner?: string;
  searchQuery?: string;
  onStatusChange: (value: string | undefined) => void;
  onOwnerChange: (value: string | undefined) => void;
  onSearchChange: (value: string) => void;
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}
```

## /goals/new components

```ts
export interface GoalFormPageProps {
  currencies: SelectOption[];
  compoundingOptions: SelectOption[];
  frequencyOptions: SelectOption[];
  defaultValues?: Partial<GoalFormValues>;
  onSubmit: (values: GoalFormValues) => Promise<void> | void;
  onCancel: () => void;
}

export interface GoalFormValues {
  title: string;
  amount: number;
  currency: string;
  targetDate: string; // ISO date
  expectedRate: number;
  compounding: string;
  contributionFrequency: string;
  existingSavings: number;
}

export interface GoalFormFieldProps<T> {
  name: keyof GoalFormValues;
  label: string;
  description?: string;
  isRequired?: boolean;
  error?: string;
  value: T;
  onChange: (value: T) => void;
}

export interface StickyFormActionsProps {
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}
```

## /goals/[id] components

```ts
export interface GoalDetailPageProps {
  goalId: string;
  title: string;
  isShared: boolean;
  summaryCards: SummaryCardProps[];
  members: MemberRowProps[];
  scenarios: ScenarioCompareProps;
  onEditGoal: () => void;
  onInviteMember: () => void;
}

export interface SummaryCardProps {
  id: string;
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
  ariaLive?: 'off' | 'polite' | 'assertive';
}

export interface MembersTableProps {
  rows: MemberRowProps[];
  onAddMember: () => void;
  onUpdateMember: (memberId: string, updates: Partial<MemberRowProps>) => void;
  onRemoveMember: (memberId: string) => void;
}

export interface MemberRowProps {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member' | 'viewer';
  contributionMode: 'percentage' | 'fixed';
  percentageShare?: number;
  fixedContribution?: number;
  currency: string;
  isPending?: boolean;
}

export interface InviteDialogProps {
  isOpen: boolean;
  defaultEmail?: string;
  availableRoles: SelectOption[];
  contributionPresets: Array<{ label: string; value: number; mode: 'percentage' | 'fixed' }>;
  onClose: () => void;
  onSubmit: (payload: InvitePayload) => Promise<void> | void;
}

export interface InvitePayload {
  email: string;
  role: 'owner' | 'member' | 'viewer';
  contributionMode: 'percentage' | 'fixed';
  contributionValue: number;
  message?: string;
}

export interface ScenarioCompareProps {
  activeScenarioId: string;
  scenarios: ScenarioOption[];
  onScenarioChange: (scenarioId: string) => void;
  onDownload: (scenarioId: string) => void;
}

export interface ScenarioOption {
  id: string;
  label: string;
  description?: string;
  perPeriodNeed: string;
  chartData: Array<{ period: string; amount: number }>;
}
```

## /shared/accept components

```ts
export interface SharedAcceptPageProps {
  goalName: string;
  inviterName: string;
  proposedContribution: string;
  defaultEmail?: string;
  supportsSSO: boolean;
  onAccept: (values: SharedAcceptFormValues) => Promise<void> | void;
  onDecline: () => void;
}

export interface SharedAcceptFormValues {
  email: string;
  displayName: string;
  password?: string;
  consent: boolean;
  provider?: 'google' | 'apple' | 'microsoft';
}

export interface IdentityProviderButtonProps {
  provider: 'google' | 'apple' | 'microsoft';
  onSelect: (provider: 'google' | 'apple' | 'microsoft') => void;
}

export interface ProgressTrackerProps {
  currentStep: 'account' | 'confirmation';
  steps: Array<{ id: string; label: string; description?: string }>;
}
```

