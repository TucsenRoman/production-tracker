"use client";

import { cx } from "./cx";
import { ScrollArea } from "./ScrollArea";
import { Tooltip } from "./Tooltip";

/** A count badge for a tab: always the brand colour, so it reads as a count
 *  rather than a severity signal. Zero renders nothing. */
export function TabDot({ count, variant = "corner" }) {
  if (!count) return null;
  return (
    <span
      className={cx(
        "absolute inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full",
        "text-[10px] font-semibold leading-none tnum shrink-0 ring-2 ring-surface",
        "bg-primary text-white transition-[top,right] duration-300",
        // "corner": the row's top-right corner (in-screen tabs, collapsed nav
        // rail, mobile tab bar).
        // "trailing": expanded nav rail, vertically centred inside the row's
        // trailing edge. Centred with a calc'd `top` rather than my-auto on
        // purpose: an auto margin cannot be transitioned, and a top/right
        // pair matched with "corner"'s lets `transition-[top,right]` animate
        // the sidebar collapse.
        // "glyph": anchored to a ~19px icon, pushed out so it kisses the
        // corner instead of burying half the glyph.
        variant === "trailing"
          ? "top-[calc((var(--ctl-h)-1rem)/2)] right-2"
          : variant === "glyph"
            ? "-top-2.5 -right-3"
            : "-top-1.5 -right-1.5",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  size = "md",
  className,
  /** Let the row scroll rather than squeeze, once it outgrows its space. */
  scroll = false,
  /** Fade the scrolling row's edges to hint at what's off-screen. */
  fade = false,
}) {
  // Fixed, not var(--ctl-h): the coarse-pointer touch-target bump scales
  // height alone, so chips went tall and squashed rather than bigger.
  const pad = size === "sm" ? "text-xs px-2 h-7" : "text-sm px-2.5 h-7";

  /* An option may carry a `hint`, shown on hover. Meant for chips that are a
   * MODE rather than a filter, where one word cannot say what changes. */
  const chips = options.map((o) => {
    const isActive = o.value === value;
    const chip = (
      <button
        key={o.value}
        role="tab"
        aria-selected={isActive}
        disabled={o.disabled}
        onClick={() => onChange(o.value)}
        className={cx(
          "relative inline-flex items-center justify-center gap-1.5 rounded-md font-medium shrink-0",
          "transition-colors duration-100 disabled:opacity-45 disabled:cursor-not-allowed",
          pad,
          isActive
            ? "bg-hover text-ink"
            : "text-ink-2 hover:bg-faint hover:text-ink",
        )}
      >
        {o.icon && <o.icon size={16} className="shrink-0" />}
        {o.label}
        {/* `resting` marks the OFF position — "All", "Everyone", "Any". A
          * resting state is not a queue, so it carries no badge. */}
        {o.count != null && !o.resting && <TabDot count={o.count} />}
      </button>
    );
    if (!o.hint) return chip;
    return (
      <Tooltip key={o.value} label={o.hint}>
        {chip}
      </Tooltip>
    );
  });

  // No track. The chips sit on the page and the active one takes the 5% tint.
  if (!scroll && !fade) {
    return (
      <div role="tablist" className={cx("inline-flex gap-1", className)}>
        {chips}
      </div>
    );
  }

  return (
    <ScrollArea
      axis="x"
      role="tablist"
      fade={fade}
      centerOnClick
      // Only a counted row has a badge hanging outside its chip to protect.
      clipRoom={options.some((o) => o.count != null && !o.resting) ? 14 : 0}
      className={cx("gap-1", className)}
    >
      {chips}
    </ScrollArea>
  );
}
