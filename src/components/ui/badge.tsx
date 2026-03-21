import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "neutral" | "success" | "info" | "warning" | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const badgeStyles: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-primary-100 text-primary-800",
  info: "bg-secondary-100 text-secondary-800",
  warning: "bg-accent-100 text-accent-700 border border-accent-200",
  danger: "bg-danger-bg text-danger border border-danger-light",
};

export function Badge(props: BadgeProps): JSX.Element {
  const { className, variant = "neutral", ...rest } = props;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-2xl px-3 py-1 text-xs font-medium",
        badgeStyles[variant],
        className,
      )}
      {...rest}
    />
  );
}
