import type { JSX } from "react";
import { redirect } from "next/navigation";

import { getUserFromCookie } from "@/lib/auth/server";

import GoalsPage from "./goals-page.client";

export default async function GoalsRoute(): Promise<JSX.Element> {
  const user = await getUserFromCookie();

  if (!user) {
    redirect("/login");
  }

  return <GoalsPage />;
}
