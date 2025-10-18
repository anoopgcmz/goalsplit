# API Helper Contracts

This document describes the strongly-typed helpers and shared types that must be implemented to support authenticated API requests. The goal is to provide consistent, type-safe primitives across both server and client code. Only the contracts and usage expectations are captured here; refer to the implementation files for executable code.

## Shared Auth Types

Place the following type declarations in a shared module (for example, `src/types/auth.ts`) so both server and client bundles can import them without causing runtime side effects.

```ts
import type { ZodIssue } from 'zod';

export type UserId = string & { readonly __tag: unique symbol };

export interface User {
  id: UserId;
  email: string;
  name: string | null;
  createdAt: string; // ISO-8601 timestamp
  updatedAt: string; // ISO-8601 timestamp
}

export interface SessionPayload {
  userId: UserId;
  issuedAt: number; // epoch milliseconds
  expiresAt: number; // epoch milliseconds
  scopes: ReadonlyArray<string>;
}

export interface ApiSuccess<TData> {
  ok: true;
  data: TData;
}

export interface ApiError<TCode extends string = string> {
  ok: false;
  error: {
    code: TCode;
    message: string;
    issues?: ReadonlyArray<ZodIssue>;
  };
}

export type ApiResponse<TData, TCode extends string = string> =
  | ApiSuccess<TData>
  | ApiError<TCode>;
```

These types establish a minimal, serialisable contract. Implementations may narrow them further (e.g., with branded `UserId` constructors) so long as the exported surface matches the shapes above.

## `getUserFromCookie`

### Signature

```ts
async function getUserFromCookie(): Promise<User | null>;
```

### Constraints

- **Environment:** Server-only helper (can rely on `next/headers`, Node cookies, etc.).
- **Input:** Reads the active HTTP request cookie jar; no parameters are required.
- **Output:** Resolves with a hydrated `User` when the session cookie is present and valid, otherwise `null`.
- **Session Validation:** Must decode a `SessionPayload`, ensure `expiresAt` is in the future, and fetch the associated `User`.
- **Errors:** Throwing should be reserved for unexpected states (e.g., corrupt cookies). Callers should treat a resolved `null` as “not authenticated.”

### Example Usage

```ts
// Server route handler
import { getUserFromCookie } from '@/lib/auth/server';

export async function GET() {
  const user = await getUserFromCookie();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  return Response.json({ greeting: `Hello, ${user.name ?? user.email}!` });
}
```

## `fetchJSON`

### Signature

```ts
async function fetchJSON<TReq, TRes, TErrorCode extends string = string>(
  input: RequestInfo | URL,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: TReq;
    signal?: AbortSignal;
    parseResponse?: (raw: unknown) => TRes;
    validateError?: (raw: unknown) => ApiError<TErrorCode>['error'];
  }
): Promise<ApiResponse<TRes, TErrorCode>>;
```

### Constraints

- **Environment:** Available in both server and client bundles. Must call the platform `fetch` internally and set `credentials: 'include'` so cookies are sent.
- **Request Encoding:** Automatically JSON-stringify the `body` when provided and set `Content-Type: application/json` unless the caller overrides it.
- **Response Handling:**
  - Parse successful responses as JSON and return `{ ok: true, data }`.
  - For HTTP errors (`!response.ok`), parse JSON, run `validateError` when provided, and return `{ ok: false, error }`.
  - When validation fails, throw an error annotated with the original payload for diagnostics.
- **Zod Integration:** Callers can pass Zod schemas to `parseResponse`/`validateError` to ensure type-safe results. The helper should surface validation failures via exceptions so they are easy to trace during development.
- **Type Preservation:** The generic parameters must flow from the caller: the request body type is inferred from `body`, and the resolved `ApiResponse` carries the expected response payload and error code union.

### Example Usage

```ts
import { fetchJSON } from '@/lib/api/fetch-json';
import { z } from 'zod';
import type { ApiResponse } from '@/types/auth';

const UpdateProfileRequest = z.object({
  name: z.string().min(1),
});

type UpdateProfileBody = z.infer<typeof UpdateProfileRequest>;

const UpdateProfileResponse = z.object({
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().email(),
  }),
});

type UpdateProfileSuccess = z.infer<typeof UpdateProfileResponse>;

const UpdateProfileError = z.union([
  z.object({
    code: z.literal('UNAUTHORIZED'),
    message: z.string(),
  }),
  z.object({
    code: z.literal('VALIDATION_FAILED'),
    message: z.string(),
    issues: z.array(z.any()).optional(),
  }),
]);

type UpdateProfileErrorCode = z.infer<typeof UpdateProfileError>['code'];

async function updateProfile(name: string): Promise<ApiResponse<UpdateProfileSuccess, UpdateProfileErrorCode>> {
  return fetchJSON<UpdateProfileBody, UpdateProfileSuccess, UpdateProfileErrorCode>(
    '/api/profile',
    {
      method: 'PATCH',
      body: UpdateProfileRequest.parse({ name }),
      parseResponse: (raw) => UpdateProfileResponse.parse(raw),
      validateError: (raw) => UpdateProfileError.parse(raw),
    }
  );
}
```

This example shows how the helper keeps request/response types in sync while relying on Zod for runtime safety.

---

Implementers should adhere to these contracts to guarantee consistent behaviour across the codebase.
