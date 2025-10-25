import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLElement>;

type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

type CardContentProps = HTMLAttributes<HTMLDivElement>;

type CardFooterProps = HTMLAttributes<HTMLDivElement>;

export function Card(props: CardProps): JSX.Element {
  const { className, ...rest } = props;

  return (
    <article
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-md transition-shadow motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg motion-safe:focus-within:-translate-y-0.5 motion-safe:focus-within:shadow-lg motion-reduce:transition-none motion-reduce:transform-none",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader(props: CardHeaderProps): JSX.Element {
  const { className, ...rest } = props;

  return (
    <div className={cn("mb-4 space-y-1", className)} {...rest} />
  );
}

export function CardContent(props: CardContentProps): JSX.Element {
  const { className, ...rest } = props;

  return <div className={cn("space-y-3", className)} {...rest} />;
}

export function CardFooter(props: CardFooterProps): JSX.Element {
  const { className, ...rest } = props;

  return (
    <div
      className={cn("mt-4 flex flex-wrap items-center justify-between gap-3", className)}
      {...rest}
    />
  );
}
