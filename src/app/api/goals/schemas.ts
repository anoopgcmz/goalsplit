import { z } from 'zod';


export const GoalApiErrorCodeSchema = z.enum([
  'GOAL_UNAUTHORIZED',
  'GOAL_FORBIDDEN',
  'GOAL_NOT_FOUND',
  'GOAL_VALIDATION_ERROR',
  'GOAL_CONFLICT',
  'GOAL_INTERNAL_ERROR',
]);

export type GoalApiErrorCode = z.infer<typeof GoalApiErrorCodeSchema>;

export const GoalMemberRoleSchema = z.enum(['owner', 'collaborator']);

export const GoalMemberResponseSchema = z.object({
  userId: z.string(),
  role: GoalMemberRoleSchema,
  splitPercent: z.number().min(0).max(100).optional(),
  fixedAmount: z.number().min(0).optional(),
});

export const GoalResponseSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  targetAmount: z.number(),
  currency: z.string(),
  targetDate: z.string(),
  expectedRate: z.number(),
  compounding: z.enum(['monthly', 'yearly']),
  contributionFrequency: z.enum(['monthly', 'yearly']),
  existingSavings: z.number().min(0).optional(),
  isShared: z.boolean(),
  members: z.array(GoalMemberResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const GoalListResponseSchema = z.object({
  data: z.array(GoalResponseSchema),
  pagination: z.object({
    page: z.number().min(1),
    pageSize: z.number().min(1),
    totalItems: z.number().min(0),
    totalPages: z.number().min(0),
  }),
  sort: z.object({
    by: z.enum(['createdAt', 'targetDate', 'title']),
    order: z.enum(['asc', 'desc']),
  }),
});

export const GoalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'targetDate', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateGoalInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  targetAmount: z.coerce.number().finite().min(0),
  currency: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .transform((value) => value.toUpperCase()),
  targetDate: z.coerce.date(),
  expectedRate: z.coerce.number().finite().min(0),
  compounding: z.enum(['monthly', 'yearly']),
  contributionFrequency: z.enum(['monthly', 'yearly']),
  existingSavings: z.coerce.number().finite().min(0).optional(),
});

export const UpdateGoalInputSchema = CreateGoalInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one field must be supplied',
    path: [],
  }
);

export type CreateGoalInput = z.infer<typeof CreateGoalInputSchema>;
export type UpdateGoalInput = z.infer<typeof UpdateGoalInputSchema>;
export type GoalListQuery = z.infer<typeof GoalListQuerySchema>;
export type GoalResponse = z.infer<typeof GoalResponseSchema>;
export type GoalListResponse = z.infer<typeof GoalListResponseSchema>;
