import { z } from 'zod';

export const AuthApiErrorCodeSchema = z.enum([
  'AUTH_VALIDATION_ERROR',
  'AUTH_RATE_LIMITED',
  'AUTH_INVALID_CODE',
  'AUTH_EXPIRED_CODE',
  'AUTH_UNAUTHORIZED',
  'AUTH_INTERNAL_ERROR',
]);

export type AuthApiErrorCode = z.infer<typeof AuthApiErrorCodeSchema>;

export const RequestOtpInputSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Please enter your email address so we can send a code.')
    .email('That email looks incorrect. Check the address and try again.')
    .transform((value) => value.toLowerCase()),
});

export const VerifyOtpInputSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Please enter your email address so we can verify the code.')
    .email('That email looks incorrect. Check the address and try again.')
    .transform((value) => value.toLowerCase()),
  code: z
    .string()
    .trim()
    .length(6, 'Enter the 6-digit code from your email.')
    .regex(/^\d{6}$/u, 'Use only digits in your 6-digit code.'),
});

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
});

export const VerifyOtpResponseSchema = z.object({
  user: AuthUserSchema,
});

export type RequestOtpInput = z.infer<typeof RequestOtpInputSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpInputSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;
