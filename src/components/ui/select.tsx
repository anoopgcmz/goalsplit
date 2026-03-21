import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  props,
  ref,
) {
  const { className, children, ...rest } = props;

  return (
    <select
      ref={ref}
      className={cn(
        "w-full appearance-none rounded-2xl border border-border bg-surface px-4 py-2 text-base text-slate-900 shadow-sm transition focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-500/35 disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-slate-400",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
