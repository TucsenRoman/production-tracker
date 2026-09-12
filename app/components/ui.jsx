"use client";

/**
 * UI primitives.
 *
 * Every surface in the product is composed from these — screens never reach for
 * raw colour or spacing utilities. Variants are plain objects rather than a
 * class-variance library so there's no dependency to keep in step.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  Search,
  X,
} from "lucide-react";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

/* ----------------------------------------------------------------- Scroll -- */

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
export function scrollAppToTop(behavior = "auto") {
  document.querySelector("[data-app-scroll]")?.scrollTo({ top: 0, behavior });
  window.scrollTo({ top: 0, behavior });
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
function stickPoint(sc, anchor, vertical = true) {
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
export function scrollAppToToolbar(behavior = "auto") {
  const bar = document.querySelector("[data-screen-toolbar]");
  const sc = document.querySelector("[data-app-scroll]");
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
  const apply = (t) => {
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
    if (--frames > 0 && Math.abs(sc.scrollTop - t) > 1) requestAnimationFrame(chase);
  };
  requestAnimationFrame(chase);
}

/* ------------------------------------------------------------------ Slots -- */

/**
 * Named portals from a screen into the app shell. A page's own actions belong
 * beside the page title, but the title is rendered by the shell and the
 * handlers live in the screen, so the screen posts into a slot the shell put
 * there. A ref callback sets the target once, so there is no render loop to
 * guard against.
 */
const SlotContext = createContext(null);

export function SlotProvider({ children }) {
  const [nodes, setNodes] = useState({});
  const register = useCallback((name, el) => {
    setNodes((n) => (n[name] === el ? n : { ...n, [name]: el }));
  }, []);
  return (
    <SlotContext.Provider value={{ nodes, register }}>
      {children}
    </SlotContext.Provider>
  );
}

/** Renders where the slot's contents should appear. Empty until a screen fills it. */
export function SlotTarget({ name, className }) {
  const ctx = useContext(SlotContext);
  const register = ctx?.register;
  const ref = useCallback((el) => register?.(name, el), [register, name]);
  return <div ref={ref} className={className} />;
}

/** Renders its children into the named target. No-op until the target mounts. */
export function Slot({ name, children }) {
  const ctx = useContext(SlotContext);
  const el = ctx?.nodes?.[name];
  return el ? createPortal(children, el) : null;
}

/* ---------------------------------------------------------------- Button -- */

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-md " +
  "transition-colors duration-100 select-none whitespace-nowrap " +
  "disabled:cursor-not-allowed disabled:opacity-55";

// No variant carries a resting shadow. `primary` is the one filled accent on a
// screen — a second one on the same view breaks the under-1% coverage budget.
const BTN_VARIANT = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-transparent text-ink border border-line-strong hover:bg-hover",
  ghost: "bg-transparent text-ink-2 hover:bg-hover hover:text-ink",
  success: "bg-transparent text-ok border border-ok-line hover:bg-ok-soft",
  danger:
    "bg-transparent text-danger border border-danger-line hover:bg-danger-soft",
  subtle: "bg-hover text-ink hover:bg-faint",
};

// Heights come from the density variables, so a station tablet gets a 44px
// target and a desk gets Notion's 28px without either being a special case.
const BTN_SIZE = {
  sm: "text-xs px-2 h-[var(--ctl-h)]",
  md: "text-sm px-2.5 h-[var(--ctl-h)]",
  lg: "text-sm px-3 h-[var(--ctl-h-lg)]",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}) {
  const iconSize = size === "sm" ? 12 : 16;
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        BTN_BASE,
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        block && "w-full",
        className,
      )}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin shrink-0" />
      ) : (
        Icon && <Icon size={iconSize} className="shrink-0" />
      )}
      {children}
      {IconRight && !loading && (
        <IconRight size={iconSize} className="shrink-0" />
      )}
    </button>
  );
}

export function IconButton({
  label,
  icon: Icon,
  size = 16,
  className,
  /* `label` becomes a native `title` by default. Pass `title={null}` to
   * suppress it (Tooltip does this to its child so only one label shows).
   * `aria-label` is unaffected either way. */
  title,
  ...rest
}) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={title === null ? undefined : (title ?? label)}
      className={cx(
        "inline-flex items-center justify-center rounded-md shrink-0",
        "w-[var(--ctl-h)] h-[var(--ctl-h)]",
        "text-icon-2 hover:text-icon hover:bg-hover transition-colors duration-100",
        className,
      )}
    >
      <Icon size={size} />
    </button>
  );
}

/* ------------------------------------------------------------------ Card -- */

export function Card({
  as: Tag = "div",
  inset = false,
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      {...rest}
      className={cx(
        // Not a box: two rules, one above and one below, with the page showing
        // through. No side borders, radius or shadow — the DNA bans wrapping a
        // group in a box.
        "bg-surface border-y border-line",
        inset && "py-3",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ---------------------------------------------------------- Sticky header -- */

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

/* -------------------------------------------------------- Section heading -- */

/**
 * The heading that opens one group inside a flat, un-boxed list: icon, label
 * in caps, count, then a hairline running out to the right edge.
 *
 * The rule sits ON the heading's line, not under it — a hairline below the
 * label reads as one more row divider.
 *
 * Render one for every group, even when a filter leaves a single group; a
 * list that drops its headings reads as broken. Pair with a `pl-6` list
 * beneath: the indent is the only thing that says "these belong here".
 */
export function SectionHeading({ icon: Icon, label, count, className }) {
  return (
    <div className={cx("flex items-center gap-2 mb-1", className)}>
      {Icon && <Icon size={14} className="text-icon-2 shrink-0" />}
      <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wide shrink-0">
        {label}
      </h3>
      {count !== undefined && (
        <span className="text-xs text-ink-4 tnum shrink-0">{count}</span>
      )}
      <span className="flex-1 h-px bg-line" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------ Row actions -- */

/**
 * Per-row controls (edit, remove, …). Put `group` on the row itself.
 *
 * Hover-reveal is a console pattern. On the floor's touch tablets `:hover`
 * never fires and reaching a control via `focus-within` means tapping the
 * row first, which on a row that is itself a button fires the row's action.
 * So `hover: none` forces them visible, and floor screens should also pass
 * `always` so the same screen opened on a desktop behaves the same.
 */
export function RowActions({ always = false, className, children }) {
  return (
    <div
      className={cx(
        "flex items-center gap-0.5 shrink-0 transition-opacity duration-100",
        !always && [
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          "[@media(hover:none)]:opacity-100",
        ]
          .join(" "),
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge -- */

const BADGE_TONE = {
  neutral: "bg-sunken text-ink-2 border-line",
  ok: "bg-ok-soft text-ok border-ok-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  // Not the accent. A role chip is not the next action on the screen.
  info: "bg-hover text-ink-2 border-transparent",
  cold: "bg-cold-soft text-cold border-cold-soft",
};

export function Badge({ tone = "neutral", icon: Icon, className, children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-2 h-5 rounded-full border",
        "text-xs font-medium whitespace-nowrap",
        BADGE_TONE[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} className="shrink-0" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Kbd/Meta */

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

/* ----------------------------------------------------------------- Fields -- */

export function Label({ htmlFor, className, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cx("block text-xs font-medium text-ink-3 mb-1.5", className)}
    >
      {children}
    </label>
  );
}

export function Field({ label, hint, error, htmlFor, className, children }) {
  return (
    <div className={className}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>
      )}
    </div>
  );
}

const INPUT_BASE =
  "w-full bg-surface border text-ink placeholder:text-ink-4 " +
  "transition-colors duration-100 focus:border-primary outline-none " +
  "disabled:bg-sunken disabled:text-ink-3";

/** `pill` is for an input that sits in a row of chips and must take their
 *  shape and size. */
export function Input({
  invalid,
  pill = false,
  className,
  size = "md",
  ...rest
}) {
  const shape = pill
    ? "rounded-full px-3 text-xs h-[var(--ctl-h)]"
    : size === "lg"
      ? "rounded-md px-2.5 text-sm h-[var(--ctl-h-lg)]"
      : "rounded-md px-2.5 text-sm h-[var(--ctl-h)]";
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={cx(
        INPUT_BASE,
        shape,
        invalid ? "border-danger" : "border-line-strong",
        className,
      )}
    />
  );
}

/** Numeric PIN entry — large, spaced, never remembered by the browser. */
export function PinInput({ invalid, className, ...rest }) {
  return (
    <input
      {...rest}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      placeholder="••••"
      aria-invalid={invalid || undefined}
      className={cx(
        INPUT_BASE,
        "rounded-md px-3 h-[var(--ctl-h-lg)] text-base tracking-[0.4em] font-mono",
        invalid ? "border-danger" : "border-line-strong",
        className,
      )}
    />
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  pill = false,
  className,
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-2 h-[var(--ctl-h)] bg-surface border border-line-strong",
        // Focus ring on the whole pill (input's own ring is off) so a focused
        // search field stays one shape.
        "focus-within:border-primary focus-within:shadow-[0_0_0_2px_var(--color-canvas),0_0_0_4px_var(--color-primary)]",
        "transition-colors duration-100",
        pill ? "rounded-full px-3" : "rounded-md px-2.5",
        className,
      )}
    >
      <Search size={14} className="text-icon-2 shrink-0" />
      {/* type="text", not "search": browsers draw their own cancel glyph on a
          search input, on top of the clear button below. */}
      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none focus-visible:shadow-none text-sm text-ink placeholder:text-ink-4 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <IconButton
          label="Clear search"
          icon={X}
          size={13}
          onClick={() => onChange("")}
          className="w-5 h-5 shrink-0"
        />
      )}
    </div>
  );
}

const TOOLTIP_GAP = 6; // trigger-to-bubble gap, in every direction
const TOOLTIP_MARGIN = 8; // never closer than this to the viewport edge

/**
 * A hover/focus label — built, not the native `title`, which browsers delay
 * and style differently and some skip on touch.
 *
 * `side` is a preference, not a promise: the bubble is measured after mount,
 * portaled to `document.body` with `position: fixed` (no ancestor overflow
 * gets a vote), flipped if the preferred side does not fit, and slid along
 * the cross axis to stay on screen.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
  disabled = false,
  // Pin the bubble above the pointer instead of the trigger's centre. For a
  // trigger that is a long strip, the centre can be far from the pointer.
  followCursor = false,
}) {
  const [open, setOpen] = useState(false);
  // Viewport coordinates; null until measured, so nothing paints at (0,0).
  const [pos, setPos] = useState(null);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);
  const bubbleRef = useRef(null);
  // Last known pointer position. A ref: only read when repositioning.
  const cursorRef = useRef({ x: 0, y: 0 });

  const reposition = () => {
    const bubble = bubbleRef.current?.getBoundingClientRect();
    if (!bubble) return;

    const clamp = (value, size, max) =>
      Math.min(
        Math.max(value, TOOLTIP_MARGIN),
        Math.max(TOOLTIP_MARGIN, max - size - TOOLTIP_MARGIN),
      );

    if (followCursor) {
      const { x, y } = cursorRef.current;
      // Above the pointer; below it only when there is no room above.
      const top =
        y - bubble.height - TOOLTIP_GAP >= TOOLTIP_MARGIN
          ? y - bubble.height - TOOLTIP_GAP
          : y + TOOLTIP_GAP;
      const left = clamp(x - bubble.width / 2, bubble.width, window.innerWidth);
      setPos({ top, left });
      return;
    }

    const trigger = wrapRef.current?.getBoundingClientRect();
    if (!trigger) return;

    const fits = (s) => {
      if (s === "top")
        return trigger.top - bubble.height - TOOLTIP_GAP >= TOOLTIP_MARGIN;
      if (s === "bottom")
        return (
          trigger.bottom + bubble.height + TOOLTIP_GAP <=
          window.innerHeight - TOOLTIP_MARGIN
        );
      if (s === "left")
        return trigger.left - bubble.width - TOOLTIP_GAP >= TOOLTIP_MARGIN;
      return (
        trigger.right + bubble.width + TOOLTIP_GAP <=
        window.innerWidth - TOOLTIP_MARGIN
      ); // "right"
    };
    const opposite = {
      top: "bottom",
      bottom: "top",
      left: "right",
      right: "left",
    };
    const placed = fits(side)
      ? side
      : fits(opposite[side])
        ? opposite[side]
        : side;

    let top, left;
    if (placed === "top" || placed === "bottom") {
      top =
        placed === "top"
          ? trigger.top - bubble.height - TOOLTIP_GAP
          : trigger.bottom + TOOLTIP_GAP;
      left = clamp(
        trigger.left + trigger.width / 2 - bubble.width / 2,
        bubble.width,
        window.innerWidth,
      );
    } else {
      left =
        placed === "left"
          ? trigger.left - bubble.width - TOOLTIP_GAP
          : trigger.right + TOOLTIP_GAP;
      top = clamp(
        trigger.top + trigger.height / 2 - bubble.height / 2,
        bubble.height,
        window.innerHeight,
      );
    }
    setPos({ top, left });
  };

  const show = (e) => {
    if (disabled) return;
    if (followCursor && typeof e?.clientX === "number") {
      cursorRef.current = { x: e.clientX, y: e.clientY };
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), 350);
  };
  const hide = () => {
    clearTimeout(timerRef.current);
    setOpen(false);
    setPos(null);
  };
  // followCursor only: keep the bubble above the pointer as it moves.
  const track = (e) => {
    if (!followCursor || typeof e.clientX !== "number") return;
    cursorRef.current = { x: e.clientX, y: e.clientY };
    if (open) reposition();
  };
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Layout effect: the bubble is measured and placed before paint, so it
  // never shows at the wrong position and then jumps.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    // Re-measure only on signals that can move the trigger or resize the bubble.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, side, label]);

  /* Strip a native `title` off the child (IconButton sets one), otherwise a
   * tooltipped control shows this bubble AND the browser's own box a second
   * later. `aria-label` is untouched. */
  const child =
    React.isValidElement(children) && children.props?.title !== null
      ? React.cloneElement(children, { title: null })
      : children;

  return (
    <span
      ref={wrapRef}
      className={cx("relative inline-flex shrink-0", className)}
      onMouseEnter={show}
      onMouseMove={track}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {child}
      {!disabled &&
        open &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            ref={bubbleRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? "visible" : "hidden",
            }}
            className={cx(
              "pointer-events-none z-60 whitespace-nowrap",
              "px-2 py-1 rounded-md bg-ink text-white text-xs font-medium shadow-md animate-fade-in",
            )}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}

/** The one surface every floating panel is cut from, so a pinned control and
 *  the option list can never drift apart. */
const PANEL = "rounded-md border border-line-strong bg-surface shadow-md";

/**
 * A filter that opens a menu — built, not the native `<select>`, so it shares
 * the system's panel surface and matches its trigger's height and radius.
 * `on` marks the trigger as active (non-default).
 */
const DROPDOWN_GAP = 4; // trigger-to-menu gap

export function Dropdown({
  value,
  onChange,
  options,
  icon: Icon,
  on = false,
  disabled,
  className,
  menuSide = "bottom",
  // A control that acts on the option list rather than being a choice (an
  // A–Z toggle, a quick filter). It gets its own panel, stacked above or
  // below the options; `pinnedSide` picks which end.
  pinned,
  pinnedSide = "top",
  /* Multi-select: `value` is an array and `onChange` gets the next array.
   * The menu stays open while ticking. An empty array means "no narrowing";
   * the trigger says so with `placeholder`. */
  multiple = false,
  /** Trigger text when a multi-select has nothing picked (e.g. "All locations"). */
  placeholder,
  /** Trigger text for 2+ picks. Defaults to "N selected". */
  summary,
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* Portaled and `position: fixed`, for the same reason as Popover: an
   * `absolute` menu inside a `StickyFadeHeader` is clipped and faded by the
   * header's mask. Same measure-flip-clamp as Popover, re-run on scroll and
   * resize so a menu hung off a sticky control stays attached. */
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const trigger = rootRef.current?.getBoundingClientRect();
      const menu = menuRef.current?.getBoundingClientRect();
      if (!trigger || !menu) return;
      const room = {
        bottom: trigger.bottom + menu.height + DROPDOWN_GAP <= window.innerHeight - POPOVER_MARGIN,
        top: trigger.top - menu.height - DROPDOWN_GAP >= POPOVER_MARGIN,
      };
      const other = menuSide === "top" ? "bottom" : "top";
      const placed = room[menuSide] ? menuSide : room[other] ? other : menuSide;
      const top =
        placed === "top"
          ? trigger.top - menu.height - DROPDOWN_GAP
          : trigger.bottom + DROPDOWN_GAP;
      /* Hang from the trigger's left edge, but flip to its right edge when
       * the menu would run off the side. Clamped to the viewport either way. */
      const wantsRight = trigger.left + menu.width > window.innerWidth - POPOVER_MARGIN;
      const left = Math.min(
        Math.max(wantsRight ? trigger.right - menu.width : trigger.left, POPOVER_MARGIN),
        Math.max(POPOVER_MARGIN, window.innerWidth - menu.width - POPOVER_MARGIN),
      );
      setPos({ top, left, minWidth: trigger.width });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, menuSide, options, pinned]);

  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  const selected = multiple ? (Array.isArray(value) ? value : []) : null;
  const current = multiple ? null : options.find((o) => o.value === value);

  // One pick reads as its own name, not "1 selected".
  const triggerLabel = multiple
    ? selected.length === 0
      ? (placeholder ?? "Any")
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? placeholder ?? "1 selected")
        : (summary?.(selected.length) ?? `${selected.length} selected`)
    : (current?.label ?? "");

  const isOn = on || (multiple && selected.length > 0);

  const pick = (v) => {
    if (!multiple) {
      onChange(v);
      setOpen(false);
      return;
    }
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };

  return (
    <div
      ref={rootRef}
      className={cx("relative inline-block shrink-0", className)}
    >
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "inline-flex items-center gap-1.5 px-2.5 h-[var(--ctl-h)] rounded-full border",
          "text-xs font-medium transition-colors duration-100 max-w-[11rem]",
          "disabled:opacity-45 disabled:cursor-not-allowed",
          isOn
            ? "border-line-strong bg-hover text-ink"
            : "border-line bg-surface text-ink-2 hover:bg-hover",
        )}
      >
        {Icon && <Icon size={12} className="shrink-0" />}
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          size={12}
          className={cx(
            "shrink-0 text-ink-4 transition-transform duration-100",
            open && "rotate-180",
          )}
        />
      </button>

      {open && typeof document !== "undefined" &&
        createPortal(
        // `menuSide` is a preference, not a promise: a dropdown near the
        // bottom of the viewport flips upward. Each part of the menu is its
        // own surface, so the gap between them carries the separation.
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            minWidth: pos?.minWidth,
            // In the DOM to be measured, but never painted at (0,0) first.
            visibility: pos ? "visible" : "hidden",
          }}
          className="z-40 w-max max-w-[16rem] flex flex-col gap-1"
        >
          {pinned && pinnedSide === "top" && (
            <div className={cx(PANEL, "p-1")}>{pinned}</div>
          )}

          {/* `role="listbox"` is on the options alone; the pinned control is
              a button, not a choice. */}
          <div
            role="listbox"
            aria-multiselectable={multiple || undefined}
            className={cx(PANEL, "py-1")}
          >
            {options.map((o) => {
              const active = multiple ? selected.includes(o.value) : o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(o.value)}
                  className={cx(
                    "w-full flex items-center gap-2 text-left px-3 h-[var(--row-h)] text-sm",
                    active
                      ? "bg-hover text-ink font-medium"
                      : "text-ink-2 hover:bg-faint hover:text-ink",
                  )}
                >
                  {o.icon && (
                    <o.icon size={13} className="shrink-0 text-ink-4" />
                  )}
                  <span className="truncate">{o.label}</span>
                  {/* A tick, not a checkbox: with several on at once you need
                      a mark you can count down the column. */}
                  {multiple && (
                    <Check
                      size={14}
                      className={cx("ml-auto shrink-0", active ? "text-ink-2" : "opacity-0")}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {pinned && pinnedSide === "bottom" && (
            <div className={cx(PANEL, "p-1")}>{pinned}</div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Popover -- */

const POPOVER_GAP = 6; // trigger-to-panel gap
const POPOVER_MARGIN = 8; // never closer than this to the viewport edge

/**
 * A small floating panel hung off a trigger: a legend, a filter panel,
 * anything you open deliberately, read or poke at, and dismiss.
 *
 * Portaled and `position: fixed`, not `absolute`: an absolutely positioned
 * panel is clipped by any ancestor that clips, and the obvious place to open
 * one is a `StickyFadeHeader`, whose `mask-image` clips and fades its subtree.
 *
 * Placement is a preference, not a promise: measured after mount, flipped
 * when the preferred side does not fit, slid along the cross axis to stay on
 * screen, and re-measured on scroll and resize so a panel hung off a sticky
 * control stays attached.
 *
 * Dismissal: Escape, a pointer-down outside, and the caller's own trigger
 * toggle (the outside-press listener ignores presses inside this wrapper, so
 * the two never produce a close-then-reopen flicker). Presses inside the
 * panel do nothing.
 *
 * Controlled on purpose: the caller owns `open` for its trigger's pressed
 * styling and `aria-expanded`, so it must not be duplicated here.
 */
export function Popover({
  open,
  onClose,
  content,
  side = "bottom",
  /** Which edge of the panel lines up with the trigger's: "start" | "end". */
  align = "start",
  label,
  className,
  panelClassName,
  children,
}) {
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const place = () => {
      const trigger = wrapRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!trigger || !panel) return;

      const clamp = (value, size, max) =>
        Math.min(
          Math.max(value, POPOVER_MARGIN),
          Math.max(POPOVER_MARGIN, max - size - POPOVER_MARGIN),
        );

      const room = {
        bottom:
          trigger.bottom + panel.height + POPOVER_GAP <=
          window.innerHeight - POPOVER_MARGIN,
        top: trigger.top - panel.height - POPOVER_GAP >= POPOVER_MARGIN,
      };
      const placed = room[side] ? side : room[side === "top" ? "bottom" : "top"] ? (side === "top" ? "bottom" : "top") : side;

      const top =
        placed === "top"
          ? trigger.top - panel.height - POPOVER_GAP
          : trigger.bottom + POPOVER_GAP;
      const left = clamp(
        align === "end" ? trigger.right - panel.width : trigger.left,
        panel.width,
        window.innerWidth,
      );
      setPos({ top, left });
    };

    place();
    // Capture phase: catches scrolling in any container, not just the window.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, side, align, content]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return; // the trigger's own toggle
      if (panelRef.current?.contains(e.target)) return; // working inside the panel
      onClose?.();
    };
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  return (
    <span ref={wrapRef} className={cx("relative inline-flex shrink-0", className)}>
      {children}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            aria-label={label}
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              // In the DOM to be measured, but never painted at (0,0) first.
              visibility: pos ? "visible" : "hidden",
            }}
            className={cx(PANEL, "z-40 animate-fade-in", panelClassName)}
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}

/* ------------------------------------------------------------- ScrollArea -- */

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

/* ------------------------------------------------------------- Segmented -- */

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
        {o.count != null && <TabDot count={o.count} />}
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
      clipRoom={options.some((o) => o.count != null) ? 14 : 0}
      className={cx("gap-1", className)}
    >
      {chips}
    </ScrollArea>
  );
}

/* ----------------------------------------------------------------- Switch */

export function Switch({ checked, onChange, disabled, label, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full",
        "transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
        checked ? "bg-primary" : "bg-line-strong",
        className,
      )}
    >
      <span
        className={cx(
          "inline-block h-4 w-4 transform rounded-full bg-white",
          "transition-transform duration-150",
          checked ? "translate-x-5" : "translate-x-1",
        )}
      />
    </button>
  );
}

/* ---------------------------------------------------------------- StatCard */

/** A number, and — when `onClick` is given — the filter that number describes,
 *  so the count and the way to act on it are the same target. */
export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  onClick,
  active = false,
}) {
  const toneClass = {
    neutral: "text-ink",
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
    primary: "text-ink",
  }[tone];

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick
        ? {
            onClick,
            type: "button",
            "aria-pressed": active,
            className: undefined,
          }
        : {})}
      className={cx(
        "border rounded-md px-3.5 py-2.5 text-left w-full transition-colors duration-100",
        // Selection is the 5% tint and a firmer hairline — never a colour wash.
        active ? "border-line-strong bg-hover" : "border-line bg-surface",
        onClick && !active && "hover:bg-faint cursor-pointer",
      )}
    >
      <div className="flex items-center gap-1.5 text-ink-3 mb-1">
        {Icon && <Icon size={12} className="shrink-0" />}
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        {/* 24px against 14px body = 1.7:1. The tile is a number, not a headline. */}
        <span
          className={cx("text-2xl font-semibold tnum leading-none", toneClass)}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-ink-3 font-medium">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-3 truncate">{hint}</div>}
    </Tag>
  );
}

export function StatGrid({ className, children }) {
  return (
    <div className={cx("grid grid-cols-2 lg:grid-cols-4 gap-2", className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ ProgressBar -- */

export function ProgressBar({
  value,
  tone = "primary",
  size = "md",
  className,
}) {
  const toneClass = {
    primary: "bg-primary",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
    muted: "bg-line-strong",
  }[tone];
  const h = size === "sm" ? "h-1" : "h-1.5";
  return (
    <div
      className={cx(
        "flex-1 rounded-full bg-inset overflow-hidden",
        h,
        className,
      )}
    >
      {/* width is a runtime percentage, so it stays an inline style */}
      <div
        className={cx(
          "rounded-full transition-[width] duration-300",
          h,
          toneClass,
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- EmptyState -- */

export function EmptyState({
  title,
  description,
  action,
  className,
}) {
  return (
    // State the absence, offer the one action, in a sentence. No centred card,
    // no illustration, no bordered box — the DNA bans all three.
    <div className={cx("px-3 py-8", className)}>
      <p className="text-sm text-ink-3">
        {title}
        {description && <span className="text-ink-4"> — {description}</span>}
      </p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- Skeleton -- */

function Skeleton({ className }) {
  return <div className={cx("skeleton rounded-sm", className)} />;
}

export function SkeletonRows({ rows = 3 }) {
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

/* ----------------------------------------------------------------- Modal -- */

/**
 * Bottom sheet on phones, centred dialog from `sm` up. Closes on Escape and on
 * backdrop click; focus is moved into the panel on open.
 */
export function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  footer,
  size = "sm",
  children,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector("input, button, [tabindex]")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg" }[
    size
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div
        className="absolute inset-0 bg-ink/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative w-full bg-surface shadow-pop",
          "rounded-t-md sm:rounded-md sm:m-4 pb-safe sm:pb-0",
          // Capped-height column: header and footer hold, the body scrolls.
          // dvh, not vh, because mobile browser chrome makes vh overshoot.
          "flex flex-col max-h-[88dvh] sm:max-h-[calc(100dvh-2rem)]",
          "animate-slide-up sm:animate-pop-in",
          width,
        )}
      >
        {title && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              {Icon && <Icon size={16} className="text-icon-2 shrink-0" />}
              <h2 className="text-sm font-medium text-ink truncate">{title}</h2>
            </div>
            <IconButton label="Close" icon={X} size={17} onClick={onClose} />
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar px-4 pb-4">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-line rounded-b-md">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Toasts -- */

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

const TOAST_ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TOAST_ACCENT = {
  success: "text-ok",
  error: "text-danger",
  info: "text-primary",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback(
    (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  const toast = useCallback(
    (message, { tone = "success", detail, duration = 4000 } = {}) => {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, message, detail, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={cx(
          "fixed z-[60] flex flex-col gap-2 pointer-events-none",
          // Above the mobile tab bar on phones, bottom-right on desktop.
          "left-4 right-4 bottom-20 items-stretch",
          "sm:left-auto sm:right-5 sm:bottom-5 sm:w-80 sm:items-end",
        )}
      >
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.tone];
          return (
            <div
              key={t.id}
              className={cx(
                "pointer-events-auto w-full flex items-start gap-2.5 px-3 py-2.5",
                "bg-surface rounded-md shadow-md animate-toast-in",
              )}
            >
              <Icon
                size={16}
                className={cx("shrink-0 mt-px", TOAST_ACCENT[t.tone])}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t.message}</p>
                {t.detail && (
                  <p className="mt-0.5 text-xs text-ink-3">{t.detail}</p>
                )}
              </div>
              <IconButton
                label="Dismiss"
                icon={X}
                size={14}
                onClick={() => dismiss(t.id)}
                className="w-6 h-6 -mr-1 -mt-0.5"
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
