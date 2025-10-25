import type { JSX } from "react";
import { redirect } from "next/navigation";

import { getUserFromCookie } from "@/lib/auth/server";

import DashboardPage from "./dashboard-page.client";

export default async function DashboardRoute(): Promise<JSX.Element> {
  const user = await getUserFromCookie();

  if (!user) {
    redirect("/login");
  }

  return <DashboardPage />;
}
