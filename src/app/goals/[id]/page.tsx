import type { JSX } from "react";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";

import { getUserFromCookie } from "@/lib/auth/server";
import { getGoal, getPlan } from "@/lib/api/goals";
import { ApiError } from "@/lib/http";

import GoalPlanPage from "./goal-plan-page";

interface GoalPlanRouteProps {
  params: Promise<{ id: string }>;
}

export default async function GoalPlanRoute(
  props: GoalPlanRouteProps,
): Promise<JSX.Element> {
  const { params } = props;
  const { id } = await params;
  const user = await getUserFromCookie();

  if (!user) {
    redirect("/login");
  }

  if (!Types.ObjectId.isValid(id)) {
    notFound();
  }

  try {
    const goal = await getGoal(id);
    const normalizedUserId = user.id;
    const isOwner = goal.ownerId === normalizedUserId;
    const isMember = goal.members.some(
      (member) => member.userId === normalizedUserId,
    );

    if (!isOwner && !isMember) {
      notFound();
    }

    const plan = await getPlan(id);

    return (
      <GoalPlanPage goalId={goal.id} initialPlan={plan} initialUser={user} />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        redirect("/login");
      }

      if (error.status === 404 || error.status === 403) {
        notFound();
      }
    }

    throw error;
  }
}
