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
        "rounded-3xl border border-danger-light bg-danger-bg p-6 text-danger-900 shadow-sm",
        className,
      )}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="text-sm text-danger-700">{description}</p> : null}
        </div>
        {children ? <div className="text-sm text-danger-700">{children}</div> : null}
        {onRetry ? (
          <div className="pt-1">
            <Button
              type="button"
              variant="secondary"
              className="bg-surface text-danger hover:bg-danger-100 focus-visible:ring-danger"
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
