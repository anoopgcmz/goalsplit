import type { JSX } from "react";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";

import { getGoal } from "@/lib/api/goals";
import { getUserFromCookie } from "@/lib/auth/server";
import { ApiError } from "@/lib/http";

import EditGoalPage from "./edit-goal-page.client";

interface EditGoalRouteProps {
  params: { id: string };
}

export default async function EditGoalRoute(props: EditGoalRouteProps): Promise<JSX.Element> {
  const { params } = props;
  const user = await getUserFromCookie();

  if (!user) {
    redirect("/login");
  }

  if (!Types.ObjectId.isValid(params.id)) {
    notFound();
  }

  try {
    const goal = await getGoal(params.id);

    if (goal.ownerId !== user.id) {
      notFound();
    }

    return <EditGoalPage goal={goal} />;
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
