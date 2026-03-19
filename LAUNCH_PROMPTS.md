# GoalSplit MVP Launch Prompts

Execute these prompts **in order**. Each is self-contained for your agentic AI.

---

## PROMPT 1 — Wire Email Sending (BLOCKER)

**Context:**
You are working on a Next.js 15 / MongoDB app called GoalSplit at `/home/user/goalsplit`.

The app has a fully configured email system (`src/lib/config.ts`) that supports two providers:
- **Resend** (if `RESEND_API_KEY` env var is set) — preferred
- **SMTP** (if `SMTP_HOST/PORT/USER/PASS` env vars are set) — fallback

The `config` object exported from `src/lib/config.ts` already has `config.email` typed as `EmailConfig` which is either `{ provider: 'resend', from, apiKey }` or `{ provider: 'smtp', from, host, port, user, pass }`.

**Two places need email sending wired up — both currently do nothing after saving to DB:**

**1. OTP login email** (`src/app/api/auth/request-otp/route.ts`)
After line 145 (`await createOtpCode(email)`), the OTP code is generated and stored in MongoDB but never emailed. The user never receives it. Fix this by sending the OTP code via email.

**2. Invitation email** (`src/app/api/goals/[id]/invite/route.ts`)
After `InviteModel.create(...)` on line 56, an invite record is created with `token`, `inviteUrl`, `inviterName`, `goalTitle`, and `message` but no email is sent to the invitee. Fix this by emailing the invite URL to `parsedBody.email`.

**What to build:**

1. Create `src/lib/email.ts` — a shared email service with this interface:
   ```ts
   export async function sendEmail(options: {
     to: string;
     subject: string;
     html: string;
     text: string;
   }): Promise<void>
   ```
   Inside, read `config.email` and dispatch via:
   - Resend: install `resend` package if not present, use `new Resend(apiKey).emails.send(...)`
   - SMTP: install `nodemailer` if not present, use `nodemailer.createTransport(...).sendMail(...)`

2. Create `src/lib/email-templates.ts` with two functions:
   - `otpEmailTemplate(code: string): { subject, html, text }` — clean email telling user their 6-digit login code, expires in 10 minutes
   - `inviteEmailTemplate(options: { inviterName: string | null, goalTitle: string, inviteUrl: string, message?: string | null }): { subject, html, text }` — email telling the recipient they've been invited to collaborate on a savings goal, with a clear CTA button linking to `inviteUrl`

3. In `src/app/api/auth/request-otp/route.ts`: after `await createOtpCode(email)`, call `sendEmail` with the OTP template. If sending fails, log the error but still return 204 (don't break login because of email failure).

4. In `src/app/api/goals/[id]/invite/route.ts`: after `InviteModel.create(...)`, call `sendEmail` with the invite template. If sending fails, log the error but still return 201 with the `inviteUrl`.

5. Do NOT send emails for demo emails (check `isDemoEmail(email)` from `src/lib/auth/demo.ts` before sending OTP emails).

**Acceptance criteria:**
- `npm run build` passes with no TypeScript errors
- Demo login still works without email (no email sent for demo emails)
- Non-demo OTP: email is attempted after code is generated
- Invite: email is attempted after invite record is created

---

## PROMPT 2 — Smart Rate Presets + Currency Formatter Fix

**Context:**
GoalSplit is a Next.js 15 app at `/home/user/goalsplit`. Users create savings goals and must manually type their expected annual return rate. The default is `"8"` (hardcoded in `src/features/goals/goal-form.ts` line 37).

Users don't know what rate to pick. We need preset buttons.

**What to build:**

**1. Rate preset buttons on the goal form**

In `src/app/goals/new/new-goal-page.client.tsx` and `src/app/goals/[id]/edit/edit-goal-page.client.tsx`, find the `expectedReturn` input field.

Above the input, add a row of preset buttons:
```
[ HYSA ~4.5% ]  [ Index Funds ~8% ]  [ Mixed ~6% ]
```

Clicking a preset sets the `expectedReturn` field value to `4.5`, `8`, or `6` respectively and marks the field as touched. The manual input should still work — presets just populate it.

The preset buttons should be styled as small secondary pill buttons. Highlight the active preset if the current value matches exactly.

**2. Fix the currency formatter**

In `src/lib/formatters/plan-formatters.ts`, the `formatCurrency` function passes `minimumFractionDigits` and `maximumFractionDigits` as spread `...intlOptions` AFTER setting them explicitly. This means callers that pass `minimumFractionDigits: 0` can be overridden by the defaults. Audit the spread order and ensure caller options take precedence over defaults (the explicit assignments should come first, and `...intlOptions` should be the override layer).

**Acceptance criteria:**
- Preset buttons appear on create and edit goal pages
- Clicking a preset fills the expected return field
- Active preset is visually highlighted
- `npm run build` passes with no TypeScript errors

---

## PROMPT 3 — Contribution Check-in Flow

**Context:**
GoalSplit (`/home/user/goalsplit`) already has a `Contribution` model (`src/models/contribution.ts`) that stores `{ goalId, userId, amount, period }` with a unique index on `(goalId, userId, period)`. The upsert API is at `POST /api/contributions`.

The core repositioning of GoalSplit is **accountability between group members**. Right now the app has no way to ask members "did you contribute this month?" or log a simple yes/no.

**What to build:**

**1. New Mongoose model: `src/models/checkin.ts`**
```ts
interface CheckIn {
  goalId: ObjectId;
  userId: ObjectId;
  period: Date;          // normalized to first of month (UTC)
  status: 'confirmed' | 'skipped' | 'pending';
  amount?: number;       // actual amount if they contributed a different amount
  respondedAt?: Date;
  token: string;         // crypto-secure 32-byte hex token for one-click email response
  tokenExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
// Unique index: { goalId, userId, period }
// Index on token (unique)
```

**2. New API route: `POST /api/checkins/respond`**
- Public endpoint (no auth required — uses token from email link)
- Body: `{ token: string, status: 'confirmed' | 'skipped', amount?: number }`
- Validates token exists, is not expired
- Updates checkin status, respondedAt
- If `status === 'confirmed'` and `amount` is provided, upserts a Contribution record
- Returns `{ success: true, goalTitle: string, memberName: string | null }`

**3. New API route: `GET /api/goals/[id]/checkins`**
- Requires auth (existing `requireUserId` pattern from `src/app/api/goals/utils.ts`)
- Query params: `period` (ISO date string, defaults to current month)
- Returns checkin status for all members of the goal for that period
- Response: `{ period: string, members: Array<{ userId, name, email, status, amount, respondedAt }> }`

**4. New cron API route: `POST /api/cron/checkins`**
- Secured by `Authorization: Bearer <CRON_SECRET>` header (env var `CRON_SECRET`)
- Runs on the 1st of each month (called by Vercel Cron or external scheduler)
- Logic:
  1. Find all shared goals (`isShared: true`) with `targetDate` in the future
  2. For each goal, for each member, create a `CheckIn` record with `status: 'pending'`, generate a secure `token`, set `tokenExpiresAt` to 14 days from now
  3. Send a check-in email to each member using the email service from Prompt 1

**5. Check-in email template** — add to `src/lib/email-templates.ts`:
```
Subject: Did you contribute to [Goal Title] this month?

Hi [Name],
Your group is saving toward [Goal Title].
Your share this month: [amount per period].

[ ✅ Yes, I contributed ] → links to /checkins/respond?token=XXX&status=confirmed
[ ❌ Not yet ] → links to /checkins/respond?token=XXX&status=skipped
```

**6. New page: `src/app/checkins/respond/page.tsx`**
- Server component
- Reads `token` and `status` from URL search params
- Calls the respond API
- Shows a simple confirmation page: "Thanks! We've noted your contribution for [Goal Title]."
- If token is expired or invalid, show an error message

**Acceptance criteria:**
- Cron endpoint creates checkin records and sends emails for all shared goal members
- Token-based respond URL updates the checkin status without requiring login
- GET checkins endpoint returns member statuses for a goal/period
- `npm run build` passes

---

## PROMPT 4 — Group Progress Dashboard View

**Context:**
GoalSplit (`/home/user/goalsplit`) is repositioning as an accountability layer for shared savings goals. The key missing UI is a view showing each group member's contribution status: are they on track, behind, or unknown?

The existing `GoalPlanPage` component (`src/app/goals/[id]/goal-plan-page.tsx`) already shows the plan and members table. It uses `GoalPlanResponse` from `src/app/api/goals/schemas.ts` which includes `members[].perPeriod` (the required amount per period per member).

The `CheckIn` model (added in Prompt 3) stores self-reported contribution status. The `Contribution` model (`src/models/contribution.ts`) stores actual logged amounts.

**What to build:**

**1. New API: `GET /api/goals/[id]/progress`**
- Requires auth
- Returns progress for the current month for each goal member:
```ts
{
  period: string, // ISO date (first of current month)
  members: Array<{
    userId: string,
    name: string | null,
    email: string,
    role: 'owner' | 'collaborator',
    requiredAmount: number,       // from goal plan calculation
    contributedAmount: number,    // from Contribution model (0 if none)
    checkinStatus: 'confirmed' | 'skipped' | 'pending' | 'no_checkin',
    isOnTrack: boolean,           // contributedAmount >= requiredAmount OR checkinStatus === 'confirmed'
  }>
}
```

**2. New React component: `src/components/group-progress.tsx`**

A client component that shows a card titled "This Month's Progress" for shared goals. It displays:
- A header showing overall status: e.g., "3 of 4 members on track"
- A progress bar showing % of members on track
- A list of members with:
  - Name/email
  - Status badge: green "On track", amber "Pending", red "Behind", grey "No check-in"
  - Amount contributed vs required (e.g., "₹5,000 / ₹8,000")

Use the existing `Badge` component from `src/components/ui/badge.tsx` and `Card` from `src/components/ui/card.tsx`.

**3. Integrate into `src/app/goals/[id]/goal-plan-page.tsx`**

After the `PlanSummaryCard`, for shared goals (`plan.goal.isShared === true`), fetch and render the `GroupProgress` component. Fetch from `/api/goals/[id]/progress` on mount. Show a skeleton while loading. Gracefully hide if the fetch fails (don't break the page).

**Acceptance criteria:**
- Progress card appears on shared goal plan pages
- Shows each member's on-track status for current month
- Non-shared goals show nothing (component hidden)
- `npm run build` passes

---

## PROMPT 5 — Weekly Digest Email

**Context:**
GoalSplit (`/home/user/goalsplit`) sends check-in emails monthly (Prompt 3). Now we need a weekly digest that keeps groups engaged mid-month.

Email infrastructure is in `src/lib/email.ts`. The `Goal` model (`src/models/goal.ts`) has `isShared: boolean` and `members: GoalMember[]`. The `CheckIn` model and `Contribution` model exist from Prompt 3.

**What to build:**

**1. New cron route: `POST /api/cron/digest`**
- Secured by `Authorization: Bearer <CRON_SECRET>` header
- Scheduled to run every Monday (called externally by Vercel Cron or scheduler)
- Logic:
  1. Find all shared goals with `targetDate` in the future
  2. For each goal, get the current month's checkin statuses for all members
  3. Calculate: total members, confirmed count, skipped count, pending count
  4. For each **unique user** who is a member of at least one shared goal, send ONE digest email summarizing all their shared goals

**2. Digest email template** — add to `src/lib/email-templates.ts`:
```
Subject: Your shared goals this week — GoalSplit

Hi [Name],

Here's how your groups are tracking this month:

[Goal Title 1]
✅ 2 members on track · ⏳ 1 pending · ❌ 0 behind
Your contribution: ₹5,000 / ₹8,000

[Goal Title 2]
✅ 1 members on track · ⏳ 2 pending
Your contribution: Not logged yet

[View all goals →] — links to the app

Keep going — every contribution counts.
GoalSplit
```

The email should be clean plain HTML with minimal styling (no complex templates). A simple table or div structure is fine.

**3. Add Vercel cron config**

Create or update `vercel.json` in the project root to include:
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

**Acceptance criteria:**
- Digest cron endpoint sends one email per user per week summarizing all their shared goals
- Each goal section shows member status counts and user's own contribution status
- `vercel.json` cron config is present
- `npm run build` passes

---

## PROMPT 6 — Google OAuth SSO (Add Last)

**Context:**
GoalSplit (`/home/user/goalsplit`) uses OTP-based passwordless login. The OTP flow is in:
- `src/app/api/auth/request-otp/route.ts`
- `src/app/api/auth/verify-otp/route.ts`
- `src/app/login/page.tsx`
- Session management: `src/lib/auth/session.ts` and `src/lib/auth/jwt-secret.ts`

Sessions are stored as JWT in HttpOnly cookies. The `requireUserId` helper in `src/app/api/goals/utils.ts` reads the JWT from the request cookie.

We want to add Google OAuth as an **additional** login option. OTP login must continue to work unchanged.

**What to build:**

**1. Install dependencies**
```
npm install next-auth@beta
```
Use NextAuth v5 (beta) which is compatible with Next.js App Router.

**2. Create `src/app/api/auth/[...nextauth]/route.ts`**

Configure NextAuth with:
- Google provider (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` env vars)
- Custom JWT callback that on sign-in:
  1. Finds or creates a `User` document in MongoDB by email (use `UserModel` from `src/models/user.ts`)
  2. Stores the MongoDB `_id` as `token.userId`
- Custom session callback that exposes `session.user.id = token.userId`

**3. Update `src/lib/config.ts`**

Add optional env vars for Google OAuth:
```ts
GOOGLE_CLIENT_ID: z.string().optional(),
GOOGLE_CLIENT_SECRET: z.string().optional(),
```
These are optional — if not set, SSO button is simply not shown.

**4. Update `src/app/login/page.tsx`**

Add a "Continue with Google" button above the OTP form. The button calls `signIn('google')` from `next-auth/react`. Separate the two sections with a visual divider ("or").

Only render the Google button if `GOOGLE_CLIENT_ID` is configured (check via a server component or pass as a prop).

**5. Ensure existing session compatibility**

The existing OTP flow sets its own JWT cookie (`session` cookie) via `src/lib/auth/session.ts`. NextAuth uses its own cookie (`next-auth.session-token`).

Update `src/middleware.ts` to check EITHER cookie for authentication. If NextAuth session is present and valid, extract the user ID and allow access just like the existing OTP cookie.

Alternatively (simpler): after Google sign-in succeeds, in the NextAuth `signIn` callback, also set the existing app session cookie using `src/lib/auth/session.ts` so the rest of the app sees a valid session without any middleware changes.

**6. Environment variables to document**

Add to `.env.example` (or equivalent):
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=random-32-char-string
NEXTAUTH_URL=http://localhost:3000
```

**Acceptance criteria:**
- OTP login works exactly as before
- "Continue with Google" button appears on login page
- Google OAuth flow creates/finds user by email and logs them in
- After Google login, all existing protected routes work (API calls succeed)
- If `GOOGLE_CLIENT_ID` is not set, the button is not rendered
- `npm run build` passes

---

## Execution Order Summary

| # | Prompt | Est. Effort | Dependency |
|---|--------|-------------|------------|
| 1 | Wire email sending | 1–2 days | None (do first) |
| 2 | Rate presets + currency fix | 0.5 day | None (can parallelize with 1) |
| 3 | Contribution check-in flow | 2–3 days | Prompt 1 (needs email) |
| 4 | Group progress dashboard | 1–2 days | Prompt 3 (needs checkin data) |
| 5 | Weekly digest email | 1 day | Prompts 1 + 3 |
| 6 | Google SSO | 2 days | None (do last) |
