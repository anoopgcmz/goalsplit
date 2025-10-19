"use client";

import { useCallback, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTabId?: string;
  className?: string;
}

export function Tabs(props: TabsProps): JSX.Element {
  const { tabs, defaultTabId, className } = props;
  const fallbackId = useMemo(() => tabs[0]?.id ?? "", [tabs]);
  const [activeTab, setActiveTab] = useState<string>(defaultTabId ?? fallbackId);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      if (tabs.length === 0) {
        return;
      }

      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
      if (currentIndex === -1) {
        setActiveTab(tabs[0]!.id);
        return;
      }

      if (event.key === "Home") {
        setActiveTab(tabs[0]!.id);
        return;
      }

      if (event.key === "End") {
        setActiveTab(tabs[tabs.length - 1]!.id);
        return;
      }

      const offset = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
      setActiveTab(tabs[nextIndex]!.id);
    },
    [activeTab, tabs],
  );

  return (
    <div className={cn("w-full", className)}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-md"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.id}-panel`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={handleKeyDown}
              className={cn(
                "flex-1 rounded-2xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-primary-100 text-primary-700 shadow-md"
                  : "text-slate-600 hover:bg-slate-100/70",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <div
            key={tab.id}
            id={`${tab.id}-panel`}
            role="tabpanel"
            aria-labelledby={`${tab.id}-tab`}
            hidden={!isActive}
            className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-md"
          >
            {isActive ? tab.content : null}
          </div>
        );
      })}
    </div>
  );
}
