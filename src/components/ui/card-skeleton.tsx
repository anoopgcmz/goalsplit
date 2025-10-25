import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

import { Skeleton } from "./skeleton";

interface CardSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  headerLines?: number;
  bodyLines?: number;
  footer?: boolean;
}

export function CardSkeleton(props: CardSkeletonProps): JSX.Element {
  const {
    className,
    headerLines = 2,
    bodyLines = 4,
    footer = false,
    ...rest
  } = props;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-white p-6 shadow-sm",
        className,
      )}
      {...rest}
    >
      <div className="flex flex-col gap-5">
        <div className="space-y-3">
          {Array.from({ length: headerLines }).map((_, index) => (
            <Skeleton key={index} className="h-5 w-3/4" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: bodyLines }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
        {footer ? <Skeleton className="h-10 w-32" /> : null}
      </div>
    </div>
  );
}
