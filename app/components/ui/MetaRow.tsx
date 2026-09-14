"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

export interface MetaRowProps {
  className?: string;
  children?: ReactNode;
}

export function MetaRow({ className, children }: MetaRowProps) {
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
