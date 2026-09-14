"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    // State the absence, offer the one action, in a sentence. No centred card,
    // no illustration, no bordered box — the DNA bans all three.
    <div className={cx("px-3 py-8", className)}>
      <p className="text-sm text-ink-3">
        {title}
        {description && <span className="text-ink-4"> — {description}</span>}
      </p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
