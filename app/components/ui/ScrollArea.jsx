"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { stickPoint } from "./scroll";

/** Per-axis property names, so the logic below is written once. */
const AXIS = {
  x: {
    pos: "scrollLeft",
    size: "scrollWidth",
    client: "clientWidth",
    offset: "offsetLeft",
    extent: "offsetWidth",
    padEnd: "paddingRight",
    overflow: "overflow-x-auto",
    toward: "to right",
    next: "nextElementSibling",
  },
  y: {
    pos: "scrollTop",
    size: "scrollHeight",
    client: "clientHeight",
    offset: "offsetTop",
    extent: "offsetHeight",
    padEnd: "paddingBottom",
    overflow: "overflow-y-auto",
    toward: "to bottom",
    next: "nextElementSibling",
  },
};

/**
 * One scroll container, either axis, with edge fades and optional end slack.
 *
 * Props:
 *   `axis`      "x" (default) or "y".
 *   `arm`       "auto" (default) becomes a scroll container only once the
 *               content outgrows the box, and goes back to a plain row when
 *               the room returns. `true` is always a scroll container.
 *               `false` never arms itself: the caller owns the overflow
 *               property (AppShell's rail mode turns it on only at `lg:`).
 *   `fade`      Fade whichever edge still has content behind it.
 *   `band`      Width of that fade in px. 16 was invisible; 40 reads.
 *   `clipRoom`  px held open across the grain for a decoration that pokes
 *               outside a child's box (a corner badge). `axis="x"` only, and
 *               deliberately: the reservation is padding plus a cancelling
 *               negative margin, which only grows HEIGHT. A block's auto
 *               width is already its container's content box, so the same
 *               trick can never widen it.
 *   `void`      Hold open enough slack at the far end that the scroll range
 *               always reaches the resting point: the stick point of a sticky
 *               child, `[data-scroll-anchor]` or the screen toolbar. Without
 *               it a short tab has no scroll range, so the header jumps in
 *               and out as you tab. Measured, not a constant.
 *   `centerOnClick`  Glide a tapped child toward the middle.
 *
 * Six CSS constraints shaped this. Each was a bug first; do not simplify
 * them away:
 *
 * 1. Overflow on one axis drags the other out of `visible`, so an armed
 *    scroller always clips across its grain. `clipRoom` reserves that room.
 * 2. `mask-image` clips its element to its own border box, so the fade
 *    wrapper needs the SAME reservation as the rail or it re-clips what the
 *    rail just freed.
 * 3. Reserved padding counts toward `scrollWidth`, so overflow detection
 *    measures the last child's border box rather than `scrollWidth`.
 * 4. `max-w-full` (`max-h-full`) must always be on the rail, or it grows
 *    past its container and nothing ever reads as overflowing.
 * 5. The armed state must not manufacture its own overflow. `max-w-full`
 *    clamps the BORDER box, so padding added by arming comes out of CONTENT
 *    width, which is exactly the overflow that keeps it armed.
 * 6. It must not sit in a shrinkable flex item, or it gets squeezed to
 *    precisely its content width and the reading oscillates. `shrink-0`,
 *    and let the container wrap.
 *
 * And: a row that cannot overflow should not be a scroller. Passing `fade`
 * to three short tabs buys nothing but a chance to arm on a transient.
 */
export function ScrollArea({
  as: Tag = "div",
  axis = "x",
  arm = "auto",
  className,
  style,
  onScroll,
  onClick,
  clipRoom = 0,
  fade = true,
  band = 40,
  void: voidEnd = false,
  centerOnClick = false,
  children,
  ...rest
}) {
  const A = AXIS[axis] || AXIS.x;
  const vertical = axis === "y";
  // clipRoom is x-axis only; see the prop note above.
  const room = vertical ? 0 : clipRoom;

  const railRef = useRef(null);
  const [edges, setEdges] = useState({
    overflowing: false,
    atStart: true,
    atEnd: true,
  });
  const [slack, setSlack] = useState(0);
  // The applied slack, readable during measurement without a re-render.
  const slackRef = useRef(0);
  // The anchor's resting offset, remembered across frames; it can only be
  // read while the anchor is loose.
  const restRef = useRef(null);

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;

    /* The children's own extent, NOT `scrollSize`. `scrollSize` counts a
     * corner badge's overhang, which arms a rail whose chips fit; arming
     * reserves `clipRoom`, which absorbs the overhang, and the reading
     * oscillates. A child's offset + extent is its border box, and an
     * absolutely positioned badge is not in it, so this reads the same
     * armed or not. */
    let last = el.lastElementChild;
    // Walk past our own spacers: reserved room, not content. Counting them
    // re-arms a rail that fits and grows a void every pass.
    while (last && (last.hasAttribute("data-rail-spacer") || last.hasAttribute("data-scroll-void")))
      last = last.previousElementSibling;
    /* The slack actually RENDERED, read off the spacer, never `slackRef`.
     * State lands a frame before the DOM does, so measuring against the ref
     * makes the void feed on itself. */
    const voidEl = el.querySelector(":scope > [data-scroll-void]");
    const appliedSlack = voidEl
      ? Math.round(voidEl.getBoundingClientRect()[vertical ? "height" : "width"])
      : 0;

    const contentExtent = last
      ? last[A.offset] + last[A.extent]
      : el[A.size] - (parseFloat(getComputedStyle(el)[A.padEnd]) || 0) - appliedSlack;
    const overflowing = contentExtent > el[A.client] + 1;

    /* The ends are measured against the real scroll range, which INCLUDES
     * the reservation (that is where the trailing badge lives). Measuring
     * against the content extent declares the rail finished `clipRoom` px
     * early, with the last badge still outside the box. */
    const maxScroll = el[A.size] - el[A.client];
    const atStart = el[A.pos] <= 1;
    const atEnd = el[A.pos] >= maxScroll - 1;

    /* The void, measured. Only when this element really is a scroll
     * container: in AppShell's rail mode at phone width the page scrolls,
     * and padding a box that is not scrolling just adds dead space. */
    let want = 0;
    if (voidEnd) {
      const cs = getComputedStyle(el);
      const scrolls = /auto|scroll/.test(vertical ? cs.overflowY : cs.overflowX);
      const anchor =
        el.querySelector("[data-scroll-anchor]") ||
        el.querySelector("[data-screen-toolbar]");
      if (scrolls && anchor) {
        /* Read the resting point only while the anchor is loose, and keep
         * it: it is a layout constant, and the container is at 0 on mount
         * and on every `settle()`, so a good value always arrives. Until
         * then `want` stays 0 and no void is applied. */
        const { offset, pinned } = stickPoint(el, anchor, vertical);
        if (!pinned) restRef.current = offset;

        if (restRef.current != null) {
          /* Correct the range we can SEE rather than reconstructing content
           * height:
           *
           *     want = applied + (restPoint - currentRange)
           *
           * Converges in one pass. `scrollHeight` is floored at
           * `clientHeight`, so a short list reports a range of 0, which is
           * the truth here; and no child offset is consulted, so a pinned
           * sticky bar (Blink folds its shift into `offsetTop`) cannot skew it. */
          const range = el[A.size] - el[A.client];
          want = Math.max(0, Math.round(appliedSlack + restRef.current - range));
        }
      }
    }

    if (want !== slackRef.current) {
      slackRef.current = want;
      setSlack(want);
    }

    // Bail on an unchanged reading: arming changes the rail's padding, which
    // trips the observer again, and a fresh object would re-render each lap.
    setEdges((prev) =>
      prev.overflowing === overflowing &&
      prev.atStart === atStart &&
      prev.atEnd === atEnd
        ? prev
        : { overflowing, atStart, atEnd },
    );
  }, [A, vertical, voidEnd]);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    measure();
    /* One more reading after first paint: the first measure runs against a
     * layout still settling (web fonts, a sidebar transition), and a rail
     * that armed on it can sit armed with nothing left to fire an observer. */
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    const watch = () => {
      ro.disconnect();
      ro.observe(el);
      /* The parent is the only one that reports a change in the space
       * AVAILABLE: an inline-flex rail's observed box is its content width
       * (merely clamped by `max-w-full`) and `shrink-0` children never move.
       * Loop-safe: arming pads the wrapper, which fires once more, and that
       * pass is dropped by the bail-out in `measure`. */
      if (el.parentElement) ro.observe(el.parentElement);
      for (const child of el.children) ro.observe(child);
    };
    watch();
    const mo = new MutationObserver(() => {
      watch();
      measure();
    });
    // `subtree` on the vertical case: a page scroller's length is decided by
    // rows several levels down.
    mo.observe(el, { childList: true, subtree: vertical });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, vertical]);

  const armed = arm === true || (arm === "auto" && edges.overflowing);
  const fadeStart = fade && armed && !edges.atStart;
  const fadeEnd = fade && armed && !edges.atEnd;

  /* Across the grain only. Padding plus a cancelling negative margin grows
   * HEIGHT without costing layout; it can never widen a block, whose auto
   * width is already its container's content box. The along-the-grain room
   * is a real spacer child instead, so it sits inside `scrollWidth` and
   * every clipping box on the way up. */
  const crossRoom =
    armed && room ? { paddingTop: room, marginTop: -room } : null;

  const center = (e) => {
    const el = railRef.current;
    if (!el || el[A.size] <= el[A.client] + 1) return;
    // Whatever was tapped, scroll the direct child holding it.
    let item = e.target;
    while (item && item.parentElement !== el) item = item.parentElement;
    if (!item) return;
    const railBox = el.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    const start = vertical
      ? itemBox.top - railBox.top - el.clientTop + el.scrollTop
      : itemBox.left - railBox.left - el.clientLeft + el.scrollLeft;
    const size = vertical ? itemBox.height : itemBox.width;
    // scrollTo, not scrollIntoView: the latter walks every scrollable
    // ancestor and takes the page with it. Out-of-range targets clamp.
    el.scrollTo({
      [vertical ? "top" : "left"]: start + size / 2 - el[A.client] / 2,
      behavior: "smooth",
    });
  };

  const rail = (
    <Tag
      {...rest}
      ref={railRef}
      onScroll={(e) => {
        measure();
        onScroll?.(e);
      }}
      onClick={(e) => {
        if (centerOnClick) center(e);
        onClick?.(e);
      }}
      className={cx(
        // The clamp is not optional (constraint 4). `relative` makes the
        // offsetParent walk in `measure` terminate here.
        "relative",
        vertical ? "max-h-full" : "inline-flex max-w-full",
        armed && A.overflow,
        armed && "no-scrollbar",
        className,
      )}
      style={{ ...crossRoom, ...style }}
    >
      {children}
      {armed && room > 0 && (
        <span
          data-rail-spacer=""
          aria-hidden="true"
          style={{ flex: `0 0 ${room}px` }}
        />
      )}
      {slack > 0 && (
        <span
          data-scroll-void=""
          aria-hidden="true"
          style={
            vertical
              ? { display: "block", height: slack }
              : { flex: `0 0 ${slack}px` }
          }
        />
      )}
    </Tag>
  );

  if (!fade) return rail;

  /* The end band runs to the edge: the reserved room is a spacer at the end
   * of the content, only on screen when scrolled fully to the end, where
   * there is no end fade to draw. */
  const maskStops = [
    fadeStart ? "transparent" : "black",
    fadeStart ? `black ${band}px` : "black 0px",
    fadeEnd ? `black calc(100% - ${band}px)` : "black 100%",
    fadeEnd ? "transparent" : "black",
  ].join(", ");
  const mask = `linear-gradient(${A.toward}, ${maskStops})`;

  // A mask clips to its own border box, so the wrapper needs the same
  // reservation as the rail (constraint 2).
  return (
    <div
      className={cx("relative min-w-0", vertical && "h-full")}
      style={{
        ...crossRoom,
        ...(fadeStart || fadeEnd
          ? { WebkitMaskImage: mask, maskImage: mask }
          : null),
      }}
    >
      {rail}
    </div>
  );
}
