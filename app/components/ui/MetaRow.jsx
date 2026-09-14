"use client";

import { cx } from "./cx";

export function MetaRow({ className, children }) {
  return (
    <div
      className={cx(
        "flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
