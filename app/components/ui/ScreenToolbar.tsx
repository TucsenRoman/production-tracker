"use client";

import type { ReactNode } from "react";
import { StickyFadeHeader } from "./StickyFadeHeader";

export interface ScreenToolbarProps {
  /** The Segmented rail. Gets `flex-1 min-w-0`. */
  tabs?: ReactNode;
  /** The screen's own controls, pinned right, never shrinking. */
  actions?: ReactNode;
  /** Second line: the narrowing that applies within the selected tab. */
  refine?: ReactNode;
  /** What the filters did to the list. Sits with `refine`. */
  status?: ReactNode;
  className?: string;
}

/**
 * The one toolbar composition every floor screen uses, so the row's layout
 * lives in one place rather than being re-inlined per screen.
 *
 * Never give the `tabs` slot a shrink-to-fit parent: boxed to its content
 * width it can end up a few px too narrow for its own chips, which can never
 * arm ScrollArea's scroller, so the chips spill and the mask clips them.
 *
 * `data-screen-toolbar` is what `scrollAppToToolbar` looks for.
 */
export function ScreenToolbar({
  tabs,
  actions,
  refine,
  status,
  className,
}: ScreenToolbarProps) {
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
