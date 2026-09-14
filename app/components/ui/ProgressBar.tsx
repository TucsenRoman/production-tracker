"use client";

import { cx } from "./cx";

export type ProgressTone = "primary" | "ok" | "warn" | "danger" | "muted";

const PROGRESS_TONE: Record<ProgressTone, string> = {
  primary: "bg-primary",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  muted: "bg-line-strong",
};

export interface ProgressBarProps {
  /** Percentage. Clamped to 0–100, so callers may pass raw ratios. */
  value: number;
  tone?: ProgressTone;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({
  value,
  tone = "primary",
  size = "md",
  className,
}: ProgressBarProps) {
  const toneClass = PROGRESS_TONE[tone];
  const h = size === "sm" ? "h-1" : "h-1.5";
  return (
    <div
      className={cx(
        "flex-1 rounded-full bg-inset overflow-hidden",
        h,
        className,
      )}
    >
      {/* width is a runtime percentage, so it stays an inline style */}
      <div
        className={cx(
          "rounded-full transition-[width] duration-300",
          h,
          toneClass,
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
