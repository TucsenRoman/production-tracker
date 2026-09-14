"use client";

import { cx } from "./cx";
import type { IconComponent } from "./types";

export interface SectionHeadingProps {
  icon?: IconComponent;
  label: string;
  count?: number;
  className?: string;
}

/**
 * The heading that opens one group inside a flat, un-boxed list: icon, label
 * in caps, count, then a hairline running out to the right edge.
 *
 * The rule sits ON the heading's line, not under it — a hairline below the
 * label reads as one more row divider.
 *
 * Render one for every group, even when a filter leaves a single group; a
 * list that drops its headings reads as broken. Pair with a `pl-6` list
 * beneath: the indent is the only thing that says "these belong here".
 */
export function SectionHeading({
  icon: Icon,
  label,
  count,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cx("flex items-center gap-2 mb-1", className)}>
      {Icon && <Icon size={14} className="text-icon-2 shrink-0" />}
      <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wide shrink-0">
        {label}
      </h3>
      {count !== undefined && (
        <span className="text-xs text-ink-4 tnum shrink-0">{count}</span>
      )}
      <span className="flex-1 h-px bg-line" aria-hidden="true" />
    </div>
  );
}
