"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/goals", label: "Goals" },
  { href: "/new-goal", label: "New Goal" },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell(props: AppShellProps): JSX.Element {
  const { children } = props;
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navOpen]);

  return (
    <div className="min-h-screen bg-background text-slate-900">
      <a
        href="#content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-2xl focus-visible:bg-primary-600 focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-2 text-slate-600 md:hidden"
              aria-controls="primary-navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((prev) => !prev)}
            >
              {navOpen ? "Close" : "Menu"}
            </Button>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
              title="Plan how much to invest to reach your goals — no product recommendations."
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-600 text-sm font-bold text-white shadow-md">
                GP
              </span>
              <span className="hidden sm:inline">Goal Planner</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost">
              Log in
            </Button>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700"
            >
              GP
            </span>
          </div>
        </div>
      </header>
      {navOpen ? (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-20 bg-slate-900/40 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <nav
          id="primary-navigation"
          aria-label="Primary"
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-200 bg-surface px-4 py-6 shadow-md transition-transform duration-200 ease-out md:static md:h-auto md:w-60 md:translate-x-0 md:border-r md:bg-transparent md:p-0 md:shadow-none",
            navOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
        >
          <div className="flex h-full flex-col gap-6">
            <div className="flex items-center justify-between md:hidden">
              <p className="text-sm font-semibold text-slate-600">Navigation</p>
              <Button type="button" variant="ghost" onClick={() => setNavOpen(false)}>
                Close
              </Button>
            </div>
            <ul className="flex flex-1 flex-col gap-2">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        isActive
                          ? "bg-primary-100 text-primary-700 shadow-md"
                          : "text-slate-600 hover:bg-slate-100/70",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="hidden text-sm text-slate-500 md:block">
              Plan how much to invest to reach your goals — no product recommendations.
            </div>
          </div>
        </nav>
        <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-surface shadow-md">
          <main id="content" className="flex-1 rounded-2xl bg-surface p-6">
            {children}
          </main>
          <footer className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            © {new Date().getFullYear()} Goal Planner. Build clarity without recommendations.
          </footer>
        </div>
      </div>
    </div>
  );
}
