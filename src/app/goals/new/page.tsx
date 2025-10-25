import type { JSX } from "react";
import { redirect } from "next/navigation";

import { getUserFromCookie } from "@/lib/auth/server";

import NewGoalPage from "./new-goal-page.client";

export default async function NewGoalRoute(): Promise<JSX.Element> {
  const user = await getUserFromCookie();

  if (!user) {
    redirect("/login");
  }

  return <NewGoalPage />;
}
