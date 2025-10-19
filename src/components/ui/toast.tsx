"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error";

interface ToastProps {
  open: boolean;
  onDismiss?: () => void;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: ReactNode;
  className?: string;
}

const variantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

export function Toast(props: ToastProps): JSX.Element | null {
  const {
    open,
    onDismiss,
    title,
    description,
    variant = "success",
    duration = 4000,
    action,
    className,
  } = props;

  useEffect(() => {
    if (!open || !duration || !onDismiss) {
      return;
    }

    const id = window.setTimeout(() => {
      onDismiss();
    }, duration);

    return () => {
      window.clearTimeout(id);
    };
  }, [duration, onDismiss, open]);

  if (!open) {
    return null;
  }

  const role = variant === "error" ? "alert" : "status";
  const ariaLive = variant === "error" ? "assertive" : "polite";

  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={cn(
        "flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-md",
        variantStyles[variant],
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="text-sm leading-snug">{description}</p> : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
      {onDismiss ? (
        <Button type="button" variant="ghost" onClick={onDismiss} aria-label="Dismiss notification">
          Close
        </Button>
      ) : null}
    </div>
  );
}
