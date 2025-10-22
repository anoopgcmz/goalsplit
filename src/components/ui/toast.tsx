"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error";

export interface ToastProps {
  open: boolean;
  onDismiss?: () => void;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

interface ToastRecord extends Omit<ToastProps, "open" | "onDismiss"> {
  id: string;
  duration?: number;
}

interface ToastContextValue {
  publish: (toast: Omit<ToastRecord, "id">) => string;
  dismiss: (id: string) => void;
}

const variantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

const ToastContext = createContext<ToastContextValue | null>(null);

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function Toast(props: ToastProps): JSX.Element | null {
  const {
    open,
    onDismiss,
    title,
    description,
    variant = "success",
    duration = 4000,
    actionLabel,
    onAction,
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
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-md",
        variantStyles[variant],
        className,
      )}
    >
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="text-sm leading-snug">{description}</p> : null}
        {actionLabel && onAction ? (
          <div className="pt-1">
            <Button
              type="button"
              variant="ghost"
              className="px-0 text-sm font-semibold text-inherit underline-offset-2 hover:underline"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
      {onDismiss ? (
        <Button type="button" variant="ghost" onClick={onDismiss} aria-label="Dismiss notification">
          Close
        </Button>
      ) : null}
    </div>
  );
}

export function ToastProvider(props: { children: ReactNode }): JSX.Element {
  const { children } = props;
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const publish = useCallback(
    (toast: Omit<ToastRecord, "id">) => {
      const id = createId();
      setToasts((current) => [...current, { ...toast, id }]);
      return id;
    },
    [],
  );

  const contextValue = useMemo<ToastContextValue>(
    () => ({ publish, dismiss }),
    [dismiss, publish],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed right-4 top-24 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            open
            onDismiss={() => dismiss(toast.id)}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            duration={toast.duration}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}

export type { ToastVariant };
