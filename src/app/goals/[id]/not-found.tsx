"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";

export default function GoalNotFound(): JSX.Element {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Goal plan</p>
        <h1 className="text-3xl font-semibold text-slate-900">Goal not found</h1>
        <p className="text-sm text-slate-600">
          We can&apos;t find that goal or you no longer have access. Return to your goals list to pick another plan.
        </p>
      </header>
      <EmptyState
        title="Goal unavailable"
        description="Choose a different goal or create a new one to keep planning."
        actionLabel="Back to goals"
        onAction={() => router.push("/goals")}
        icon={
          <svg
            aria-hidden="true"
            viewBox="0 0 120 80"
            className="h-20 w-28 text-slate-300"
            role="img"
          >
            <rect x="18" y="18" width="84" height="44" rx="12" className="fill-current opacity-30" />
            <path d="M30 32h60" className="stroke-current" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
            <path d="M30 48h36" className="stroke-current" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
            <circle cx="84" cy="48" r="6" className="fill-current" opacity="0.7" />
          </svg>
        }
      />
    </div>
  );
}
