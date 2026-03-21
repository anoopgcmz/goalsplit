"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { InvitationBell } from "@/features/invitations/invitation-bell";
import type { GoalSummary } from "@/lib/api/goals";

interface SidebarStats {
  totalGoals: number;
  nearestDeadline: { title: string; targetDate: string } | null;
}

function useSidebarStats(): { data: SidebarStats | null; loading: boolean } {
  const [data, setData] = useState<SidebarStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch("/api/goals?page=1&pageSize=50&sortBy=targetDate&sortOrder=asc", {
          signal: controller.signal,
        });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = (await res.json()) as { data: GoalSummary[] };
        const goals: GoalSummary[] = json.data ?? [];
        const today = new Date().toISOString().slice(0, 10);
        const future = goals.filter((g) => g.targetDate >= today);
        const nearest =
          future.length > 0
            ? future.reduce((a, b) => (a.targetDate <= b.targetDate ? a : b))
            : goals.length > 0
              ? goals.reduce((a, b) => (a.targetDate >= b.targetDate ? a : b))
              : null;
        setData({
          totalGoals: goals.length,
          nearestDeadline: nearest
            ? { title: nearest.title, targetDate: nearest.targetDate }
            : null,
        });
      } catch {
        // fail silently — sidebar stats are non-critical
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  return { data, loading };
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/goals", label: "Goals" },
  { href: "/goals/new", label: "New Goal", isForm: true },
  { href: "/goals/ai", label: "New Goal with AI", isAI: true },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell(props: AppShellProps): JSX.Element {
  const { children } = props;
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const { user, status, isLoading } = useCurrentUser();
  const { data: sidebarStats, loading: sidebarStatsLoading } = useSidebarStats();
  const hideNavigation = pathname === "/login";
  const showNavigation = !hideNavigation;

  const avatarTriggerRef = useRef<HTMLButtonElement | null>(null);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!showNavigation) {
      setNavOpen(false);
    }
  }, [showNavigation]);

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

  useEffect(() => {
    if (!avatarMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const isInMenu = avatarMenuRef.current?.contains(target) ?? false;
      const isInTrigger = avatarTriggerRef.current?.contains(target) ?? false;

      if (isInMenu || isInTrigger) {
        return;
      }

      setAvatarMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAvatarMenuOpen(false);
        avatarTriggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [avatarMenuOpen]);

  const userInitials = useMemo(() => {
    if (user?.name) {
      const segments = user.name
        .split(" ")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      if (segments.length >= 2) {
        const first = segments[0] ?? "";
        const last = segments[segments.length - 1] ?? "";
        return `${first[0] ?? ""}${last[0] ?? ""}`
          .toUpperCase()
          .slice(0, 2);
      }
      if (segments.length === 1) {
        const seg = segments[0] ?? "";
        return seg.length > 0 ? (seg[0]?.toUpperCase() ?? "GP") : "GP";
      }
    }

    if (user?.email) {
      return user.email[0]?.toUpperCase() ?? "GP";
    }

    return "GP";
  }, [user]);

  const handleLogin = () => {
    router.push("/login");
  };

  const handleLogout = () => {
    router.push("/logout");
  };

  const layoutClasses = useMemo(
    () =>
      cn(
        "flex w-full flex-1",
        showNavigation ? "gap-0" : "flex-col",
      ),
    [showNavigation],
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background text-slate-900">
        <a
          href="#content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-2xl focus-visible:bg-primary-500 focus-visible:px-4 focus-visible:py-2 focus-visible:text-white"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center justify-between px-6 lg:px-10">
            <div className="flex items-center gap-3">
              {showNavigation ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-2 md:hidden"
                  aria-controls="primary-navigation"
                  aria-expanded={navOpen}
                  aria-label={navOpen ? "Close menu" : "Open menu"}
                  onClick={() => setNavOpen((prev) => !prev)}
                >
                  {navOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  )}
                </Button>
              ) : null}
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-base font-semibold text-primary-600"
                title="Plan how much to invest to reach your goals — no product recommendations."
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-500 text-sm font-bold text-white shadow-card">
                  GP
                </span>
                <span className="hidden sm:inline">Goal Planner</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {status === "authenticated" && user ? (
                <>
                  <InvitationBell />
                  <div className="relative">
                    <button
                      ref={avatarTriggerRef}
                      type="button"
                      aria-label={user.name ?? user.email ?? "Account"}
                      aria-haspopup="menu"
                      aria-expanded={avatarMenuOpen}
                      onClick={() => setAvatarMenuOpen((prev) => !prev)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white transition hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    >
                      {userInitials}
                    </button>
                    {avatarMenuOpen ? (
                      <div
                        ref={avatarMenuRef}
                        role="menu"
                        aria-label="Account menu"
                        className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-border bg-surface p-1 text-sm font-medium text-slate-600 shadow-elevated focus:outline-none"
                      >
                        <Link
                          href="/account/settings"
                          role="menuitem"
                          className="flex w-full items-center rounded-xl px-3 py-2 text-left transition hover:bg-primary-50 hover:text-primary-600"
                          onClick={() => setAvatarMenuOpen(false)}
                        >
                          Account settings
                        </Link>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setAvatarMenuOpen(false);
                            handleLogout();
                          }}
                          className="flex w-full items-center rounded-xl px-3 py-2 text-left transition hover:bg-primary-50 hover:text-primary-600"
                        >
                          Log out
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <Button type="button" variant="ghost" onClick={handleLogin} disabled={isLoading}>
                    {isLoading ? "Checking…" : "Log in"}
                  </Button>
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700"
                  >
                    GP
                  </span>
                </>
              )}
            </div>
          </div>
        </header>
      {showNavigation && navOpen ? (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-20 bg-slate-900/50 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <div className={layoutClasses}>
        {showNavigation ? (
          <nav
            id="primary-navigation"
            aria-label="Primary"
            className={cn(
              "fixed inset-y-0 left-0 z-30 w-64 border-r border-border bg-surface px-4 py-6 shadow-elevated transition-transform duration-200 ease-out md:static md:flex md:h-auto md:w-56 md:shrink-0 md:translate-x-0 md:flex-col md:border-r md:bg-surface md:px-4 md:py-6 md:shadow-none",
              navOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            )}
          >
            <div className="flex h-full flex-col gap-6">
              <div className="flex items-center justify-between md:hidden">
                <p className="text-sm font-semibold text-slate-600">Navigation</p>
                <Button type="button" variant="ghost" aria-label="Close menu" onClick={() => setNavOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {navigationItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href === "/goals/ai" && pathname.startsWith("/goals/ai")) ||
                    (item.href === "/goals/new" && pathname.startsWith("/goals/new"));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          isActive
                            ? "bg-primary-100 text-primary-700 shadow-card"
                            : "text-slate-600 hover:bg-primary-50 hover:text-primary-600",
                        )}
                      >
                        {item.isAI ? (
                          <>
                            <span aria-hidden="true">✨</span>
                            {item.label}
                            <span className="ml-auto rounded-full bg-primary-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              AI
                            </span>
                          </>
                        ) : item.isForm ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            {item.label}
                          </>
                        ) : (
                          item.label
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {sidebarStatsLoading ? (
                <div className="hidden md:flex flex-col gap-2 rounded-2xl bg-slate-50 px-4 py-4 animate-pulse">
                  <div className="h-3 w-16 rounded bg-slate-100" />
                  <div className="h-4 w-full rounded bg-slate-100" />
                </div>
              ) : sidebarStats !== null ? (
                <div className="hidden md:block rounded-2xl bg-primary-50 px-4 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 mb-3">
                    Overview
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Active goals</span>
                      <span className="font-semibold text-slate-800">{sidebarStats.totalGoals}</span>
                    </div>
                    {sidebarStats.nearestDeadline !== null && (
                      <div className="flex flex-col gap-0.5 border-t border-primary-100 pt-2 mt-1">
                        <span className="text-slate-500 text-xs">Next deadline</span>
                        <span className="font-medium text-slate-800 truncate">{sidebarStats.nearestDeadline.title}</span>
                        <span className="text-xs text-primary-600">
                          {dateFormatter.format(new Date(sidebarStats.nearestDeadline.targetDate))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="mt-auto hidden md:block border-t border-border pt-4">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-primary-50 hover:text-primary-600"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white shrink-0">
                    {userInitials}
                  </span>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate max-w-[120px] text-slate-800 font-medium">{user?.name ?? "Account"}</span>
                    <span className="text-xs text-slate-400">Log out</span>
                  </div>
                </button>
              </div>
            </div>
          </nav>
        ) : null}
        <div className="flex flex-1 flex-col min-w-0 px-6 pb-10 pt-6 lg:px-10">
          <main id="content" className="flex-1">
            {children}
          </main>
          <footer className="border-t border-border pt-4 mt-6 text-sm text-slate-500">
            © {new Date().getFullYear()} Goal Planner. Assumed annual returns are for
            planning only and not recommendations of any product.
          </footer>
        </div>
      </div>
      </div>
    </ToastProvider>
  );
}
