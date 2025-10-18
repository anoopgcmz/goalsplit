import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "GoalSplit Planner",
  description:
    "GoalSplit helps teams and families track shared financial goals with clarity and confidence.",
};

export default function RootLayout(
  props: Readonly<{ children: ReactNode }>,
): JSX.Element {
  const { children } = props;

  return (
    <html lang="en" className="bg-background text-neutral-900">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
