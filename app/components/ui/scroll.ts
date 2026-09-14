"use client";

/** Send the app's scroll container back to the top.
 *
 *  Both targets are hit on purpose: in tabs mode AppShell's `[data-app-scroll]`
 *  owns the scroll; in rail mode at phone width the page itself scrolls.
 *  Whichever is scrolling moves; the other is already at 0.
 *
 *  `behavior` defaults to instant, which is right for a tab change (the list
 *  has already been replaced). Pass "smooth" for a deliberate "back to top"
 *  control, where the travel is the feedback.
 *
 *  The scroll container is one persistent element every screen renders into,
 *  so switching to a shorter list leaves scrollTop past the new maximum and
 *  the browser silently clamps it to an arbitrary offset. Landing at the top
 *  of the new list is the deterministic answer. */
export function scrollAppToTop(behavior: ScrollBehavior = "auto") {
  document.querySelector("[data-app-scroll]")?.scrollTo({ top: 0, behavior });
  window.scrollTo({ top: 0, behavior });
}

export interface StickPoint {
  /** Only trustworthy while the anchor is loose — see below. */
  offset: number;
  pinned: boolean;
}

/** Where a sticky `anchor` comes to rest inside scroller `sc`, and whether it
 *  is resting there right now.
 *
 *  `offset` is only trustworthy while the anchor is LOOSE: once pinned, its
 *  rect IS the pinned position and every way of asking degenerates to
 *  "wherever you are now" (`offsetTop` included — Blink folds the sticky
 *  shift into it). `pinned` tells the caller which it got.
 *
 *  The stuck position is the sticky inset PLUS the scroller's own start
 *  padding. With the inset alone the pinned test never fires and a cached
 *  offset is nonsense.
 *
 *  One function because two callers must agree: `scrollAppToToolbar` aims at
 *  this point and ScrollArea's `void` reserves the range to reach it. */
export function stickPoint(
  sc: HTMLElement,
  anchor: HTMLElement,
  vertical = true,
): StickPoint {
  const edge = vertical ? "top" : "left";
  const pad = vertical ? "paddingTop" : "paddingLeft";
  const inset = parseFloat(getComputedStyle(anchor)[edge]) || 0;
  const stuckRel = inset + (parseFloat(getComputedStyle(sc)[pad]) || 0);
  const rel =
    anchor.getBoundingClientRect()[edge] - sc.getBoundingClientRect()[edge];
  const pos = vertical ? sc.scrollTop : sc.scrollLeft;
  return {
    offset: Math.max(0, Math.round(pos + rel - stuckRel)),
    pinned: rel <= stuckRel + 1,
  };
}

/** Scroll back to the point where the screen's toolbar STICKS — not to 0.
 *
 *  Going to 0 replays the header you already scrolled past on every tab
 *  change; the useful resting place is the toolbar pinned with the first row
 *  directly under it.
 *
 *  Never scrolls DOWN: the target is `min(current, stick)`, so switching tabs
 *  near the top of the page moves nothing.
 *
 *  A stuck element's rect IS its stuck position, so its natural offset is
 *  read after parking the container at 0; both writes land in one task, so
 *  only the final result is painted. The toolbar sits above the list, so
 *  its offset is correct even before React commits the new list.
 *
 *  `top` on the bar is the sticky inset and comes out of the offset — it is
 *  how far past its own position the bar travels once stuck. */
export function scrollAppToToolbar(behavior: ScrollBehavior = "auto") {
  const bar = document.querySelector<HTMLElement>("[data-screen-toolbar]");
  const sc = document.querySelector<HTMLElement>("[data-app-scroll]");
  if (!bar) return scrollAppToTop(behavior);

  // Rail mode at phone width: the page scrolls, and nothing below applies.
  if (!sc || sc.scrollHeight <= sc.clientHeight) {
    const inset = parseFloat(getComputedStyle(bar).top) || 0;
    const was = window.scrollY;
    window.scrollTo({ top: 0, behavior: "auto" });
    const stick = bar.getBoundingClientRect().top - inset;
    window.scrollTo({ top: Math.max(0, Math.min(was, stick)), behavior });
    return;
  }

  /* Capture the position we are LEAVING, once. This runs inside the click
   * handler, so the scroll range is about to change twice: when React commits
   * the new list, and again when ScrollArea's `void` lands a frame or two
   * later. The target is computed from the starting position and re-applied
   * until it takes; re-reading `scrollTop` each pass would read 0 after the
   * first clamp, and `min(0, stick)` is 0 forever. */
  const from = sc.scrollTop;
  const settle = () => {
    // `stickPoint` can only be read while the bar is loose, so park at 0 and
    // put the scroll straight back; both writes paint as one.
    const at = sc.scrollTop;
    sc.scrollTop = 0;
    const { offset } = stickPoint(sc, bar, true);
    sc.scrollTop = at;
    return Math.max(0, Math.min(from, offset));
  };

  const target = settle();
  const apply = (t: number) => {
    if (behavior === "smooth") sc.scrollTo({ top: t, behavior });
    else sc.scrollTop = t;
  };
  apply(target);

  /* Chase it for a few frames: recompute the target each pass and stop once
   * the container actually holds it (the frame the void finished growing).
   * Five frames covers a render → measure → setState → render round trip. */
  let frames = 5;
  const chase = () => {
    const t = settle();
    if (Math.abs(sc.scrollTop - t) > 1) apply(t);
    if (--frames > 0 && Math.abs(sc.scrollTop - t) > 1)
      requestAnimationFrame(chase);
  };
  requestAnimationFrame(chase);
}
