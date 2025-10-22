import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;
}

export function ErrorState(props: ErrorStateProps): JSX.Element {
  const {
    title = "Something went wrong",
    description,
    retryLabel = "Try again",
    onRetry,
    className,
    children,
  } = props;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm",
        className,
      )}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="text-sm text-rose-700">{description}</p> : null}
        </div>
        {children ? <div className="text-sm text-rose-700">{children}</div> : null}
        {onRetry ? (
          <div className="pt-1">
            <Button
              type="button"
              variant="secondary"
              className="bg-white text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-500"
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
