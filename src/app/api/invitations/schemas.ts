import { z } from "zod";

export const InvitationStatusSchema = z.enum(["pending", "accepted", "declined", "expired"]);

export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const InvitationResponseSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  goalTitle: z.string(),
  inviterName: z.string().nullable(),
  inviterEmail: z.string().email().nullable(),
  inviteeEmail: z.string().email(),
  message: z.string().nullable(),
  status: InvitationStatusSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
});

export const InvitationGoalPreviewSchema = z.object({
  title: z.string(),
  targetAmount: z.number().nonnegative(),
  currency: z.string(),
  targetDate: z.string().datetime(),
  expectedRate: z.number().nonnegative(),
  ownerName: z.string().nullable(),
});

export const InvitationDetailResponseSchema = z.object({
  invitation: InvitationResponseSchema,
  goal: InvitationGoalPreviewSchema.nullable(),
});

export const InvitationListResponseSchema = z.object({
  invitations: z.array(InvitationResponseSchema),
});

export const InvitationStatusQuerySchema = z
  .union([
    InvitationStatusSchema,
    z.literal("all"),
    z.array(InvitationStatusSchema),
  ])
  .optional();

export type InvitationResponse = z.infer<typeof InvitationResponseSchema>;
export type InvitationListResponse = z.infer<typeof InvitationListResponseSchema>;
export type InvitationDetailResponse = z.infer<typeof InvitationDetailResponseSchema>;
export type InvitationGoalPreview = z.infer<typeof InvitationGoalPreviewSchema>;
