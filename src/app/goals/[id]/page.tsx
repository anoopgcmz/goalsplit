import type { JSX } from "react";
import { redirect } from "next/navigation";

import { getUserFromCookie } from "@/lib/auth/server";

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

  return <GoalPlanPage goalId={params.id} />;
}
