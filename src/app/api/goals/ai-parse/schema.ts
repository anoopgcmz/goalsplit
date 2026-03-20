import { z } from "zod";

export const AiParseResponseSchema = z.object({
  title: z.string(),
  targetAmount: z.number().positive(),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]),
  targetDate: z.string(),
  expectedRate: z.number().min(1).max(30),
  compounding: z.enum(["monthly", "yearly"]),
  contributionFrequency: z.enum(["monthly", "yearly"]),
  existingSavings: z.number().min(0),
  memberCount: z.number().int().min(1),
  perPersonAmount: z.number().positive(),
  perPersonMonthly: z.number().min(0),
  reasoning: z.string(),
});

export type AiParseResponse = z.infer<typeof AiParseResponseSchema>;
