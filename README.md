# GoalSplit Planner

This is a Next.js App Router project bootstrapped with TypeScript, Tailwind CSS, ESLint, and Prettier. It presents an accessible landing page for the GoalSplit planner, focusing on shared financial goals with fixed returns and neutral guidance.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to view the page.

## Scripts

- `npm run dev` - Start the development server.
- `npm run build` - Create a production build of the application.
- `npm run start` - Run the production build locally.
- `npm run lint` - Lint the project using ESLint with TypeScript support.
- `npm run seed:dummy` - Seed demo users and OTP codes for local login.

## Dummy Login

Run the seed script and copy the credentials printed to your terminal:

```bash
npm run seed:dummy
```

Then visit `/login` and enter any of the listed email + OTP combinations.

## Environment Setup

1. Copy the example environment file and adjust it for your environment:

   ```bash
   cp .env.local.example .env.local
   ```

2. Update the values in `.env.local`:
   - `MONGODB_URI` and `MONGODB_DB` should match your MongoDB deployment and database name.
   - `EMAIL_FROM` must be a verified sender address for your email provider.
   - Choose an email provider:
     - Provide a `RESEND_API_KEY`, **or**
     - Supply the complete set of SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

3. Generate a strong JWT secret and paste it into `JWT_SECRET`. Any unpredictable 32+ character string works. A convenient command is:

   ```bash
   openssl rand -base64 48
   ```

The application loads configuration through `src/lib/config.ts`, which validates the environment using Zod on startup. Missing or invalid values cause a descriptive `EnvValidationError` so misconfiguration is detected immediately.

## Accessibility Defaults

- Base font size increased for readability.
- High contrast color palette with clear foreground/background separation.
- Consistent focus outlines to maintain visible focus states across interactive elements.

## Security & Privacy

### Route Access Overview

GoalSplit relies on a session cookie (or an `x-user-id` header during automated tests) to gate protected APIs. Endpoints listed in `PROTECTED_ROUTE_MATCHERS` require a valid session and immediately return `401` or `403` when the caller is not authorized.

```ts
const PROTECTED_ROUTE_MATCHERS = [
  '/api/goals/:path*',
  '/api/contributions/:path*',
  '/api/shared/:path*',
];
```

- **Public route:** `GET /api/health` exposes connectivity diagnostics and does not require authentication.
- **Protected routes:** Goal, contribution, and shared-goal invitation endpoints all call `requireUserId`, so they demand a valid session cookie or matching `x-user-id` header before continuing.

### Typed Permission Matrix

```ts
type Role = 'owner' | 'collaborator';

type PermissionMatrix = {
  'goal:view': Record<Role, boolean>;
  'goal:update': Record<Role, boolean>;
  'goal:delete': Record<Role, boolean>;
  'goal:invite': Record<Role, boolean>;
  'split:edit': Record<Role, boolean>;
  'contribution:manage-self': Record<Role, boolean>;
};

const PERMISSIONS: PermissionMatrix = {
  'goal:view': { owner: true, collaborator: true },
  'goal:update': { owner: true, collaborator: false },
  'goal:delete': { owner: true, collaborator: false },
  'goal:invite': { owner: true, collaborator: false },
  'split:edit': { owner: true, collaborator: false },
  'contribution:manage-self': { owner: true, collaborator: true },
};
```

- **Viewing shared goals:** Owners and collaborators can fetch shared goal details because membership is validated before responding.
- **Editing goals and splits:** Only owners can PATCH or otherwise change goal metadata, including contribution splits.
- **Deleting goals:** Only owners can delete a goal; doing so cascades to invites and contribution records.
- **Inviting collaborators:** Owners alone can issue invitations for their goals.
- **Managing contributions:** All authenticated users can create or update their own contribution entries; the API automatically scopes data to the caller’s user ID.

### Data Privacy Boundaries

- Membership checks on goal routes ensure collaborators only see goals they belong to; private goals remain invisible to other users.
- Contribution queries are filtered by the caller’s user ID, so collaborators cannot inspect other members’ contributions or unrelated goals.
- Invitation acceptance verifies the invitee’s email before granting access, preventing lateral movement between goals.

### Session Cookie & Logout

- Sessions are maintained with an HttpOnly, Secure, SameSite=`strict` cookie that expires after 7 days. The cookie is never accessible to client-side JavaScript.
- Logging out instructs the server to invalidate the session and clear the cookie, after which all protected routes return `401` until the user signs in again.
