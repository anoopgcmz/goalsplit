# Authentication UX Copy and Flow

This document defines the UX copy and annotated flows for the `/login` and `/logout` screens. It is intended to guide implementation of future TSX components.

## `/login` Flow Overview

1. **Step 1 – Enter email address**
   - Goal: Collect a valid email to send a one-time passcode (OTP).
   - Primary action: Send OTP.
2. **Step 2 – Enter verification code**
   - Goal: Validate the emailed code and establish an authenticated session via HttpOnly cookie.
   - Primary action: Verify code.
3. **Completion**
   - On success, close modal or redirect to the app home/dashboard depending on usage context.

### Flow States and Screen Copy

| Step | State | Purpose | Primary Copy | Supporting Copy / Notes |
| --- | --- | --- | --- | --- |
| 1 | Default | Invite email entry | **Heading:** "Welcome back"<br>**Description:** "Sign in with the email you use for GoalSplit." | Keep tone warm and inclusive, avoid assumptions about age or technical expertise. |
| 1 | Input field | Email capture | **Label:** "Email address"<br>**Placeholder:** "name@example.com"<br>**Assistive text:** "We’ll send a sign-in code to this email." | Ensure field is announced correctly by screen readers. |
| 1 | Primary CTA | Submit email | **Button:** "Send code" | Disabled until a syntactically valid email is entered. |
| 1 | Loading | Prevent duplicate submissions | **Button label while loading:** "Sending…" | Include aria-live polite status: "Sending your code." |
| 1 | Success | Confirm delivery | **Inline confirmation:** "Code sent! Please check your inbox." | Transition to Step 2 with focus on code input field. |
| 1 | Error: invalid email | User typed invalid email | **Error message:** "That email doesn’t look right. Check the address and try again." | Display under field, aria-live assertive. |
| 1 | Error: network/server | Request failed | **Error message:** "We couldn’t send the code just now. Please try again." | Show retry guidance; keep button enabled. |
| 1 | Error: rate limit | Too many attempts | **Error message:** "You’ve requested quite a few codes. Please wait 2 minutes before trying again." | Include countdown timer if available; disable CTA while waiting. |

| Step | State | Purpose | Primary Copy | Supporting Copy / Notes |
| --- | --- | --- | --- | --- |
| 2 | Default | Prompt for OTP | **Heading:** "Check your email"<br>**Description:** "Enter the 6-digit code we sent to `{{email}}`." | Provide accessible text so screen readers announce the target email. |
| 2 | Input field | OTP entry | **Label:** "Verification code"<br>**Placeholder:** "123456"<br>**Assistive text:** "The code expires in 10 minutes." | Multi-field or single field; ensure auto-advance between digits if multi-field. |
| 2 | Resend link available | Allow new code | **Link copy:** "Didn’t get it? Resend code" | Place near assistive text; disable for rate limit windows. |
| 2 | Primary CTA | Submit code | **Button:** "Sign in" | Disabled until 6 digits entered. |
| 2 | Loading | Prevent duplicate submissions | **Button label while loading:** "Signing you in…" | Provide aria-live polite status: "Verifying your code." |
| 2 | Success | Confirm authentication | **Inline confirmation:** "Success! You’re signed in." | Trigger HttpOnly session cookie handling and redirect logic. |
| 2 | Error: incorrect code | Wrong OTP | **Error message:** "That code isn’t correct. Please check the email and try again." | Clear input, return focus to field. |
| 2 | Error: expired code | OTP expired | **Error message:** "That code has expired. Request a new one to continue." | Offer resend option immediately. |
| 2 | Error: rate limit | Too many incorrect entries | **Error message:** "Too many attempts. You can try again in 5 minutes." | Disable input until timer ends. |
| 2 | Resend confirmation | Reinforce new code sent | **Toast or inline message:** "We’ve sent a new code to `{{email}}`." | Update expiry timer. |
| 2 | Resend rate limit | Limit resend frequency | **Inline message:** "You’ll be able to request another code in 30 seconds." | Provide countdown if possible. |

### Accessibility and Inclusivity Notes

- Use clear headings and labels that avoid jargon.
- Ensure status updates use `aria-live` regions for screen readers.
- Maintain sufficient color contrast for text and interactive elements.
- Allow keyboard navigation with logical focus order. When transitioning from Step 1 to Step 2, move focus to the verification input.
- Provide clear error messages without blame; indicate the issue and how to resolve it.
- Use inclusive language (e.g., "Sign in" instead of "Log in" if consistent across app).
- Support older adults by avoiding abbreviations without explanation; e.g., "code" instead of "OTP" in user-facing copy.

### Rate Limiting Guidance

- **Email send rate limit:** After 3 consecutive requests, present the 2-minute wait message and disable the "Send code" button with countdown.
- **Verification attempts:** After 5 incorrect entries, lock the form for 5 minutes with the rate-limit message. Keep the resend link disabled during the lockout.
- **Resend cooldown:** Require 30 seconds between resend attempts; surface countdown text next to the resend link.

### Screen Layout Notes (for TSX Implementation)

- Step containers should share consistent structure: heading, description, form controls, helper text, and secondary actions.
- Use a card or modal layout with centered alignment and generous spacing (min 24px) between sections for readability.
- Include an accessible back link: "Use a different email" during Step 2 to return to Step 1.
- Provide a persistent support link: "Need help? Contact support" pointing to help resources.

## `/logout` Flow Overview

1. **Trigger logout** (button or menu item).
2. **Server clears session** (HttpOnly cookie invalidated).
3. **User feedback** and redirection.

### Logout Copy

- **Menu item / button label:** "Sign out" (match existing app terminology).
- **Loading state (optional):** "Signing you out…"
- **Post-logout confirmation (optional toast before redirect):** "You’ve been signed out."
- **Redirect destination:** Public landing page or `/login` Step 1. Provide query parameter (e.g., `?signedOut=1`) to allow Step 1 to show an info banner: "You’ve been signed out. Sign in again to continue."

### Error Handling for Logout

- If session clearing fails, keep the user informed: "We couldn’t sign you out. Please try again." Offer retry.

## Annotated Flow Summary

```
Step 1: Enter email
  - Default state
  - Loading: "Sending…"
  - Success: move to Step 2, message "Code sent!"
  - Errors: invalid email, network, rate limit

Step 2: Enter code
  - Default state with email context
  - Loading: "Signing you in…"
  - Success: set session, redirect
  - Errors: incorrect code, expired code, rate limit
  - Resend: available with cooldown messaging, confirmations

Logout
  - Trigger
  - Optional loading
  - Success: confirmation + redirect
  - Error: retry message
```

These flows and copy are ready for implementation in TSX components, ensuring consistent, inclusive, and accessible microcopy across authentication surfaces.
