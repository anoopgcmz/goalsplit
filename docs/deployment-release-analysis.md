# GoalSplit — Deployment & Release Analysis

## Executive Summary

GoalSplit is a production-ready Next.js 15 application designed for **Vercel serverless deployment** with **MongoDB Atlas** as the managed database. No containerisation (Docker/Kubernetes) exists; the entire hosting model is platform-as-a-service. This document consolidates the full deployment path, environment requirements, release workflow, and operational considerations into one reference.

---

## 1. Architecture Overview

```
Browser
  │
  ▼
Vercel Edge Network (CDN + TLS termination)
  │
  ├── Next.js App Router (SSR pages, static assets)
  │
  ├── Next.js API Routes (serverless functions)
  │     ├── /api/auth/*         ← OTP-based authentication
  │     ├── /api/goals/*        ← Goal CRUD & planning
  │     ├── /api/contributions/* ← Contribution tracking
  │     ├── /api/shared/*       ← Shared goal invitations
  │     ├── /api/cron/*         ← Scheduled jobs (Vercel Cron)
  │     └── /api/health         ← Health check
  │
  └── Vercel Cron Jobs
        ├── Monthly check-ins  (0 8 1 * *)
        └── Weekly digest      (0 8 * * 1)

MongoDB Atlas (managed cloud database)
  └── Database: goalsplit
        ├── users, otp_codes, goals
        ├── contributions, invites
        ├── checkins, analytics_events

Email Provider
  ├── Primary: Resend (API key based)
  └── Fallback: SMTP (Postmark, SendGrid, etc.)
```

---

## 2. Environment Variables

All required secrets must be set in Vercel → Settings → Environment Variables before any deployment.

### Required (all environments)

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas SRV connection string |
| `MONGODB_DB` | Database name (e.g. `goalsplit`) |
| `JWT_SECRET` | ≥ 32-character random string for session signing |
| `EMAIL_FROM` | Sender address (e.g. `GoalSplit <notifications@yourdomain.com>`) |

### Email provider — pick one

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | API key from resend.com (recommended) |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (typically 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password / token |

### Local development only (`.env.local`)

Copy `.env.local.example` and fill in values. Never commit this file.

---

## 3. Infrastructure Provisioning

### 3.1 MongoDB Atlas

1. Create a project in [MongoDB Atlas](https://cloud.mongodb.com/).
2. Provision a dedicated cluster — **M10 minimum** for production (shared tiers lack the IOPS and backup features needed).
3. Choose the same cloud provider/region as your Vercel deployment to minimise latency.
4. Create a database user `goalsplit-prod` with read/write access scoped to the `goalsplit` database.
5. Under **Network Access**, allowlist Vercel's outbound IP ranges (see [Vercel docs](https://vercel.com/docs/integrations/databases/mongodb#allow-listing-vercel-ip-addresses)).
6. Copy the SRV connection string — this becomes `MONGODB_URI`.
7. Enable **Continuous Cloud Backup (Point-in-Time Recovery)** on the cluster.

### 3.2 Email Provider

**Option A — Resend (recommended)**
- Create an account at resend.com.
- Add and verify your sending domain.
- Generate an API key → set as `RESEND_API_KEY`.

**Option B — SMTP**
- Use Postmark, SendGrid, AWS SES, or any SMTP relay.
- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

### 3.3 Vercel Project

1. Import the repository from GitHub into a new Vercel project.
2. Framework preset: **Next.js** (auto-detected).
3. Set all environment variables (Section 2) for the **Production** environment.
4. Optionally mirror with safe non-production values for **Preview** and **Development** environments.

---

## 4. Deployment Pipeline

### 4.1 Automatic (recommended)

```
Git push to main branch
  → Vercel detects push
  → Installs dependencies (npm ci)
  → Runs next build
  → Deploys to production URL
  → Cron jobs become active
```

Every pull request automatically gets a **preview deployment** on a unique URL — useful for QA before merging.

### 4.2 Manual via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

### 4.3 Pre-deployment checklist (run locally first)

```bash
npm ci                  # clean install
npm run lint            # ESLint + TypeScript checks
npx tsc --noEmit        # type safety
npm run test            # Vitest unit tests
npm run build           # production build smoke test
```

All four must pass with zero errors before pushing to production.

---

## 5. Release Workflow

### 5.1 Branching strategy

```
feature/* or fix/* branches
  → Pull Request to main
  → Code review + CI (lint, typecheck, unit tests)
  → Merge to main
  → Automatic production deploy
```

### 5.2 Release tagging

After each production deployment, tag the commit:

```bash
git tag deploy-YYYYMMDD
git push origin deploy-YYYYMMDD
```

This enables fast rollback and creates a clean audit trail.

### 5.3 Semantic versioning (optional, recommended)

If you adopt version numbers, use `MAJOR.MINOR.PATCH`:
- **PATCH**: bug fixes, copy changes
- **MINOR**: new features (backwards compatible)
- **MAJOR**: breaking changes or major redesigns

Update `package.json` version and create a GitHub Release from the tag with a changelog.

---

## 6. Continuous Integration (Recommended Additions)

The project currently has no CI configuration file. The following GitHub Actions workflow covers the full pipeline:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run test
      - run: npm run build
```

Add this file to get automatic validation on every PR before it can be merged.

---

## 7. Rollback Strategy

### 7.1 Application rollback

1. Open Vercel → Deployments list.
2. Find the last known-good deployment (use deploy tags to identify it).
3. Click **Promote to Production**.
4. Verify health check passes: `GET /api/health`.

This takes ~30 seconds and requires no code changes.

### 7.2 Database rollback

If a migration or bad data write occurs:
1. Use MongoDB Atlas **Point-in-Time Restore** to create a new cluster from a pre-deployment snapshot.
2. Update `MONGODB_URI` in Vercel to point to the restored cluster.
3. Trigger a redeploy.

**Important**: the application has no schema migration framework. All Mongoose model changes must be backwards-compatible with existing Atlas data, or a data migration script must be written and run before deploying the new schema.

---

## 8. Cron Jobs

Defined in `vercel.json`:

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/checkins` | `0 8 1 * *` | Monthly check-in reminders (1st of month, 8 AM UTC) |
| `/api/cron/digest` | `0 8 * * 1` | Weekly digest emails (every Monday, 8 AM UTC) |

Cron jobs are only active on the **production deployment**. Verify they run correctly by checking Vercel logs after the first scheduled trigger. On Vercel's Hobby plan, cron jobs are limited; upgrade to Pro if you need more frequent schedules.

---

## 9. Post-Deploy Verification

Run these checks immediately after every production deployment:

- [ ] `GET /api/health` returns `200 OK`
- [ ] Homepage loads without console errors
- [ ] OTP login flow works end-to-end (email received and code accepted)
- [ ] Create a goal, add a contribution — data persists in Atlas
- [ ] Invitation email is delivered
- [ ] MongoDB Atlas metrics show active connections and low error rate
- [ ] HTTPS certificate is valid; no mixed-content warnings
- [ ] Vercel Analytics / Lighthouse Web Vitals within acceptable thresholds

---

## 10. Security Considerations

| Control | Implementation |
|---|---|
| Session cookies | HttpOnly, Secure, SameSite=Strict, 7-day TTL |
| JWT signing | `JWT_SECRET` validated by Zod at startup |
| OTP rate limiting | 5 requests/hour per email (`/api/auth/request-otp`) |
| Route authentication | `requireSessionUserId` / `requireUserId` helpers on all protected routes |
| Permission model | Owner vs. Collaborator enforced in API handlers |
| Environment validation | Zod schema in `src/lib/config.ts` rejects missing/invalid config at boot |
| Analytics PII | Personal fields redacted before event send; opt-in only |

**Hardening recommendations before first public launch:**
1. Add a `Content-Security-Policy` header in `next.config.ts`.
2. Enable rate limiting on all API routes (not just OTP), e.g. via Vercel's Edge Middleware or Upstash Redis.
3. Integrate an error-monitoring service (Sentry is the most straightforward with Next.js).
4. Set up Vercel log drains to forward production logs to a centralised service (Datadog, Logtail, etc.).
5. Enable MongoDB Atlas alerts for connection spikes, slow queries, and disk usage.

---

## 11. Scaling Considerations

| Layer | Current state | Scale path |
|---|---|---|
| Compute | Vercel serverless (auto-scales) | Already elastic; upgrade to Vercel Pro/Enterprise for concurrency limits |
| Database | MongoDB Atlas M10 | Vertical scale (M20/M30) or add read replicas; consider Atlas Search for future search features |
| Email | Resend / SMTP relay | Resend handles scale automatically; for SMTP verify provider limits |
| Cron | Vercel Cron (Hobby = 2 jobs) | Pro plan unlocks more jobs and higher frequency |
| Caching | None currently | Add Next.js `unstable_cache` or Redis (Upstash) for expensive DB queries |

---

## 12. Monitoring & Observability

### Currently available (no extra setup)
- **Vercel Analytics** — Web Vitals and visitor metrics
- **Vercel Function Logs** — Serverless function output, errors, durations
- **MongoDB Atlas Metrics** — Query performance, connections, index usage

### Recommended additions
- **Sentry** — Error tracking with Next.js SDK (source map upload built into Vercel)
- **Upstash Redis** — Rate limiting and caching at the edge
- **Logtail / Axiom** — Structured log aggregation via Vercel log drains

---

## 13. Summary & Recommended Release Steps

```
1. Provision MongoDB Atlas (M10+, backups on, network access configured)
2. Set up email provider (Resend or SMTP)
3. Add all environment variables to Vercel (Production)
4. Add .github/workflows/ci.yml for automated PR validation
5. Run local pre-flight: lint → typecheck → test → build
6. Push to main → Vercel auto-deploys
7. Run post-deploy verification checklist
8. Tag the Git commit: git tag deploy-YYYYMMDD && git push origin deploy-YYYYMMDD
9. Monitor Vercel logs and Atlas metrics for first 30 minutes
10. Mark release as successful in your release log
```

The application is architecturally complete and the ship-readiness checklist is fully green. The primary outstanding gap before production launch is **adding the CI workflow file** and **wiring up error monitoring** (Sentry). Both are straightforward one-time setup tasks.
