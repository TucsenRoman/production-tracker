"use client";

import { cx } from "./cx";

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
  /** px, symmetric with `pad`. */
  padTop = 12,
  z = 10,
  /* Anything else lands on the STICKY element itself. This matters for
   * `data-screen-toolbar`: `scrollAppToToolbar` reads this element's computed
   * `top` as the sticky inset, and an inner child would report `auto`. */
  ...rest
}) {
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

/**
 * The one toolbar composition every floor screen uses, so the row's layout
 * lives in one place rather than being re-inlined per screen.
 *
 * Slots, in the order they render:
 *   `tabs`    the Segmented rail. Gets `flex-1 min-w-0`, so with no `actions`
 *             it takes the full row. Never give this slot a shrink-to-fit
 *             parent: boxed to its content width it can end up a few px too
 *             narrow for its own chips, which can never arm ScrollArea's
 *             scroller, so the chips spill and the mask clips them.
 *   `actions` the screen's own controls, pinned right, never shrinking.
 *   `refine`  optional second line: the narrowing that applies within the
 *             selected tab. On one row with the tabs it reads as a set of
 *             peer controls competing for the same job.
 *   `status`  what the filters did to the list, sitting with `refine`.
 *
 * `data-screen-toolbar` is what `scrollAppToToolbar` looks for.
 */
