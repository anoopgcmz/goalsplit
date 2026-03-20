import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/mongo";
import GoalModel from "@/models/goal";
import UserModel from "@/models/user";
import { CheckInModel } from "@/models/checkin";
import { ContributionModel } from "@/models/contribution";
import { sendEmail } from "@/lib/email";
import { digestEmailTemplate, type DigestGoalSummary } from "@/lib/email-templates";
import { normalizePeriod } from "../../contributions/schemas";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3000";

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

    const goals = await GoalModel.find({
      isShared: true,
      targetDate: { $gt: now },
    }).lean();

    // Collect all unique user IDs across all shared goals
    const allUserIds = new Set<string>();
    for (const goal of goals) {
      for (const member of goal.members) {
        allUserIds.add(member.userId.toString());
      }
    }

    if (allUserIds.size === 0) {
      return NextResponse.json({
        success: true,
        goalsProcessed: goals.length,
        emailsSent: 0,
        emailErrors: 0,
      });
    }

    const userIdArray = [...allUserIds];

    // Fetch all relevant users
    const users = await UserModel.find({ _id: { $in: userIdArray } }).lean();
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

    // Fetch all check-ins for the current period across all goals
    const goalIds = goals.map((g) => g._id);
    const checkIns = await CheckInModel.find({
      goalId: { $in: goalIds },
      period,
    }).lean();

    // Build lookup: goalId -> userId -> status
    const checkInMap = new Map<string, Map<string, string>>();
    for (const ci of checkIns) {
      const gKey = ci.goalId.toString();
      if (!checkInMap.has(gKey)) checkInMap.set(gKey, new Map());
      checkInMap.get(gKey)!.set(ci.userId.toString(), ci.status);
    }

    // Fetch all contributions for the current period across all goals
    const contributions = await ContributionModel.find({
      goalId: { $in: goalIds },
      period,
    }).lean();

    // Build lookup: goalId -> userId -> amount
    const contributionMap = new Map<string, Map<string, number>>();
    for (const c of contributions) {
      const gKey = c.goalId.toString();
      if (!contributionMap.has(gKey)) contributionMap.set(gKey, new Map());
      contributionMap.get(gKey)!.set(c.userId.toString(), c.amount);
    }

    // For each user, build their digest of shared goals
    let emailsSent = 0;
    let emailErrors = 0;

    for (const userId of userIdArray) {
      const userInfo = userMap.get(userId);
      if (!userInfo) continue;

      // Find all goals this user is a member of
      const userGoals = goals.filter((g) =>
        g.members.some((m) => m.userId.toString() === userId),
      );

      if (userGoals.length === 0) continue;

      const goalSummaries: DigestGoalSummary[] = userGoals.map((goal) => {
        const goalIdStr = goal._id.toString();
        const cisByGoal = checkInMap.get(goalIdStr) ?? new Map<string, string>();

        let confirmedCount = 0;
        let skippedCount = 0;
        let pendingCount = 0;

        for (const member of goal.members) {
          const status = cisByGoal.get(member.userId.toString()) ?? "pending";
          if (status === "confirmed") confirmedCount++;
          else if (status === "skipped") skippedCount++;
          else pendingCount++;
        }

        // User's own contribution
        const userContrib = contributionMap.get(goalIdStr)?.get(userId) ?? null;

        // Determine user's target amount for this period
        const userMember = goal.members.find((m) => m.userId.toString() === userId);
        let userContributionTarget: string | null = null;
        if (userMember) {
          if (userMember.fixedAmount != null && userMember.fixedAmount > 0) {
            userContributionTarget = userMember.fixedAmount.toLocaleString("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            });
          } else if (userMember.splitPercent != null && goal.targetAmount > 0) {
            const approx = (userMember.splitPercent / 100) * goal.targetAmount;
            userContributionTarget =
              approx.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }) + " (approx)";
          }
        }

        return {
          title: goal.title,
          confirmedCount,
          pendingCount,
          skippedCount,
          totalMembers: goal.members.length,
          userContributionAmount: userContrib,
          userContributionTarget,
        };
      });

      const emailTemplate = digestEmailTemplate({
        userName: userInfo.name,
        goals: goalSummaries,
        appUrl: APP_URL,
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

    return NextResponse.json({
      success: true,
      goalsProcessed: goals.length,
      emailsSent,
      emailErrors,
    });
  } catch (error) {
    console.error("[cron/digest] error:", error);
    return NextResponse.json(
      {
        error: {
          code: "CRON_INTERNAL_ERROR",
          message: "Failed to process digest emails.",
        },
      },
      { status: 500 },
    );
  }
}
