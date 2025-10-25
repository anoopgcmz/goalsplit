import { z } from 'zod';

export const LocaleSchema = z.enum(['en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const BackoffHintSchema = z.object({
  strategy: z.literal('retry-after'),
  reason: z.literal('RATE_LIMIT'),
  retryAfterSeconds: z.number().int().positive(),
});
export type BackoffHint = z.infer<typeof BackoffHintSchema>;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  locale: LocaleSchema.default('en'),
  hint: z.string().optional(),
  backoff: BackoffHintSchema.optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiErrorResponseSchema = z.object({
  error: ApiErrorSchema,
  details: z.unknown().optional(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
