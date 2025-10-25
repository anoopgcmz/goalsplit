import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton(props: SkeletonProps): JSX.Element {
  const { className, ...rest } = props;

  return (
    <div
      className={cn(
        "animate-[pulse_1.2s_ease-in-out_infinite] rounded-2xl bg-slate-200",
        className,
      )}
      aria-hidden="true"
      {...rest}
    />
  );
}
