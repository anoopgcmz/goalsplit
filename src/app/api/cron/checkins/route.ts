import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

import { dbConnect } from "@/lib/mongo";
import GoalModel from "@/models/goal";
import UserModel from "@/models/user";
import { CheckInModel } from "@/models/checkin";
import { sendEmail } from "@/lib/email";
import { checkinEmailTemplate } from "@/lib/email-templates";
import { normalizePeriod } from "../../contributions/schemas";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3000";

const TOKEN_EXPIRY_DAYS = 14;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: { code: "CRON_MISCONFIGURED", message: "CRON_SECRET is not set." } },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const expectedHeader = `Bearer ${cronSecret}`;
  if (!authHeader || authHeader !== expectedHeader) {
    return NextResponse.json(
      { error: { code: "CRON_UNAUTHORIZED", message: "Unauthorized." } },
      { status: 401 },
    );
  }

  try {
    await dbConnect();

    const now = new Date();
    const period = normalizePeriod(now);
    const tokenExpiresAt = new Date(
      now.getTime() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    const goals = await GoalModel.find({
      isShared: true,
      targetDate: { $gt: now },
    }).lean();

    let created = 0;
    let skipped = 0;
    let emailsSent = 0;
    let emailErrors = 0;

    for (const goal of goals) {
      const memberUserIds = goal.members.map((m) => m.userId);

      const users = await UserModel.find({ _id: { $in: memberUserIds } }).lean();
      const userMap = new Map(
        users.map((u) => [
          u._id.toString(),
          {
            email: u.email,
            name:
              typeof u.name === "string" && u.name.trim().length > 0
                ? u.name.trim()
                : null,
          },
        ]),
      );

      for (const member of goal.members) {
        const uidStr = member.userId.toString();
        const userInfo = userMap.get(uidStr);
        if (!userInfo) continue;

        const existing = await CheckInModel.findOne({
          goalId: goal._id,
          userId: member.userId,
          period,
        });

        if (existing) {
          skipped++;
          continue;
        }

        const token = generateToken();

        await CheckInModel.create({
          goalId: goal._id,
          userId: member.userId,
          period,
          status: "pending",
          token,
          tokenExpiresAt,
        });
        created++;

        const confirmUrl = `${APP_URL}/checkins/respond?token=${token}&status=confirmed`;
        const skipUrl = `${APP_URL}/checkins/respond?token=${token}&status=skipped`;

        let amountPerPeriod = "your share";
        if (member.fixedAmount != null && member.fixedAmount > 0) {
          amountPerPeriod = formatAmount(member.fixedAmount);
        } else if (member.splitPercent != null && goal.targetAmount > 0) {
          // Approximate monthly contribution from split percent and target amount
          const approx = (member.splitPercent / 100) * goal.targetAmount;
          amountPerPeriod = formatAmount(approx) + " (approx)";
        }

        const emailTemplate = checkinEmailTemplate({
          memberName: userInfo.name,
          goalTitle: goal.title,
          amountPerPeriod,
          confirmUrl,
          skipUrl,
        });

        try {
          await sendEmail({
            to: userInfo.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            text: emailTemplate.text,
          });
          emailsSent++;
        } catch {
          emailErrors++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      period: period.toISOString(),
      goalsProcessed: goals.length,
      checkinsCreated: created,
      checkinsSkipped: skipped,
      emailsSent,
      emailErrors,
    });
  } catch (error) {
    console.error("[cron/checkins] error:", error);
    return NextResponse.json(
      {
        error: {
          code: "CRON_INTERNAL_ERROR",
          message: "Failed to process check-ins.",
        },
      },
      { status: 500 },
    );
  }
}
