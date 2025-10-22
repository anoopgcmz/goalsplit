import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

import { Skeleton } from "./skeleton";

interface TableSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  columnCount?: number;
  rowCount?: number;
  includeHeader?: boolean;
}

export function TableSkeleton(props: TableSkeletonProps): JSX.Element {
  const { className, columnCount = 4, rowCount = 5, includeHeader = true, ...rest } = props;

  const columns = Math.max(1, columnCount);
  const rows = Math.max(1, rowCount);

  return (
    <div
      className={cn("overflow-hidden rounded-2xl border border-slate-200 shadow-md", className)}
      {...rest}
    >
      <table className="min-w-full border-separate border-spacing-0 bg-white text-left">
        {includeHeader ? (
          <thead className="bg-slate-50">
            <tr className="divide-x divide-slate-100/60">
              {Array.from({ length: columns }).map((_, index) => (
                <th key={`header-${index}`} className="px-4 py-3">
                  <Skeleton className="h-3 w-3/5" />
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="divide-x divide-slate-100/60">
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <td key={`cell-${rowIndex}-${columnIndex}`} className="px-4 py-3">
                  <Skeleton className="h-3 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
