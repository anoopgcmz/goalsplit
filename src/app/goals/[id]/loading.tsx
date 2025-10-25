import type { JSX } from "react";

import { CardSkeleton } from "@/components/ui/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function GoalPlanLoading(): JSX.Element {
  return (
    <div className="space-y-10" aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <CardSkeleton headerLines={2} bodyLines={4} />
      <CardSkeleton headerLines={2} bodyLines={6} />
      <TableSkeleton rowCount={5} columnCount={5} />
    </div>
  );
}
