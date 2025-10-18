# Deployment Runbook

This runbook describes how to take the GoalSplit production stack live in a single pass. Follow each section in order and capture screen shots / logs for your release notes as you go.

---

## 1. Provision MongoDB Atlas

1. **Create the project & cluster**
   - Sign in to [MongoDB Atlas](https://cloud.mongodb.com/) and create (or select) the GoalSplit project.
   - Create a dedicated deployment ("M10" or larger for production). Choose the same cloud provider/region as your Vercel project for lower latency.
2. **Configure network access**
   - In *Security → Network Access*, add the outbound IPs used by Vercel.
     - For Vercel, request their [outbound IP list](https://vercel.com/docs/integrations/databases/mongodb#allow-listing-vercel-ip-addresses) and add each CIDR block.
     - Add your current workstation IP temporarily so you can test connectivity during launch.
   - If using a bastion/VPN, add that IP range as well.
3. **Create the database user**
   - In *Security → Database Access*, create a new user `goalsplit-prod` with *Read and write to any database* (or a custom role limited to the `goalsplit` database).
   - Generate a strong password and store it in your password manager.
4. **Capture the connection string**
   - From *Deployments → Database* click "Connect → Drivers" and copy the SRV connection string.
   - Replace the `<password>` placeholder with the credential you created and append the default database parameter: `...?retryWrites=true&w=majority&appName=GoalSplit`.
5. **Record required Atlas values**
   - `MONGODB_URI`: the SRV string from above.
   - `MONGODB_DB`: the application database name (e.g. `goalsplit`).
   - Keep these values ready for the Vercel environment configuration.

## 2. Configure Vercel Environment Variables

1. Open your Vercel project (Production environment).
2. Set or update the following variables under *Settings → Environment Variables*:

   | Key | Example Value | Notes |
   | --- | ------------- | ----- |
   | `MONGODB_URI` | `mongodb+srv://goalsplit-prod:<password>@cluster0.x.mongodb.net/?retryWrites=true&w=majority&appName=GoalSplit` | From Atlas step above. |
   | `MONGODB_DB` | `goalsplit` | Atlas database name. |
   | `JWT_SECRET` | `generate-32-char-random-string` | Use a cryptographically secure generator; store in vault. |
   | `EMAIL_FROM` | `GoalSplit <notifications@yourdomain.com>` | Must be verified with Resend/SMTP provider. |
   | `RESEND_API_KEY` | `re_...` | Provide **either** Resend or the full SMTP block. |
   | `SMTP_HOST` | `smtp.postmarkapp.com` | Optional when using SMTP. |
   | `SMTP_PORT` | `587` | Integer. |
   | `SMTP_USER` | `apikey` | SMTP username. |
   | `SMTP_PASS` | `...` | SMTP password/token. |

3. For preview and development environments, repeat with the appropriate non-production values.
4. Trigger a redeploy to ensure new variables propagate to the build.

## 3. Build, Health Checks & OTP Smoke Test

1. **Pre-flight build**
   - Run `npm install` and `npm run build` locally to confirm the codebase builds against production dependencies.
2. **Deploy to Vercel production**
   - Use Vercel CLI (`vercel deploy --prod`) or the Git→Production pipeline. Monitor the build log for failures.
3. **Health check**
   - Once live, hit the `/api/health` (or root page if no dedicated health endpoint) to confirm a `200 OK` response.
   - In Atlas, verify new connections appear in the *Real Time* tab.
4. **OTP delivery smoke test**
   - Use the staging or production login to request a one-time passcode.
   - Confirm email receipt:
     - **Resend**: Check the Resend dashboard for a `Delivered` event.
     - **SMTP**: Verify the SMTP provider (e.g., Postmark) logs a successful send. If using a test inbox, confirm message content and that links work.
   - If delivery fails, inspect Vercel logs (`vercel logs --prod`) for configuration issues.

## 4. Domain, HTTPS, and Caching Controls

1. **Domain binding**
   - In Vercel *Settings → Domains*, add `app.yourdomain.com` (or equivalent) and verify DNS.
   - Update your DNS provider with the CNAME/ALIAS record Vercel provides.
2. **HTTPS enforcement**
   - Ensure Vercel has generated the TLS certificate (status "Ready").
   - Enforce HTTPS via Vercel redirect settings or by enabling "Enforce HTTPS" in the domain configuration.
3. **Caching & robots rules**
   - Review `next.config.ts` and `public/robots.txt` (if present). Update `public/robots.txt` to allow production crawling and disallow staging paths as needed.
   - Configure cache headers via Vercel routes (`vercel.json`) or Next.js `headers()` if you need custom caching for API/static assets.
   - Purge any CDN cache if migrating from another host.

## 5. Backup & Rollback Strategy

1. **Database backups**
   - Enable MongoDB Atlas continuous cloud backups (Point-in-Time) for the production cluster.
   - Schedule daily snapshot exports to your backup storage (S3, etc.) if regulatory compliance requires it.
2. **Application artifacts**
   - Tag the Git commit that triggered the deployment (`git tag deploy-YYYYMMDD`) and push the tag.
   - Keep the previous production deployment on Vercel marked as "Ready" for immediate rollback.
3. **Rollback procedure**
   - **Application**: In Vercel, click the previous production deployment and choose "Promote to Production". Confirm traffic returns to healthy state.
   - **Database**: If needed, use Atlas's point-in-time restore to create a new cluster from the pre-deploy snapshot, update `MONGODB_URI`, and redeploy.
   - Record the incident and remediation in your release log.

## 6. Post-Deploy Verification Checklist

Perform these checks immediately after the deployment finishes:

- [ ] Homepage loads without console errors; navigation works.
- [ ] API endpoints return expected responses (e.g., `/api/goals`, `/api/auth/session`).
- [ ] New user signup/login succeeds, including OTP email delivery.
- [ ] Existing user data is intact (check sample accounts).
- [ ] MongoDB Atlas metrics show normal query throughput and low error rate.
- [ ] Error tracking (Sentry/Logflare/etc.) is connected and clean.
- [ ] Web vitals in Vercel Analytics or Lighthouse remain within acceptable thresholds.
- [ ] Domain resolves over HTTPS with valid certificate (no mixed content).
- [ ] CDN cache behaves as expected (no stale assets).

## 7. Acceptance Criteria

When every step above is completed and the post-deploy checklist passes, mark the release as successful. The runbook is designed to let an operator go live in one pass without additional tribal knowledge. Document any deviations for future revisions.
