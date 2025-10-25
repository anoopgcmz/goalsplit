import type { JSX } from "react";

import { CardSkeleton } from "@/components/ui/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading(): JSX.Element {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <header className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-36" />
          </div>
        </div>
      </section>

      <section aria-label="Loading goals" className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton headerLines={2} bodyLines={4} footer />
          <CardSkeleton headerLines={2} bodyLines={4} footer />
          <CardSkeleton headerLines={2} bodyLines={4} footer />
        </div>
      </section>
    </div>
  );
}
