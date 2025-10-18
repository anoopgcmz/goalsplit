# Authentication API Specification

## OpenAPI Definition
```yaml
openapi: 3.1.0
info:
  title: Authentication API
  version: 1.0.0
servers:
  - url: https://api.example.com
paths:
  /api/auth/request-otp:
    post:
      summary: Request a one-time passcode for authentication
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RequestOtpInput'
      responses:
        '204':
          description: OTP requested successfully
        '400':
          description: Invalid request payload
        '429':
          description: OTP request rate limited
  /api/auth/verify-otp:
    post:
      summary: Verify an OTP and establish an authenticated session
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VerifyOtpInput'
      responses:
        '200':
          description: OTP verified and session created
          headers:
            Set-Cookie:
              description: >-
                HttpOnly, Secure, SameSite=strict session cookie with a 7-day expiry
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VerifyOtpResponse'
        '400':
          description: Invalid OTP or payload
        '401':
          description: OTP expired or already consumed
        '429':
          description: OTP verification rate limited
  /api/me:
    get:
      summary: Retrieve the currently authenticated user
      tags:
        - Authentication
      security:
        - sessionCookieAuth: []
      responses:
        '200':
          description: Authenticated user details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VerifyOtpResponse'
        '401':
          description: Missing or invalid session
components:
  securitySchemes:
    sessionCookieAuth:
      type: apiKey
      in: cookie
      name: session
  schemas:
    RequestOtpInput:
      type: object
      required:
        - email
      properties:
        email:
          type: string
          format: email
    VerifyOtpInput:
      type: object
      required:
        - email
        - code
      properties:
        email:
          type: string
          format: email
        code:
          type: string
          description: One-time passcode received via email
    User:
      type: object
      required:
        - id
        - email
      properties:
        id:
          type: string
        email:
          type: string
          format: email
        name:
          type: string
          nullable: true
    VerifyOtpResponse:
      type: object
      required:
        - user
      properties:
        user:
          $ref: '#/components/schemas/User'
```

## Zod Schemas
```ts
import { z } from 'zod';

export const RequestOtpInputSchema = z.object({
  email: z.string().email(),
});
export type RequestOtpInput = z.infer<typeof RequestOtpInputSchema>;

export const VerifyOtpInputSchema = z.object({
  email: z.string().email(),
  code: z.string(),
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpInputSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const VerifyOtpResponseSchema = z.object({
  user: UserSchema,
});
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;
```

## Security Notes
- Session cookies MUST be set with `HttpOnly`, `Secure`, and `SameSite=strict` attributes and expire 7 days after issuance.
- OTP requests MUST be rate limited to a maximum of 5 requests per hour per email. When the limit is exceeded, respond with HTTP `429 Too Many Requests` and include an exponential backoff hint (e.g., `Retry-After`).
- OTP codes MUST automatically expire 10 minutes after issuance and MUST NOT be reusable once consumed.
- OTP verification failures SHOULD respond with `401 Unauthorized` when an OTP is expired or already consumed and `400 Bad Request` for malformed payloads.
