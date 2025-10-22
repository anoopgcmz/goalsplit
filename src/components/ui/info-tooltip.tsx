"use client";

import type { FocusEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  content: string;
  label: string;
  id?: string;
  className?: string;
}

export function InfoTooltip(props: InfoTooltipProps): JSX.Element {
  const { content, label, id, className } = props;
  const generatedId = useId();
  const tooltipId = id ?? generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const handleToggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  const handleBlur = (_event: FocusEvent<HTMLButtonElement>) => {
    setIsOpen(false);
  };

  const handleMouseEnter = () => {
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (document.activeElement !== buttonRef.current) {
      setIsOpen(false);
    }
  };

  return (
    <span ref={containerRef} className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-controls={tooltipId}
        aria-label={label}
        aria-describedby={isOpen ? tooltipId : undefined}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">?</span>
      </button>
      <span
        role="tooltip"
        id={tooltipId}
        aria-hidden={!isOpen}
        className={cn(
          "absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg transition-opacity",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}
