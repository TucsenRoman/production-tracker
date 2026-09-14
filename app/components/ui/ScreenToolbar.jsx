"use client";

import { StickyFadeHeader } from "./StickyFadeHeader";

export function ScreenToolbar({ tabs, actions, refine, status, className }) {
  const hasSecondLine = refine != null || status != null;
  return (
    <StickyFadeHeader padTop={24} className={className} data-screen-toolbar>
      <div className={hasSecondLine ? "space-y-2" : undefined}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">{tabs}</div>
          {actions && (
            <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
          )}
        </div>

        {hasSecondLine && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
            {refine}
            {status}
          </div>
        )}
      </div>
    </StickyFadeHeader>
  );
}
