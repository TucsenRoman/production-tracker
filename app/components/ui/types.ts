"use client";

import type { ComponentType } from "react";

/**
 * An icon component, structurally rather than by package. Lucide icons satisfy
 * it, and so do the hand-drawn ones (`InsightsIcon`) — typing this as
 * `LucideIcon` would exclude those for no benefit.
 */
export type IconComponent = ComponentType<{
  size?: number | string;
  className?: string;
}>;

/** What `cx` accepts. Deliberately not arrays: `join` would comma-separate a
 *  nested one. Callers with a list join it themselves. */
export type ClassValue = string | false | null | undefined;
