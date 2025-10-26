import { z } from "zod";

export const GoalApiErrorCodeSchema = z.enum([
  "GOAL_UNAUTHORIZED",
  "GOAL_FORBIDDEN",
  "GOAL_NOT_FOUND",
  "GOAL_VALIDATION_ERROR",
  "GOAL_CONFLICT",
  "GOAL_INTERNAL_ERROR",
]);

export type GoalApiErrorCode = z.infer<typeof GoalApiErrorCodeSchema>;

export const GoalMemberRoleSchema = z.enum(["owner", "collaborator"]);

export const GoalMemberResponseSchema = z.object({
  userId: z.string(),
  role: GoalMemberRoleSchema,
  splitPercent: z.number().min(0).max(100).optional(),
  fixedAmount: z.number().min(0).optional(),
});

export const GoalPlanMemberSchema = GoalMemberResponseSchema.extend({
  perPeriod: z.number(),
  email: z.string().email().optional(),
  name: z.string().trim().min(1).optional().nullable(),
});

export const GoalPlanResponseSchema = z.object({
  goal: z.object({
    id: z.string(),
    title: z.string(),
    currency: z.string(),
    targetAmount: z.number(),
    targetDate: z.string(),
    expectedRate: z.number(),
    compounding: z.enum(["monthly", "yearly"]),
    contributionFrequency: z.enum(["monthly", "yearly"]),
    existingSavings: z.number(),
    isShared: z.boolean(),
  }),
  horizon: z.object({
    years: z.number().min(0),
    months: z.number().min(0).max(11),
    totalPeriods: z.number().min(0),
    nPerYear: z.union([z.literal(1), z.literal(12)]),
  }),
  totals: z.object({
    perPeriod: z.number(),
    lumpSumNow: z.number(),
  }),
  members: z.array(GoalPlanMemberSchema),
  assumptions: z.object({
    expectedRate: z.number(),
    compounding: z.enum(["monthly", "yearly"]),
    contributionFrequency: z.enum(["monthly", "yearly"]),
  }),
  warnings: z.array(z.string()).optional(),
});

export const GoalResponseSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  targetAmount: z.number(),
  currency: z.string(),
  targetDate: z.string(),
  expectedRate: z.number(),
  compounding: z.enum(["monthly", "yearly"]),
  contributionFrequency: z.enum(["monthly", "yearly"]),
  existingSavings: z.number().min(0).optional(),
  isShared: z.boolean(),
  members: z.array(GoalMemberResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  warnings: z.array(z.string()).optional(),
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
    by: z.enum(["createdAt", "targetDate", "title"]),
    order: z.enum(["asc", "desc"]),
  }),
});

export const GoalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "targetDate", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const GoalDetailsSchema = z.object({
  title: z
    .string({
      required_error: "Add a descriptive title.",
      invalid_type_error: "Add a descriptive title.",
    })
    .trim()
    .min(1, "Add a descriptive title.")
    .max(200, "Keep the title under 200 characters."),
  targetAmount: z
    .coerce
    .number({ invalid_type_error: "Enter how much the goal costs." })
    .finite({ message: "Enter how much the goal costs." }),
  currency: z
    .string({
      required_error: "Pick a currency.",
      invalid_type_error: "Pick a currency.",
    })
    .trim()
    .min(1, "Pick a currency.")
    .max(10, "Pick a valid currency code." )
    .transform((value) => value.toUpperCase()),
  targetDate: z
    .coerce
    .date({ invalid_type_error: "Choose when you'll need the money." })
    .refine((value) => Number.isFinite(value.getTime()), {
      message: "Choose when you'll need the money.",
    }),
  expectedRate: z
    .coerce
    .number({ invalid_type_error: "Enter an expected yearly return." })
    .finite({ message: "Enter an expected yearly return." })
    .gt(0, "Use a rate between 0 and 100%.")
    .max(100, "Use a rate between 0 and 100%."),
  compounding: z.enum(["monthly", "yearly"], {
    required_error: "Pick how often returns are compounded.",
    invalid_type_error: "Pick how often returns are compounded.",
  }),
  contributionFrequency: z.enum(["monthly", "yearly"], {
    required_error: "Pick how often you contribute.",
    invalid_type_error: "Pick how often you contribute.",
  }),
  existingSavings: z
    .coerce
    .number({ invalid_type_error: "Savings can't be negative." })
    .finite({ message: "Savings can't be negative." })
    .min(0, "Savings can't be negative.")
    .optional(),
});

type GoalDetails = z.infer<typeof GoalDetailsSchema>;
type GoalDetailsPartial = Partial<GoalDetails>;

const enforceGoalBusinessRules = (value: GoalDetailsPartial, ctx: z.RefinementCtx) => {
  if ("targetAmount" in value && typeof value.targetAmount === "number") {
    if (value.targetAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set a target amount greater than zero to plan your savings.",
        path: ["targetAmount"],
      });
    }
  }

  if (value.targetDate instanceof Date) {
    if (value.targetDate.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a future target date so we can map each step for you.",
        path: ["targetDate"],
      });
    }
  }

  if ("expectedRate" in value && typeof value.expectedRate === "number") {
    if (value.expectedRate <= 0 || value.expectedRate > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use a rate between 0 and 100%.",
        path: ["expectedRate"],
      });
    }
  }
};

export const CreateGoalInputSchema = GoalDetailsSchema.superRefine((value, ctx) =>
  enforceGoalBusinessRules(value, ctx),
);

export const UpdateGoalInputSchema = GoalDetailsSchema.partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be supplied",
    path: [],
  })
  .superRefine((value, ctx) =>
    enforceGoalBusinessRules(value as GoalDetailsPartial, ctx),
  );

export type CreateGoalInput = z.infer<typeof CreateGoalInputSchema>;
export type UpdateGoalInput = z.infer<typeof UpdateGoalInputSchema>;
export type GoalListQuery = z.infer<typeof GoalListQuerySchema>;
export type GoalResponse = z.infer<typeof GoalResponseSchema>;
export type GoalListResponse = z.infer<typeof GoalListResponseSchema>;
export type GoalPlanResponse = z.infer<typeof GoalPlanResponseSchema>;

const GoalMemberContributionSchema = z
  .object({
    userId: z
      .string({ required_error: "Each member needs an identifier." })
      .trim()
      .min(1, "Each member needs an identifier."),
    role: GoalMemberRoleSchema,
    splitPercent: z
      .number({ invalid_type_error: "Enter a split percent between 0 and 100." })
      .min(0, "Split percent must be at least 0%.")
      .max(100, "Split percent cannot exceed 100%.")
      .nullable()
      .optional(),
    fixedAmount: z
      .number({ invalid_type_error: "Enter a fixed contribution of zero or more." })
      .min(0, "Fixed amount cannot be negative.")
      .nullable()
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.splitPercent == null && value.fixedAmount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a split percent or fixed amount.",
        path: ["splitPercent"],
      });
    }

    if (value.splitPercent != null && value.fixedAmount != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either a percent or a fixed amount for each member.",
        path: ["fixedAmount"],
      });
    }
  });

export const UpdateGoalMembersInputSchema = z
  .object({
    members: z
      .array(GoalMemberContributionSchema, {
        required_error: "Include at least one member to update.",
        invalid_type_error: "Include at least one member to update.",
      })
      .min(1, "Include at least one member to update."),
  })
  .superRefine((value, ctx) => {
    const ownerCount = value.members.filter((member) => member.role === "owner").length;

    if (ownerCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Keep the goal owner in the members list.",
        path: ["members"],
      });
    }
  });

export const CreateGoalInviteInputSchema = z
  .object({
    email: z
      .string({
        required_error: "Enter the collaborator's email address.",
        invalid_type_error: "Enter the collaborator's email address.",
      })
      .trim()
      .min(1, "Enter the collaborator's email address.")
      .email("Enter a valid email address.")
      .transform((value) => value.toLowerCase()),
    message: z
      .string({ invalid_type_error: "Use letters, numbers, and punctuation in your message." })
      .trim()
      .max(500, "Keep the invitation message under 500 characters.")
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    expiresInMinutes: z
      .coerce
      .number({ invalid_type_error: "Set how long the invite should stay active." })
      .int({ message: "Invite expiry must be a whole number of minutes." })
      .min(1, "Invite expiry must be at least one minute.")
      .default(10080),
    defaultSplitPercent: z
      .union([
        z
          .coerce
          .number({ invalid_type_error: "Enter a default split percentage." })
          .finite({ message: "Enter a default split percentage." })
          .min(0, "Split percent must be at least 0%.")
          .max(100, "Split percent cannot exceed 100%.") ,
        z.undefined(),
        z.null(),
      ])
      .transform((value) => value ?? undefined),
    fixedAmount: z
      .union([
        z
          .coerce
          .number({ invalid_type_error: "Enter a fixed amount using numbers only." })
          .finite({ message: "Enter a fixed amount using numbers only." })
          .min(0, "Fixed amount cannot be negative."),
        z.undefined(),
        z.null(),
      ])
      .transform((value) => value ?? null),
  })
  .superRefine((value, ctx) => {
    const hasSplit = value.defaultSplitPercent != null;
    const hasFixed = value.fixedAmount != null;

    if (!hasSplit && !hasFixed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set a default split percent or fixed amount for the invite.",
        path: ["defaultSplitPercent"],
      });
    }

    if (hasSplit && hasFixed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either a percent or a fixed amount for the invite.",
        path: ["fixedAmount"],
      });
    }
  });

export type GoalMemberContributionInput = z.infer<typeof GoalMemberContributionSchema>;
export type UpdateGoalMembersInput = z.infer<typeof UpdateGoalMembersInputSchema>;
export type CreateGoalInviteInput = z.infer<typeof CreateGoalInviteInputSchema>;
