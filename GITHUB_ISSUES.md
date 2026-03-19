# GitHub Issues to Create

Create each of these as a GitHub Issue on https://github.com/anoopgcmz/goalsplit
Then open each one in Claude Code (claude.ai) and click Process / Run.

---

## ISSUE 1

**Title:** `feat: smart rate presets + currency formatter fix`

**Body:**
```
## Context
GoalSplit Next.js 15 app. Users must manually type their expected annual return rate — no guidance is given. The default is hardcoded as "8" in `src/features/goals/goal-form.ts`.

## What to build

### 1. Rate preset buttons on the goal form

In `src/app/goals/new/new-goal-page.client.tsx` and `src/app/goals/[id]/edit/edit-goal-page.client.tsx`, find the `expectedReturn` input field.

Above the input, add a row of preset buttons:

| Label | Value |
|-------|-------|
| HYSA ~4.5% | 4.5 |
| Index Funds ~8% | 8 |
| Mixed ~6% | 6 |

- Clicking a preset sets the `expectedReturn` field value and marks it as touched
- Manual input still works — presets just fill it
- Style as small secondary pill buttons; highlight the active preset when the value matches

### 2. Fix the currency formatter spread order

In `src/lib/formatters/plan-formatters.ts`, the `formatCurrency` function sets `minimumFractionDigits` / `maximumFractionDigits` explicitly and then spreads `...intlOptions`, which means callers cannot override those defaults. Fix the spread order so `...intlOptions` comes last and caller values win.

## Acceptance criteria
- [ ] Preset buttons appear on create and edit goal pages
- [ ] Clicking a preset fills the expected return field
- [ ] Active preset is visually highlighted when value matches
- [ ] `npm run build` passes with no TypeScript errors

## Branch
`claude/prompt-2-rate-presets-VNF3Z`
```

---

## ISSUE 2

**Title:** `feat: monthly contribution check-in flow`

**Body:**
```
## Context
GoalSplit already has a Contribution model (`src/models/contribution.ts`) and a shared goal system. The app needs an accountability layer: a monthly check-in that asks each group member "did you contribute this month?" via email and lets them respond with one click.

## What to build

### 1. New Mongoose model: `src/models/checkin.ts`

Fields:
- `goalId` ObjectId
- `userId` ObjectId
- `period` Date — normalized to first of month UTC
- `status` enum: `'confirmed' | 'skipped' | 'pending'`
- `amount` number (optional — actual contributed amount)
- `respondedAt` Date (optional)
- `token` string — crypto-secure 32-byte hex, unique
- `tokenExpiresAt` Date
- `createdAt`, `updatedAt`

Indexes: unique on `{ goalId, userId, period }`, unique on `token`.

### 2. New API route: `POST /api/checkins/respond`

- **Public** (no auth — uses token from email link)
- Body: `{ token: string, status: 'confirmed' | 'skipped', amount?: number }`
- Validates token exists and is not expired
- Updates checkin `status` and `respondedAt`
- If `status === 'confirmed'` and `amount` provided, upserts a Contribution record
- Returns `{ success: true, goalTitle: string, memberName: string | null }`

### 3. New API route: `GET /api/goals/[id]/checkins`

- Requires auth (use `requireUserId` pattern from `src/app/api/goals/utils.ts`)
- Query param: `period` (ISO date, defaults to current month)
- Returns checkin status for all goal members for that period
- Response: `{ period: string, members: Array<{ userId, name, email, status, amount, respondedAt }> }`

### 4. New cron route: `POST /api/cron/checkins`

- Secured by `Authorization: Bearer <CRON_SECRET>` header (env var `CRON_SECRET`)
- Logic:
  1. Find all shared goals (`isShared: true`) with `targetDate` in the future
  2. For each goal and each member, create a `CheckIn` record with `status: 'pending'`, generate a secure token, set `tokenExpiresAt` = 14 days from now
  3. Send check-in email to each member using `sendEmail` from `src/lib/email.ts`

### 5. Check-in email template — add to `src/lib/email-templates.ts`

```
Subject: Did you contribute to [Goal Title] this month?

Hi [Name],
Your group is saving toward [Goal Title].
Your share this month: [amount per period].

[ ✅ Yes, I contributed ] → /checkins/respond?token=XXX&status=confirmed
[ ❌ Not yet ]            → /checkins/respond?token=XXX&status=skipped
```

### 6. New page: `src/app/checkins/respond/page.tsx`

- Server component
- Reads `token` and `status` from URL search params
- Calls the respond API
- Shows confirmation: "Thanks! We've noted your contribution for [Goal Title]."
- Shows error if token is expired or invalid

## Acceptance criteria
- [ ] Cron endpoint creates checkin records and sends emails for all shared goal members
- [ ] Token-based respond URL updates checkin status without requiring login
- [ ] GET checkins endpoint returns member statuses for a goal/period
- [ ] `npm run build` passes

## Branch
`claude/prompt-3-checkin-flow-VNF3Z`

## Depends on
Email sending must be wired up first (`src/lib/email.ts` must exist).
```

---

## ISSUE 3

**Title:** `feat: group progress dashboard card`

**Body:**
```
## Context
GoalSplit is repositioning as an accountability layer for shared savings goals. The existing `GoalPlanPage` (`src/app/goals/[id]/goal-plan-page.tsx`) shows the plan and members table. The `CheckIn` model (from the check-in flow issue) stores self-reported status. The `Contribution` model (`src/models/contribution.ts`) stores logged amounts.

## What to build

### 1. New API: `GET /api/goals/[id]/progress`

Requires auth. Returns progress for the current month for each goal member:

```ts
{
  period: string,          // ISO date, first of current month
  members: Array<{
    userId: string,
    name: string | null,
    email: string,
    role: 'owner' | 'collaborator',
    requiredAmount: number,      // from goal plan calculation
    contributedAmount: number,   // from Contribution model (0 if none)
    checkinStatus: 'confirmed' | 'skipped' | 'pending' | 'no_checkin',
    isOnTrack: boolean,          // contributedAmount >= requiredAmount OR checkinStatus === 'confirmed'
  }>
}
```

### 2. New component: `src/components/group-progress.tsx`

Client component titled "This Month's Progress" for shared goals:

- Header: "X of Y members on track"
- Progress bar: % of members on track
- Member list with:
  - Name/email
  - Status badge: green "On track", amber "Pending", red "Behind", grey "No check-in"
  - Amount contributed vs required (e.g. "₹5,000 / ₹8,000")

Use existing `Badge` from `src/components/ui/badge.tsx` and `Card` from `src/components/ui/card.tsx`.

### 3. Integrate into `src/app/goals/[id]/goal-plan-page.tsx`

After `PlanSummaryCard`, for shared goals (`plan.goal.isShared === true`):
- Fetch `/api/goals/[id]/progress` on mount
- Render `GroupProgress` component
- Show skeleton while loading
- Gracefully hide on fetch failure (don't break the page)

## Acceptance criteria
- [ ] Progress card appears on shared goal plan pages
- [ ] Shows each member's on-track status for current month
- [ ] Non-shared goals: component is hidden
- [ ] `npm run build` passes

## Branch
`claude/prompt-4-group-progress-VNF3Z`

## Depends on
Check-in flow issue must be completed first (needs CheckIn model).
```

---

## ISSUE 4

**Title:** `feat: weekly digest email + Vercel cron config`

**Body:**
```
## Context
GoalSplit sends monthly check-in emails. We now need a weekly digest to keep groups engaged mid-month. Email infrastructure is in `src/lib/email.ts`. The `CheckIn` and `Contribution` models exist from the check-in flow issue.

## What to build

### 1. New cron route: `POST /api/cron/digest`

- Secured by `Authorization: Bearer <CRON_SECRET>` header
- Scheduled every Monday via Vercel Cron
- Logic:
  1. Find all shared goals with `targetDate` in the future
  2. For each goal, get current month's checkin statuses for all members
  3. Calculate: total members, confirmed, skipped, pending counts
  4. For each unique user who is a member of at least one shared goal, send ONE digest email summarising all their goals

### 2. Digest email template — add to `src/lib/email-templates.ts`

```
Subject: Your shared goals this week — GoalSplit

Hi [Name],

Here's how your groups are tracking this month:

[Goal Title 1]
✅ 2 on track · ⏳ 1 pending · ❌ 0 behind
Your contribution: ₹5,000 / ₹8,000

[Goal Title 2]
✅ 1 on track · ⏳ 2 pending
Your contribution: Not logged yet

[View all goals →]

Keep going — every contribution counts.
GoalSplit
```

Clean plain HTML, minimal styling (simple table or divs — no complex templates).

### 3. Create/update `vercel.json` with cron config

```json
{
  "crons": [
    {
      "path": "/api/cron/checkins",
      "schedule": "0 8 1 * *"
    },
    {
      "path": "/api/cron/digest",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

## Acceptance criteria
- [ ] Digest cron sends one email per user per week summarising all their shared goals
- [ ] Each goal section shows member status counts and user's own contribution
- [ ] `vercel.json` cron config is present
- [ ] `npm run build` passes

## Branch
`claude/prompt-5-weekly-digest-VNF3Z`

## Depends on
Email sending (`src/lib/email.ts`) and check-in flow must be completed first.
```

---

## ISSUE 5

**Title:** `feat: Google OAuth SSO login`

**Body:**
```
## Context
GoalSplit uses OTP-based passwordless login. Sessions are JWT stored in HttpOnly cookies. We want to add Google OAuth as an additional login option without breaking the existing OTP flow.

Key files:
- OTP flow: `src/app/api/auth/request-otp/route.ts`, `src/app/api/auth/verify-otp/route.ts`
- Session: `src/lib/auth/session.ts`, `src/lib/auth/jwt-secret.ts`
- Login page: `src/app/login/page.tsx`
- Auth guard: `requireUserId` in `src/app/api/goals/utils.ts`

## What to build

### 1. Install NextAuth v5

```
npm install next-auth@beta
```

### 2. Create `src/app/api/auth/[...nextauth]/route.ts`

Configure NextAuth with:
- Google provider (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` env vars)
- JWT callback: on sign-in, find or create a `User` document in MongoDB by email (use `UserModel` from `src/models/user.ts`), store MongoDB `_id` as `token.userId`
- Session callback: expose `session.user.id = token.userId`
- After Google sign-in succeeds, also set the existing app session cookie using `src/lib/auth/session.ts` so all existing protected routes work without middleware changes

### 3. Update `src/lib/config.ts`

Add optional env vars:
```ts
GOOGLE_CLIENT_ID: z.string().optional(),
GOOGLE_CLIENT_SECRET: z.string().optional(),
```

### 4. Update `src/app/login/page.tsx`

- Add "Continue with Google" button above the OTP form, calling `signIn('google')` from `next-auth/react`
- Separate sections with a visual "or" divider
- Only render the Google button if `GOOGLE_CLIENT_ID` is configured (pass as server prop)

### 5. Add to `.env.example`

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=random-32-char-string
NEXTAUTH_URL=http://localhost:3000
```

## Acceptance criteria
- [ ] OTP login works exactly as before (no regression)
- [ ] "Continue with Google" button appears on login page
- [ ] Google OAuth flow creates/finds user by email and logs them in
- [ ] After Google login, all existing protected routes work
- [ ] If `GOOGLE_CLIENT_ID` is not set, button is not rendered
- [ ] `npm run build` passes

## Branch
`claude/prompt-6-google-sso-VNF3Z`
```
