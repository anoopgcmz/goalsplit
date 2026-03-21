import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-500 text-white shadow-md hover:bg-primary-600 active:bg-primary-700 active:shadow focus-visible:ring-primary-500 disabled:bg-primary-300",
  secondary:
    "bg-white text-slate-900 border border-border shadow-md hover:bg-surface-alt hover:border-primary-300 active:bg-slate-100 active:text-slate-900 active:shadow focus-visible:ring-primary-500 disabled:bg-slate-100",
  ghost:
    "bg-transparent text-primary-600 hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary-500 disabled:text-slate-400",
  danger:
    "bg-danger text-white shadow-md hover:bg-danger-hover active:bg-danger-700 active:shadow focus-visible:ring-danger disabled:bg-danger-300",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  props,
  ref,
) {
  const { className, type = "button", variant = "primary", ...rest } = props;

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-shadow motion-safe:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-70",
        variantStyles[variant],
        className,
      )}
      {...rest}
    />
  );
});
