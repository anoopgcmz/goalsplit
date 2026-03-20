import type { JSX } from "react";
import { redirect } from "next/navigation";

import { getUserFromCookie } from "@/lib/auth/server";

import AiGoalPage from "./ai-goal-page.client";

export default async function AiGoalRoute(): Promise<JSX.Element> {
  const user = await getUserFromCookie();

  if (!user) {
    redirect("/login");
  }

  return <AiGoalPage />;
}
