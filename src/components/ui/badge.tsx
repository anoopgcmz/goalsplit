import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "neutral" | "success" | "info";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const badgeStyles: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  info: "bg-primary-100 text-primary-700",
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
