import { Types } from 'mongoose';
import { z } from 'zod';

export const normalizePeriod = (input: string | Date): Date => {
  const date = typeof input === 'string' ? new Date(input) : new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};

const ObjectIdStringSchema = z
  .string()
  .trim()
  .min(1, 'Goal identifier is required')
  .refine((value) => Types.ObjectId.isValid(value), {
    message: 'Invalid goal identifier supplied',
  });

const PeriodStringSchema = z
  .string()
  .trim()
  .min(1, 'Contribution period is required')
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Choose a valid contribution month to continue.',
  });

export const ContributionApiErrorCodeSchema = z.enum([
  'CONTRIBUTION_UNAUTHORIZED',
  'CONTRIBUTION_FORBIDDEN',
  'CONTRIBUTION_NOT_FOUND',
  'CONTRIBUTION_VALIDATION_ERROR',
  'CONTRIBUTION_INTERNAL_ERROR',
]);

export type ContributionApiErrorCode = z.infer<
  typeof ContributionApiErrorCodeSchema
>;

export const ContributionResponseSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  userId: z.string(),
  amount: z.number().min(0),
  period: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ContributionListResponseSchema = z.object({
  data: z.array(ContributionResponseSchema),
});

export const UpsertContributionInputSchema = z.object({
  goalId: ObjectIdStringSchema,
  amount: z.coerce
    .number()
    .finite()
    .refine((value) => value > 0, {
      message:
        'Enter an amount greater than zero so we can track your progress.',
    }),
  period: PeriodStringSchema,
});

export const ContributionListQuerySchema = z.object({
  goalId: ObjectIdStringSchema.optional(),
  period: PeriodStringSchema.transform((value) => normalizePeriod(value)).optional(),
});

export type ContributionResponse = z.infer<typeof ContributionResponseSchema>;
export type ContributionListResponse = z.infer<
  typeof ContributionListResponseSchema
>;
export type UpsertContributionInput = z.infer<
  typeof UpsertContributionInputSchema
>;
export type ContributionListQuery = z.infer<
  typeof ContributionListQuerySchema
>;
