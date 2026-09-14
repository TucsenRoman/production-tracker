"use client";

import { cx } from "./cx";

function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-sm", className)} />;
}

export interface SkeletonRowsProps {
  rows?: number;
}

export function SkeletonRows({ rows = 3 }: SkeletonRowsProps) {
  return (
    <div className="ruled border-t border-line" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="px-3 py-3">
          <Skeleton className="h-3.5 w-40 mb-2" />
          <Skeleton className="h-3 w-64" />
        </div>
      ))}
    </div>
  );
}
