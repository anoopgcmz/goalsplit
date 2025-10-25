import type { JSX } from "react";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";

import { getUserFromCookie } from "@/lib/auth/server";
import { dbConnect } from "@/lib/mongo";
import { buildGoalPlan } from "@/lib/goals/plan";
import { serializeGoal } from "@/app/api/goals/utils";
import GoalModel from "@/models/goal";
import UserModel from "@/models/user";

import GoalPlanPage from "./goal-plan-page";

interface GoalPlanRouteProps {
  params: { id: string };
}

export default async function GoalPlanRoute(
  props: GoalPlanRouteProps,
): Promise<JSX.Element> {
  const { params } = props;
  const user = await getUserFromCookie();

  if (!user) {
    redirect("/login");
  }

  if (!Types.ObjectId.isValid(params.id)) {
    notFound();
  }

  await dbConnect();

  const goalId = new Types.ObjectId(params.id);
  const goalDoc = await GoalModel.findById(goalId).lean();

  if (!goalDoc) {
    notFound();
  }

  const goal = serializeGoal(goalDoc);
  const normalizedUserId = user.id;
  const isOwner = goal.ownerId === normalizedUserId;
  const isMember = goal.members.some(
    (member) => member.userId === normalizedUserId,
  );

  if (!isOwner && !isMember) {
    notFound();
  }

  const memberObjectIds = goal.members
    .map((member) => member.userId)
    .filter((memberId): memberId is string => typeof memberId === "string")
    .filter((memberId) => Types.ObjectId.isValid(memberId))
    .map((memberId) => new Types.ObjectId(memberId));

  const memberUsers = memberObjectIds.length
    ? await UserModel.find({ _id: { $in: memberObjectIds } }).lean()
    : [];

  const memberDetails = new Map(
    memberUsers.map((member) => {
      const trimmedName =
        typeof member.name === "string" ? member.name.trim() : "";

      return [
        member._id.toString(),
        {
          email: member.email,
          name: trimmedName.length > 0 ? trimmedName : null,
        },
      ] as const;
    }),
  );

  const plan = buildGoalPlan(goal, memberDetails);

  return (
    <GoalPlanPage goalId={goal.id} initialPlan={plan} initialUser={user} />
  );
}
