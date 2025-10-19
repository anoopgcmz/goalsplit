import type { LabelHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label(props: LabelProps): JSX.Element {
  const { className, ...rest } = props;

  return (
    <label
      className={cn("text-sm font-medium text-slate-700", className)}
      {...rest}
    />
  );
}
