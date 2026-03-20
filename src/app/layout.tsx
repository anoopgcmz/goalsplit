import type { ReactNode } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goal Planner",
  description: "Plan how much to invest to reach your goals — no product recommendations.",
};

export default function RootLayout(
  props: Readonly<{ children: ReactNode }>,
): JSX.Element {
  const { children } = props;

  return (
    <html lang="en" className="bg-background text-slate-900">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
