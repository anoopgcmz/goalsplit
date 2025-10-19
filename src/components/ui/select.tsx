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
        "w-full appearance-none rounded-2xl border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
