import type { HTMLAttributes, TableHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type TableProps = TableHTMLAttributes<HTMLTableElement>;

type TableRowProps = HTMLAttributes<HTMLTableRowElement>;

type TableCellProps = HTMLAttributes<HTMLTableCellElement>;

type TableHeadCellProps = HTMLAttributes<HTMLTableCellElement>;

export function Table(props: TableProps): JSX.Element {
  const { className, children, ...rest } = props;

  return (
    <div className="w-full max-w-full overflow-x-auto overflow-y-hidden rounded-2xl border border-border shadow-card">
      <table
        className={cn(
          "min-w-full border-separate border-spacing-0 bg-surface text-left text-sm",
          className,
        )}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const { className, ...rest } = props;

  return <thead className={cn("bg-surface-alt text-slate-500", className)} {...rest} />;
}

export function TableHeaderCell(props: TableHeadCellProps): JSX.Element {
  const { className, ...rest } = props;

  return (
    <th
      className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-wide", className)}
      scope="col"
      {...rest}
    />
  );
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const { className, ...rest } = props;

  return <tbody className={cn("divide-y divide-border", className)} {...rest} />;
}

export function TableRow(props: TableRowProps): JSX.Element {
  const { className, ...rest } = props;

  return <tr className={cn("hover:bg-primary-50", className)} {...rest} />;
}

export function TableCell(props: TableCellProps): JSX.Element {
  const { className, ...rest } = props;

  return (
    <td className={cn("px-4 py-3 text-sm text-slate-700", className)} {...rest} />
  );
}
