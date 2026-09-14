"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";
import type { IconComponent } from "./types";

export type BadgeTone =
  | "neutral"
  | "ok"
  | "warn"
  | "danger"
  | "info"
  | "cold";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-ink-2 border-line",
  ok: "bg-ok-soft text-ok border-ok-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  // Not the accent. A role chip is not the next action on the screen.
  info: "bg-hover text-ink-2 border-transparent",
  cold: "bg-cold-soft text-cold border-cold-soft",
};

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: IconComponent;
  className?: string;
  children?: ReactNode;
}

export function Badge({
  tone = "neutral",
  icon: Icon,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-2 h-5 rounded-full border",
        "text-xs font-medium whitespace-nowrap",
        BADGE_TONE[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} className="shrink-0" />}
      {children}
    </span>
  );
}
