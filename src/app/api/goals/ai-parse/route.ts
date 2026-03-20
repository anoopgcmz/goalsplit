import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createErrorResponse,
  isNextResponse,
  requireUserId,
} from "@/app/api/goals/utils";
import { requiredPaymentForFutureValue, yearFractionFromDates } from "@/lib/financial";
import { AiParseResponseSchema, type AiParseResponse } from "./schema";

const AiParseRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(10, "Please describe your goal in a bit more detail.")
    .max(1000, "Keep the description under 1000 characters."),
});

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function buildSystemPrompt(today: string): string {
  return `You are a financial goal planning assistant. Extract structured savings goal data from natural language descriptions.

Today's date: ${today}

Parsing rules:
- Indian number shorthands: 1L = 100000, 5L = 500000, 10L = 1000000, 1Cr = 10000000
- Currency detection: ₹ / rupees / lakh / crore / L / Cr → INR, $ / dollar → USD, € / euro → EUR, £ / pound → GBP. Default: INR
- Relative time: "12 months" → add 12 months to today, "next year" → add 1 year, "6 months" → add 6 months, etc.
- "me and N friends" → memberCount = N + 1, "5 people" → memberCount = 5
- Suggest expectedRate by goal type: travel=6, vacation=6, emergency=4.5, home=7, house=7, retirement=11, education=8, wedding=6, car=6. Default: 8
- Default compounding and contributionFrequency to "monthly" unless user specifies yearly

Return ONLY valid JSON with no extra text:
{
  "title": "Short descriptive goal title (max 60 chars)",
  "targetAmount": number,
  "currency": "INR" | "USD" | "EUR" | "GBP",
  "targetDate": "YYYY-MM-DD",
  "expectedRate": number,
  "compounding": "monthly" | "yearly",
  "contributionFrequency": "monthly" | "yearly",
  "existingSavings": number,
  "memberCount": number,
  "reasoning": "1-2 sentences explaining key decisions (amount, rate, members)"
}`;
}

export async function POST(request: NextRequest) {
  const userIdOrResponse = requireUserId(request);
  if (isNextResponse(userIdOrResponse)) {
    return userIdOrResponse;
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "AI goal parsing is not configured on this server. Please add a GROQ_API_KEY environment variable.",
      503,
      { logLevel: "warn", context: { reason: "missing-groq-api-key" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(
      "GOAL_VALIDATION_ERROR",
      "We could not read that request. Please check the data and try again.",
      400,
    );
  }

  const parsed = AiParseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Invalid input." },
      { status: 422 },
    );
  }

  const { prompt } = parsed.data;
  const today = new Date().toISOString().split("T")[0]!;

  let groqResponse: Response;
  try {
    groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt(today) },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 512,
      }),
    });
  } catch (error) {
    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "Could not reach the AI service. Please try again.",
      502,
      { error, logLevel: "warn" },
    );
  }

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text().catch(() => "");
    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "The AI service returned an error. Please try again in a moment.",
      502,
      {
        logLevel: "warn",
        context: { groqStatus: groqResponse.status, groqBody: errorText.slice(0, 200) },
      },
    );
  }

  let groqData: unknown;
  try {
    groqData = await groqResponse.json();
  } catch {
    return createErrorResponse("GOAL_INTERNAL_ERROR", "Unexpected AI response format.", 502);
  }

  const rawContent =
    typeof groqData === "object" &&
    groqData !== null &&
    "choices" in groqData &&
    Array.isArray((groqData as { choices: unknown[] }).choices)
      ? (
          groqData as {
            choices: { message?: { content?: string } }[];
          }
        ).choices[0]?.message?.content
      : null;

  if (!rawContent) {
    return createErrorResponse("GOAL_INTERNAL_ERROR", "AI returned an empty response.", 502);
  }

  let aiJson: Record<string, unknown>;
  try {
    aiJson = JSON.parse(rawContent) as Record<string, unknown>;
  } catch {
    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "Could not parse the AI response. Please rephrase and try again.",
      502,
    );
  }

  const memberCount =
    typeof aiJson.memberCount === "number" && aiJson.memberCount >= 1
      ? Math.round(aiJson.memberCount)
      : 1;

  const targetAmount =
    typeof aiJson.targetAmount === "number" && aiJson.targetAmount > 0
      ? aiJson.targetAmount
      : 0;

  const targetDateStr =
    typeof aiJson.targetDate === "string" && aiJson.targetDate.match(/^\d{4}-\d{2}-\d{2}$/)
      ? aiJson.targetDate
      : (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          return d.toISOString().split("T")[0]!;
        })();

  const expectedRate =
    typeof aiJson.expectedRate === "number" && aiJson.expectedRate > 0
      ? aiJson.expectedRate
      : 8;

  const existingSavings =
    typeof aiJson.existingSavings === "number" && aiJson.existingSavings >= 0
      ? aiJson.existingSavings
      : 0;

  const perPersonAmount = targetAmount / memberCount;
  const perPersonExistingSavings = existingSavings / memberCount;
  const netPerPersonTarget = Math.max(perPersonAmount - perPersonExistingSavings, 0);

  const tYears = yearFractionFromDates(new Date(), new Date(targetDateStr));
  const perPersonMonthly =
    tYears > 0
      ? Math.max(requiredPaymentForFutureValue(netPerPersonTarget, expectedRate, 12, tYears), 0)
      : perPersonAmount;

  const validCurrencies = ["INR", "USD", "EUR", "GBP"] as const;
  const currency = validCurrencies.includes(aiJson.currency as (typeof validCurrencies)[number])
    ? (aiJson.currency as (typeof validCurrencies)[number])
    : "INR";

  const responseData: AiParseResponse = {
    title:
      typeof aiJson.title === "string" && aiJson.title.trim().length > 0
        ? aiJson.title.trim().slice(0, 200)
        : "My Goal",
    targetAmount,
    currency,
    targetDate: targetDateStr,
    expectedRate,
    compounding: aiJson.compounding === "yearly" ? "yearly" : "monthly",
    contributionFrequency: aiJson.contributionFrequency === "yearly" ? "yearly" : "monthly",
    existingSavings,
    memberCount,
    perPersonAmount,
    perPersonMonthly,
    reasoning:
      typeof aiJson.reasoning === "string" ? aiJson.reasoning : "",
  };

  const validated = AiParseResponseSchema.safeParse(responseData);
  if (!validated.success) {
    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "AI returned data that could not be validated. Please rephrase and try again.",
      502,
    );
  }

  return NextResponse.json(validated.data);
}
