import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white shadow-md hover:bg-primary-700 active:bg-primary-800 active:shadow focus-visible:ring-primary-500 disabled:bg-primary-300",
  secondary:
    "bg-white text-slate-900 shadow-md hover:bg-slate-50 active:bg-slate-100 active:text-slate-900 active:shadow focus-visible:ring-primary-500 disabled:bg-slate-100",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100/80 active:bg-slate-200/70 focus-visible:ring-primary-500 disabled:text-slate-400",
  danger:
    "bg-rose-600 text-white shadow-md hover:bg-rose-700 active:bg-rose-800 active:shadow focus-visible:ring-rose-500 disabled:bg-rose-300",
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
