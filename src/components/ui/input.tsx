import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  props,
  ref,
) {
  const { className, type = "text", ...rest } = props;

  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-2xl border border-border bg-surface px-4 py-2 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-500/35 disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-slate-400",
        className,
      )}
      {...rest}
    />
  );
});
