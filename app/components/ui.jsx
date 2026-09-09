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

/* ------------------------------------------------------------------ Slots -- */

/**
 * Named portals from a screen into the app shell.
 *
 * A page's own actions — "Add product", a data-source status, a refresh —
 * belong beside the page title, not stacked into the middle of the content
 * where they read as one more filter. But the title is rendered by the shell
 * and the handlers live in the screen, so the screen posts into a slot the
 * shell put there.
 *
 * A ref callback sets the target once, so there is no state to keep in step
 * and no render loop to guard against.
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
  /* A bare icon needs a hoverable name, so `label` becomes a native `title`
   * by default. Pass `title={null}` to suppress it — which is what `Tooltip`
   * does to its child, so a tooltipped IconButton shows ONE label instead of
   * this bubble plus the browser's own a second later. `aria-label` is
   * unaffected either way. */
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
        // Not a card. A section is two rules — one above, one below — and the
        // page showing through between them. No side borders, no radius, no
        // shadow: the DNA bans wrapping a GROUP in a box, and every one of
        // these held a group.
        "bg-surface border-y border-line",
        inset && "py-3",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}) {
  return (
    <div
      className={cx(
        "flex items-start justify-between gap-3 py-2.5 border-b border-line",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          {Icon && <Icon size={16} className="text-icon-2 shrink-0" />}
          <span className="truncate">{title}</span>
        </div>
        {/* Same size as the title, separated by colour alone — the flat scale. */}
        {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cx("py-3", className)}>{children}</div>;
}

/* ---------------------------------------------------------- Sticky header -- */

/**
 * A sticky sub-header that fades whatever's scrolling up behind it, instead
 * of hard-clipping it. The fade is a `mask-image` on the header's own
 * background — real content-area padding, not a separate absolutely-
 * positioned strip — so it needs no JS "is this actually stuck yet" state
 * (a masked-but-solid box looks identical to a fully solid one until
 * there's something behind it to reveal), and it contributes its own height
 * to the scrolling container's natural scrollHeight, so nothing further
 * down the tree needs a hand-matched reserve to compensate. See
 * TasksScreen's toolbar for the case this was extracted from.
 *
 * `top` defaults to the offset every OTHER sticky sub-header living inside
 * the content area needs too: `--app-mobile-header-h` (set by AppShell)
 * clears the mobile header — already 0 once that header's `lg:hidden` — and
 * `lg:-1.5rem` pulls the stuck position up flush with [data-app-scroll]'s
 * own `lg:py-6` padding, which a bare `top-0` would otherwise leave as a
 * gap that whatever's mid-scroll shows straight through. Override it only
 * if this header doesn't live in that same containing block.
 *
 * `fade`/`pad` are px, not Tailwind steps, because they're tuned per
 * instance — inline style avoids needing every possible pb-N/mask-stop
 * combination to already exist in the compiled CSS. `pad` is the header's
 * total bottom padding (solid buffer + fade zone); `fade` is how much of
 * that, measured up from the bottom edge, actually fades — `pad - fade` is
 * the buffer that holds content fully opaque until it's genuinely leaving.
 *
 * `bg` defaults to the one real background this pattern has needed so far
 * (canvas on mobile, the card surface at `lg:`); pass a different value for
 * a header that sits on something else — the mask only ever reveals
 * whatever's really behind THIS box, so it must match.
 */
export function StickyFadeHeader({
  children,
  className,
  top = "top-[var(--app-mobile-header-h,0px)] lg:top-[-1.5rem]",
  bg = "bg-canvas lg:bg-surface",
  fade = 18,
  pad = 44,
  /* Symmetric with `pad`, and numeric for the same reason: the two paddings
   * are one decision about how much air the bar sits in, and expressing one
   * as a utility class and the other as a style made them look unrelated.
   * 12 is exactly the `pt-3` this used to hardcode, so every existing caller
   * renders identically. */
  padTop = 12,
  z = 10,
}) {
  return (
    <div
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

/* -------------------------------------------------------- Section heading -- */

/**
 * The heading that opens one group inside a flat, un-boxed list: a small
 * icon, the label in caps, that group's count, then a hairline running out
 * to the right edge.
 *
 * The rule sits ON the heading's own line rather than under it. A hairline
 * *below* the label reads as one more row divider — easy to mistake for
 * another item in the list instead of a break between sections.
 *
 * Render one for every group, always, including when a filter has narrowed
 * the list to a single group. A list that silently drops its headings once
 * there's only one of them reads as broken rather than tidy.
 *
 * Pair with a `pl-6` list beneath: with no box or divider around the group
 * itself, that indent is the only thing that reads as "these belong to
 * that heading".
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
 * Hover-reveal is a CONSOLE pattern, not a universal one. At a desk, hiding
 * repeated row controls until the row is hovered stops a long list reading
 * as a wall of buttons. On the shop floor it is the wrong trade entirely:
 * those terminals are wall-mounted touch tablets operated in gloves, where
 * `:hover` never fires, and reaching a control via `focus-within` means
 * first tapping the row — which, on a row that is itself a button, fires
 * that row's action instead. A hidden control there is a missing one.
 *
 * So: `hover: none` always forces them visible, and floor screens should
 * additionally pass `always` rather than relying on that media query — a
 * floor row's actions are part of the row, not a reveal, and they should
 * not appear and disappear when the same screen is opened on a desktop to
 * check something.
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

/**
 * `pill` is for an input that sits in a row of chips — a weight range beside
 * the filters it narrows. It has to take the chips' shape and size or it reads
 * as a different class of control sitting in the wrong row.
 */
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
        // The ring belongs to the whole pill, not just the <input> inside it —
        // drawn here on focus-within, with the input's own ring switched off,
        // so a focused search field stays one unbroken shape.
        "focus-within:border-primary focus-within:shadow-[0_0_0_2px_var(--color-canvas),0_0_0_4px_var(--color-primary)]",
        "transition-colors duration-100",
        pill ? "rounded-full px-3" : "rounded-md px-2.5",
        className,
      )}
    >
      <Search size={14} className="text-icon-2 shrink-0" />
      {/* type="text", not "search" — Safari/Chrome each draw their own
          cancel glyph and field decoration on a search input, on top of the
          clear button below. One clear affordance, drawn by us. */}
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

/**
 * A hover label for a control whose meaning isn't self-evident from its
 * text alone — built, not the native `title` attribute, which every browser
 * delays and styles differently (and some skip on touch entirely). Keyboard
 * focus shows it too, so it isn't a mouse-only explanation.
 */
const TOOLTIP_GAP = 6; // trigger-to-bubble gap, in every direction
const TOOLTIP_MARGIN = 8; // never closer than this to the viewport edge

/**
 * Boundary-aware: `side` is a preference, not a promise. The bubble is
 * measured against the trigger's actual on-screen rect and the current
 * viewport after it mounts, then placed with `position: fixed` in real
 * viewport coordinates (portaled to `document.body`, so no ancestor's
 * `overflow`/stacking context gets a vote) — flipped to the opposite side
 * if the preferred one doesn't fit, and slid along the cross-axis to stay
 * fully on-screen either way. A trigger pinned in a screen corner (see
 * TasksScreen's back-to-top button) is exactly the case a fixed CSS
 * placement (centered on the trigger, no matter what's beside it) can't
 * handle — this can, because it actually knows where the edges are.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
  disabled = false,
  // Opt-in only: pins the bubble directly above the pointer instead of
  // centering it on the trigger's own box. The trigger-centered default is
  // right for the normal case (an icon or button, where the trigger IS
  // basically a point) but wrong for a trigger that's a long strip of a
  // bar — centering on a wide trigger puts the bubble wherever its
  // midpoint happens to be, which can be far from where the pointer
  // actually is. Every other call site leaves this off and is unaffected.
  followCursor = false,
}) {
  const [open, setOpen] = useState(false);
  // Where to actually draw the bubble, in viewport coordinates — null
  // until the first post-mount measurement resolves it, so nothing paints
  // at the wrong (0,0, pre-measurement) spot even for one frame.
  const [pos, setPos] = useState(null);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);
  const bubbleRef = useRef(null);
  // Last known pointer position, in viewport coordinates. A ref, not
  // state — it's read only at the moments we actually reposition (open,
  // and each subsequent move while open), so it doesn't need to trigger a
  // render just from being written.
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
      // Prefers directly above the pointer; drops below it only when
      // there's genuinely no room above, same "flip rather than clip"
      // rule the trigger-anchored path below uses.
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
  // Keeps the bubble pinned above the pointer as it moves across a wide
  // trigger, rather than freezing it wherever the pointer happened to
  // enter — only does anything once the bubble is already open, and only
  // in followCursor mode.
  const track = (e) => {
    if (!followCursor || typeof e.clientX !== "number") return;
    cursorRef.current = { x: e.clientX, y: e.clientY };
    if (open) reposition();
  };
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Runs after the (invisible, unmeasured) bubble is in the DOM but before
  // the browser paints, so the flip/clamp math is invisible to the user —
  // it never shows the wrong position first and then jumps.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    // Re-measures only on the signals that can actually move the trigger or
    // change the bubble's own size — not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, side, label]);

  /* Strip a native `title` off the child. `IconButton` sets one on every
   * instance — correct on its own, since a bare icon with no accessible or
   * hoverable name is useless — but wrapping one in a Tooltip then produced
   * TWO labels on hover: this bubble, and the browser's own box a second
   * later, usually with different words in it. Replacing the native tooltip
   * is the entire point of this component, so it takes the title away rather
   * than asking every call site to remember to. `aria-label` is untouched;
   * the accessible name never depended on `title`. */
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

/** Every floating part of a Dropdown is cut from one surface — hairline,
 *  6px radius, no fill of its own beyond the panel colour. Declared once so a
 *  pinned control and the option list can never drift apart. */
const PANEL = "rounded-md border border-line-strong bg-surface shadow-md";

/**
 * A filter that opens a menu instead of a row of pills — built, not the OS
 * widget. The native `<select>` renders whatever chrome the platform feels
 * like that week; this one is the same hairline-and-ring surface as every
 * other floating panel in the system, and it matches its trigger's height and
 * radius exactly, which no native control can promise across browsers.
 *
 * `on` marks the trigger as active (non-default) the same way FilterChip did.
 */
/* Trigger-to-menu gap. Popover's own constants are declared further down
 * with the primitive that introduced them; this one sits here so Dropdown
 * reads on its own. */
const DROPDOWN_GAP = 4;

export function Dropdown({
  value,
  onChange,
  options,
  icon: Icon,
  on = false,
  disabled,
  className,
  menuSide = "bottom",
  // A control that acts on the option list rather than being one of its
  // choices — an A–Z toggle, a quick filter. It gets its OWN floating panel,
  // stacked above or below the options with a gap between them: a thing that
  // does something to the list is not a row of the list, and a hairline
  // inside one shared panel was never enough to say so. `pinnedSide` picks
  // which end of the stack it sits at.
  pinned,
  pinnedSide = "top",
  /* Multi-select. `value` becomes an ARRAY of option values and `onChange`
   * is handed the next array; the menu stays open while you tick things,
   * because picking three locations should not be three trips through the
   * same control. An empty array means "no narrowing applied" — the caller
   * decides what that means for its list, and the trigger says so with
   * `placeholder`. */
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

  /* The menu is PORTALED and `position: fixed`, for exactly the reason
   * Popover is (read its comment). It used to position itself `absolute`
   * inside the trigger's own box, which works right up until the trigger
   * lives in a sticky toolbar — and in this app that toolbar is
   * `StickyFadeHeader`, whose whole job is to carry a `mask-image`. A mask
   * clips its subtree, so the menu was cut off at the header's padding edge
   * and faded out by the gradient: on the floor Inventory screen its three
   * filter menus showed one option and swallowed every click on the rest.
   * Same measure-flip-clamp as Popover, re-run on scroll and resize so a
   * menu hung off a sticky control stays attached while the page moves. */
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
      /* Hang from the trigger's left edge by default, but flip to its RIGHT
       * edge when the menu would otherwise run off the side — a control
       * parked at the right of a toolbar (a scope picker, say) opened a menu
       * that slid out past the content card and looked broken. Clamped to
       * the viewport either way. */
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

  /* One picked reads better as its own name than as "1 selected" — the
   * whole point of the trigger is to say what the list is showing. */
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
        // `menuSide` is a preference, not a promise — a dropdown near the
        // bottom of the viewport (a sort control under a long list, say)
        // flips upward rather than rendering off-screen. Everything the menu
        // is made of stacks in here, each part its own surface, so the gap
        // between them carries the separation.
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

          {/* `role="listbox"` is on the options alone. The pinned control is a
              button, not a choice, and it used to sit inside this element —
              announced to a screen reader as an option it could never be. */}
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
                  {/* A tick, not a checkbox. In a single-select menu the tint
                   *  alone says which one is live; with several on at once you
                   *  need a mark you can count down the column. */}
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
 * A small floating panel hung off a trigger, opened by a click and closed
 * three ways.
 *
 * The app had three separate pieces of floating-layer code and no primitive:
 * `Tooltip` portals and does boundary math but is hover-only and
 * `pointer-events-none`; `Dropdown` is dismissible and interactive but is a
 * listbox that positions itself with `absolute` inside its own trigger's box;
 * `Modal` takes over the screen. A legend, a filter panel, a "what does this
 * mean" card — anything you open deliberately, read or poke at, and dismiss —
 * had none of them. This is that gap, built from the halves that already
 * worked.
 *
 * **Portaled and `position: fixed`, not `absolute`** — this is the whole
 * reason it cannot be a few lines inside a screen. An absolutely positioned
 * panel is clipped by any ancestor that establishes a clip, and the obvious
 * place to want one is a sticky toolbar — which in this app is
 * `StickyFadeHeader`, an element whose entire job is to carry a `mask-image`.
 * A mask clips its subtree. A panel opened from a control in that toolbar and
 * positioned the easy way is cut off at the header's padding edge and faded
 * out by the very gradient that makes the header work.
 *
 * Placement is a preference, not a promise: measured against the trigger's
 * real on-screen rect and the live viewport after mount, flipped to the
 * opposite side when the preferred one does not fit, and slid along the cross
 * axis to stay on screen. It re-measures on scroll and resize, so a panel
 * hung off a sticky control stays attached to it while the page moves.
 *
 * Dismissal is deliberately over-served, because a floating thing you cannot
 * get rid of is worse than no floating thing: Escape, a pointer-down anywhere
 * outside, and clicking the trigger again (which is the caller's own toggle —
 * the outside-press listener ignores presses inside this wrapper, so the two
 * never fight and produce a close-then-reopen flicker). Presses inside the
 * panel do nothing at all, so its own content stays usable.
 *
 * Controlled on purpose. The caller already owns the open state to drive its
 * trigger's pressed styling and `aria-expanded`; handing that to the panel
 * would mean two sources of truth for one boolean.
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
    // `true` on scroll: the capture phase catches scrolling in any container,
    // not just the window — the console's content pane is its own scroller.
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
              // Hidden, not unmounted, until the first measurement lands —
              // it has to be in the DOM to have a size to measure, and it
              // must never paint at (0,0) first and then jump.
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

/* ------------------------------------------------------------ ScrollRail -- */

/**
 * A horizontal row that only becomes a scroller when it has to.
 *
 * With room to spare it renders as a plain row: no scroll container, no
 * fade, nothing that can clip a child. Once the content genuinely outgrows
 * its space the rail arms itself — overflow scrolling, an edge fade on
 * whichever side still has something to reveal, and a tapped child gliding
 * into frame — and disarms again when the space comes back.
 *
 * `clipRoom` reserves px at the top and right for decorations that poke
 * outside a child's own box, a corner badge being the usual one. It is not
 * optional dressing: overflow-x can't be set without dragging overflow-y
 * out of `visible` too, so an armed rail always clips vertically, and the
 * reserved room is the only thing keeping that badge whole. The cancelling
 * negative margin means reserving it costs no layout.
 */
export function ScrollRail({
  as: Tag = "div",
  className,
  style,
  onScroll,
  onClick,
  /** px reserved top/right so a child's overflowing decoration isn't clipped. */
  clipRoom = 0,
  /** Fade the edge that still has content behind it. */
  fade = true,
  /** Width of that fade. */
  band = 40,
  /** Glide a tapped child toward the middle, when the rail scrolls at all. */
  centerOnClick = false,
  children,
  ...rest
}) {
  const railRef = useRef(null);
  const [edges, setEdges] = useState({
    overflowing: false,
    atStart: true,
    atEnd: true,
  });

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    /* The chips' own extent, NOT `scrollWidth`.
     *
     * `scrollWidth` counts a corner badge's overhang: TabDot is pinned at
     * `-right-1.5`, so it hangs 6px past the last chip and reads as 6px of
     * content the rail does not have. That is enough to arm a rail whose
     * chips fit — and arming is what reserves `clipRoom`, which absorbs the
     * overhang and makes the next reading say "fits". Arm, fit, arm, fit:
     * the two states disagree about the same rail, so which one it lands in
     * comes down to which measurement happened last. Landing armed is the
     * bad one, and it is stable: `overflow-x: auto` with scrollWidth equal
     * to clientWidth is a fade painted across a last tab that fits, with
     * zero scroll range to move it out from under.
     *
     * A child's own `offsetLeft + offsetWidth` is its border box, and an
     * absolutely-positioned badge is not in it, so this reads the same
     * whether the rail is armed or not — no reservation to subtract, and
     * nothing for the two states to disagree about. */
    let last = el.lastElementChild;
    // The trailing spacer is reserved room, not a chip — walk past it, or it
    // adds its own width to the content and re-arms a rail that fits.
    while (last && last.hasAttribute("data-rail-spacer"))
      last = last.previousElementSibling;
    const contentWidth = last
      ? last.offsetLeft + last.offsetWidth
      : el.scrollWidth - (parseFloat(getComputedStyle(el).paddingRight) || 0);
    const overflowing = contentWidth > el.clientWidth + 1;

    /* The ENDS are a different question from whether to arm, and have to be
     * measured against a different number.
     *
     * Arming asks "is there more chip than box", which is why it ignores the
     * badge and the reserved room above. But "have we reached the end" is
     * only ever about how far the thing can actually scroll — and that range
     * includes the reservation, because the reservation is what the trailing
     * badge lives in. Measuring the ends against the chip extent instead
     * declares the rail finished `clipRoom` px early: the fade lifts, the
     * rail looks arrived, and the last badge is still sitting outside the
     * box with nothing to say it can be scrolled into view. */
    const maxScroll = el.scrollWidth - el.clientWidth;
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft >= maxScroll - 1;
    // Bail on an unchanged reading: arming changes the rail's own padding,
    // which trips the observer again, and a fresh object every time would
    // re-render on each lap of that loop for nothing.
    setEdges((prev) =>
      prev.overflowing === overflowing &&
      prev.atStart === atStart &&
      prev.atEnd === atEnd
        ? prev
        : { overflowing, atStart, atEnd },
    );
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    measure();
    // The rail is clamped by its container, so its own box stops growing the
    // moment the content overflows. Watching the children too is what
    // catches a relabelled chip or a late-loading font.
    /* One more reading after the first paint has actually landed. The
     * observers below catch every LATER change, but the very first measure
     * runs against a layout that is still settling — web fonts, a sidebar
     * finishing its transition — and a rail that armed on that reading can
     * sit armed with nothing left to fire an observer, fading a trailing
     * badge that fits perfectly well. Cheap, once, and self-cancelling. */
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    const watch = () => {
      ro.disconnect();
      ro.observe(el);
      /* The parent, which is the only one of the three that can report a
       * change in the space AVAILABLE — and without it the rail latches.
       *
       * A ResizeObserver reports the box an element lays out into, and the
       * rail's barely moves: it is an inline-flex sized to its own content
       * and merely clamped by `max-w-full`, so it reads its container's
       * width through `clientWidth` while its observed box stays at the
       * chips' intrinsic width. The children never move either, being
       * `shrink-0`. So neither observation fires when the container alone
       * changes, and `window.resize` was left as the only signal.
       *
       * Rotating the tablet therefore re-measured, but nothing else did —
       * and the failure that leaves is not a rail that fails to arm, it is
       * one that arms on a first reading taken before the layout has
       * settled (a late font, badge counts arriving with hydration) and
       * then has nothing left to fire an observer, exactly the latch the
       * `raf` above is meant to break and cannot always reach. A latched
       * rail is scrollWidth === clientWidth with `overflow-x: auto` on: a
       * fade painted over a last tab that fits perfectly well, and zero
       * scroll range to move it out from under.
       *
       * The parent is a block box that fills its container, so its box does
       * change, and one observation covers every case the window event
       * misses. Loop-safe: arming puts padding on the wrapper, which fires
       * this observer once more, and that pass re-reads the rail, gets the
       * same answer, and is dropped by the bail-out in `measure`. */
      if (el.parentElement) ro.observe(el.parentElement);
      for (const child of el.children) ro.observe(child);
    };
    watch();
    const mo = new MutationObserver(() => {
      watch();
      measure();
    });
    mo.observe(el, { childList: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const armed = edges.overflowing;
  const fadeLeft = fade && armed && !edges.atStart;
  const fadeRight = fade && armed && !edges.atEnd;

  /* Vertical only — the horizontal half of this reservation could never
   * work, and that asymmetry is why the trailing badge kept getting sliced.
   *
   * Padding plus a cancelling negative margin grows a box without costing
   * layout, and for HEIGHT that holds: a block grows upward when asked.
   * Width does not behave the same way. The wrapper below is a block with
   * auto width, and auto width IS its container's content box — `max-width`
   * can only constrain that, never expand it. So the wrapper never took the
   * extra px, its mask went on clipping at the original edge, and the last
   * chip's badge (6px outside its chip, plus a 2px ring) was cut in half at
   * the end of the scroll. Raising `clipRoom` did nothing, because the box
   * it widened was not the box doing the clipping.
   *
   * The horizontal room is a real spacer child instead. Content sits inside
   * `scrollWidth` and inside every clipping box on the way up, so the
   * overhanging badge simply lands on top of it. */
  const room = armed ? { paddingTop: clipRoom, marginTop: -clipRoom } : null;

  const center = (e) => {
    const el = railRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    // Whatever was tapped, scroll the direct child holding it.
    let item = e.target;
    while (item && item.parentElement !== el) item = item.parentElement;
    if (!item) return;
    const railBox = el.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    const left = itemBox.left - railBox.left - el.clientLeft + el.scrollLeft;
    // scrollTo, not scrollIntoView: the latter walks every scrollable
    // ancestor and takes the page with it. Out-of-range targets clamp, so an
    // item near either end that can't reach the middle still lands in frame.
    el.scrollTo({
      left: left + itemBox.width / 2 - el.clientWidth / 2,
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
        // max-w-full is not optional: without it the rail grows past its
        // container instead of being clamped by it, and nothing ever reads
        // as overflowing in the first place.
        "inline-flex max-w-full",
        armed && "overflow-x-auto no-scrollbar",
        className,
      )}
      style={{ ...room, ...style }}
    >
      {children}
      {armed && clipRoom > 0 && (
        <span
          data-rail-spacer=""
          aria-hidden="true"
          style={{ flex: `0 0 ${clipRoom}px` }}
        />
      )}
    </Tag>
  );

  if (!fade) return rail;

  /* The right band ends at the edge now, not short of it. It used to stop
   * `clipRoom` px early because those px were trailing PADDING — an empty
   * strip with nothing in it to fade. The reserved room is a spacer at the
   * end of the content instead, and it is only ever on screen when the rail
   * is scrolled fully right, where there is no right fade to draw at all. */
  const maskStops = [
    fadeLeft ? "transparent" : "black",
    fadeLeft ? `black ${band}px` : "black 0px",
    fadeRight ? `black calc(100% - ${band}px)` : "black 100%",
    fadeRight ? "transparent" : "black",
  ].join(", ");
  const mask = `linear-gradient(to right, ${maskStops})`;

  // A mask forces its element to clip to its own border box — masking paints
  // into an isolated layer sized to that box — so the wrapper would clip the
  // very badges the rail's reserved room just freed. Same reservation, same
  // cancelling margin, one level up, and the mask has room to spare.
  return (
    <div
      className="relative min-w-0"
      style={{
        ...room,
        ...(fadeLeft || fadeRight
          ? { WebkitMaskImage: mask, maskImage: mask }
          : null),
      }}
    >
      {rail}
    </div>
  );
}

/* ------------------------------------------------------------- Segmented -- */

/** A small notification dot for a tab: a count badge, not a status label —
 *  always the brand color, so it reads as "count" rather than a severity
 *  signal. Pinned to the tab's top-right corner. Zero renders nothing — an
 *  empty dot just adds noise. */
export function TabDot({ count, variant = "corner" }) {
  if (!count) return null;
  return (
    <span
      className={cx(
        "absolute inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full",
        "text-[10px] font-semibold leading-none tnum shrink-0 ring-2 ring-surface",
        "bg-primary text-white transition-[top,right] duration-300",
        // "corner" (default): pinned to the row's own top-right corner —
        // the in-screen tab-dot look, and also the collapsed nav rail /
        // mobile tab bar, where the row is icon-width and there's no
        // "inside the row" to tuck into.
        // "trailing": the expanded nav rail, where the row is wider than
        // the icon — vertically centered and tucked inside the row's own
        // trailing edge instead of pinned to its corner. Centered with a
        // calc'd `top` rather than inset-y-0/my-auto on purpose: an
        // auto-margin can't be transitioned, so collapsing the sidebar
        // (which flips this variant against "corner") would snap instead
        // of sliding. A plain top/right pair, matched in kind with
        // "corner"'s, is what lets `transition-[top,right]` actually
        // animate the move.
        variant === "trailing"
          ? "top-[calc((var(--ctl-h)-1rem)/2)] right-2"
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
  // Fixed, not var(--ctl-h) — the touch-target bump (28px -> 44px on a
  // coarse pointer) scales height alone, and these chips never grew the
  // padding/gap to match, so on a phone they went tall and squashed
  // instead of just bigger. Pinning both keeps the pill proportions.
  const pad = size === "sm" ? "text-xs px-2 h-7" : "text-sm px-2.5 h-7";

  /* An option may carry a `hint`: one line explaining what picking it does,
   * shown on hover. Meant for chips that are a MODE rather than a filter —
   * a filter's label says everything ("Out", "Under min"), but a mode like
   * Fill/Align changes how the rest of the screen should be read, and that
   * cannot fit in one word. Chips without a hint are untouched, so no
   * existing Segmented gains a tooltip it did not ask for. */
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
    <ScrollRail
      role="tablist"
      fade={fade}
      centerOnClick
      // Only a counted row has a badge hanging outside its chip to protect.
      clipRoom={options.some((o) => o.count != null) ? 14 : 0}
      className={cx("gap-1", className)}
    >
      {chips}
    </ScrollRail>
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

/**
 * A number, and — when `onClick` is given — the filter that number describes.
 * Making the tile the control means the count and the way to act on it are the
 * same target, rather than a stat you then have to go and reproduce by hand.
 */
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
  icon: Icon,
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

export function Skeleton({ className }) {
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
          // A column with a capped height: the header and footer hold their
          // ground and the body scrolls, so a long dialog never pushes its own
          // actions off the bottom of the screen. dvh rather than vh because
          // mobile browser chrome makes vh overshoot.
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
