import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white shadow-md hover:bg-primary-700 focus-visible:ring-primary-500 disabled:bg-primary-300",
  secondary:
    "bg-white text-slate-900 shadow-md hover:bg-slate-50 focus-visible:ring-primary-500 disabled:bg-slate-100",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100/80 focus-visible:ring-primary-500 disabled:text-slate-400",
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
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70",
        variantStyles[variant],
        className,
      )}
      {...rest}
    />
  );
});
