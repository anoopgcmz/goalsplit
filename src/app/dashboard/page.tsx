import type { JSX } from "react";
import { redirect } from "next/navigation";
import { Types } from "mongoose";

import { getUserFromCookie } from "@/lib/auth/server";
import { dbConnect } from "@/lib/mongo";
import { buildGoalPlan } from "@/lib/goals/plan";
import { buildGoalSummary, type GoalSummary } from "@/lib/goals/summary";
import GoalModel from "@/models/goal";
import { serializeGoal } from "@/app/api/goals/utils";

import DashboardPage from "./dashboard-page.client";

export default async function DashboardRoute(): Promise<JSX.Element> {
  const user = await getUserFromCookie();

  if (!user) {
    redirect("/login");
  }

  await dbConnect();

  const userObjectId = new Types.ObjectId(user.id);

  const goalDocs = await GoalModel.find({
    $or: [{ ownerId: userObjectId }, { "members.userId": userObjectId }],
  })
    .sort({ targetDate: 1 })
    .lean();

  const summaries: GoalSummary[] = goalDocs.map((goalDoc) => {
    const goal = serializeGoal(goalDoc);
    const plan = buildGoalPlan(goal);
    const summary = buildGoalSummary(goal);
    const perPeriod = Number.isFinite(plan.totals.perPeriod)
      ? Math.max(plan.totals.perPeriod, 0)
      : 0;

    return {
      ...summary,
      contributionAmount: perPeriod,
    } satisfies GoalSummary;
  });

  return <DashboardPage goals={summaries} />;
}
