"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export interface StickyFadeHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** Tailwind classes, not a px value — the stuck inset is responsive. */
  top?: string;
  bg?: string;
  /** px. The part of `pad` that fades out. */
  fade?: number;
  /** px. Total bottom padding. */
  pad?: number;
  /** px, symmetric with `pad`. */
  padTop?: number;
  z?: number;
}

/**
 * A sticky sub-header that fades whatever scrolls up behind it instead of
 * hard-clipping it. The fade is a `mask-image` on the header's own padding,
 * not a separate strip, so it needs no "is it stuck yet" JS state and its
 * height counts toward the container's natural scrollHeight.
 *
 * `top` defaults to what every sticky sub-header in the content area needs:
 * `--app-mobile-header-h` clears the mobile header (0 once it is `lg:hidden`)
 * and `lg:-1.5rem` seats the stuck position flush with [data-app-scroll]'s
 * `lg:py-6` padding, which a bare `top-0` would leave as a see-through gap.
 *
 * `fade`/`pad` are px via inline style because they are tuned per instance.
 * `pad` is total bottom padding; `fade` is the part of it that fades, so
 * `pad - fade` is the buffer that holds content opaque until it is leaving.
 *
 * `bg` must match whatever is really behind this box; the mask only ever
 * reveals that.
 */
export function StickyFadeHeader({
  children,
  className,
  top = "top-[var(--app-mobile-header-h,0px)] lg:top-[-1.5rem]",
  bg = "bg-canvas lg:bg-surface",
  fade = 18,
  pad = 44,
  padTop = 12,
  z = 10,
  /* Anything else lands on the STICKY element itself. This matters for
   * `data-screen-toolbar`: `scrollAppToToolbar` reads this element's computed
   * `top` as the sticky inset, and an inner child would report `auto`. */
  ...rest
}: StickyFadeHeaderProps) {
  return (
    <div
      {...rest}
      className={cx("relative sticky", top, bg, className)}
      style={{
        zIndex: z,
        paddingTop: padTop,
        paddingBottom: pad,
        WebkitMaskImage: `linear-gradient(to bottom, black 0, black calc(100% - ${fade}px), transparent 100%)`,
        maskImage: `linear-gradient(to bottom, black 0, black calc(100% - ${fade}px), transparent 100%)`,
      }}
    >
      {children}
    </div>
  );
}
