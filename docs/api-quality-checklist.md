# API Quality Checklist

This checklist captures the safeguards now enforced across the Goalsplit API surface.

## Enforcement points

1. **Zod validation on every boundary**
   - All request payloads, query parameters, and response bodies pass through Zod schemas before being processed or returned. Health checks, list endpoints, and authentication flows all parse their outputs before responding.
2. **OTP rate limiting with typed backoff hints**
   - OTP requests are capped at five per hour per email using persisted counters (`OtpRequestCounter`). When the threshold is exceeded the API returns a `429` with a structured `backoff` hint (`strategy: 'retry-after'`) so clients can provide accurate retry messaging.
3. **Friendly, localized error messaging and structured logging**
   - Error responses include human-friendly copy, actionable hints, and default to the `en` locale. Every error goes through the structured logger which emits JSON without PII (only hashed identifiers are logged for authentication flows).
4. **Split validation with actionable warnings**
   - Goal member percentages are checked on serialization. Responses include contextual warnings when percentage splits drift outside `100 ± 0.1` or when fixed and percent allocations mix, helping collaborators resolve ambiguous setups.
5. **Actionable messaging for past dates or zero amounts**
   - Goal creation/updates and contribution upserts now surface targeted Zod validation messages when users provide past target dates or zero-valued amounts, nudging them toward corrective actions.

## Sample typed failure payloads

```ts
import type { ApiErrorResponse } from '@/app/api/common/schemas';

const rateLimited: ApiErrorResponse = {
  error: {
    code: 'AUTH_RATE_LIMITED',
    message: 'We have sent the maximum number of codes to this email in the last hour.',
    locale: 'en',
    hint: 'Please wait a little while before requesting another code.',
    backoff: {
      strategy: 'retry-after',
      reason: 'RATE_LIMIT',
      retryAfterSeconds: 900,
    },
  },
};

const invalidSplit: ApiErrorResponse = {
  error: {
    code: 'GOAL_VALIDATION_ERROR',
    message: 'Please update the highlighted fields: Percent-based shares currently add up to 87.5%. Adjust them so they total 100%.',
    locale: 'en',
    hint: 'Review the goal details and try again.',
  },
};

const pastDate: ApiErrorResponse = {
  error: {
    code: 'GOAL_VALIDATION_ERROR',
    message: 'Please update the highlighted fields: Choose a future target date so we can map each step for you.',
    locale: 'en',
    hint: 'Review the goal details and try again.',
  },
};

const zeroContribution: ApiErrorResponse = {
  error: {
    code: 'CONTRIBUTION_VALIDATION_ERROR',
    message: 'Please update the highlighted fields: Enter an amount greater than zero so we can track your progress.',
    locale: 'en',
    hint: 'Double-check the contribution details and try again.',
  },
};
```

Each payload is aligned with the shared `ApiErrorResponse` contract so clients can rely on consistent structure for messaging, hints, and retry guidance.
