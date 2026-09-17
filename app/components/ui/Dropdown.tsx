"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cx } from "./cx";
import { PANEL, POPOVER_MARGIN } from "./floating";
import type { IconComponent } from "./types";

const DROPDOWN_GAP = 4; // trigger-to-menu gap

export interface DropdownOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: IconComponent;
}

interface DropdownBase<T extends string> {
  options: readonly DropdownOption<T>[];
  icon?: IconComponent;
  /** Marks the trigger as active (non-default). */
  on?: boolean;
  disabled?: boolean;
  className?: string;
  menuSide?: "top" | "bottom";
  /** A control that acts on the option list rather than being a choice (an
   *  A–Z toggle, a quick filter). It gets its own panel, stacked above or
   *  below the options; `pinnedSide` picks which end. */
  pinned?: ReactNode;
  pinnedSide?: "top" | "bottom";
  /** Trigger text when a multi-select has nothing picked (e.g. "All locations"). */
  placeholder?: string;
  /** Trigger text for 2+ picks. Defaults to "N selected". */
  summary?: (count: number) => string;
  /** Widen (or otherwise adjust) the menu when the options carry a figure as
   *  well as a name and the default cap would truncate the figure. */
  /** Drop the pill: renders as text with a chevron, for a scope control that
   *  sits in a subtitle rather than a toolbar. */
  quiet?: boolean;
  menuClassName?: string;
  "aria-label"?: string;
}

export interface DropdownSingleProps<T extends string = string>
  extends DropdownBase<T> {
  multiple?: false;
  value: T;
  onChange: (value: T) => void;
}

/** `value` is an array and `onChange` gets the next array. The menu stays open
 *  while ticking. An empty array means "no narrowing". */
export interface DropdownMultipleProps<T extends string = string>
  extends DropdownBase<T> {
  multiple: true;
  value: readonly T[];
  onChange: (value: T[]) => void;
}

export type DropdownProps<T extends string = string> =
  | DropdownSingleProps<T>
  | DropdownMultipleProps<T>;

interface MenuPos {
  top: number;
  left: number;
  minWidth: number;
}

/**
 * A filter that opens a menu — built, not the native `<select>`, so it shares
 * the system's panel surface and matches its trigger's height and radius.
 */
export function Dropdown<T extends string = string>(props: DropdownProps<T>) {
  const {
    options,
    icon: Icon,
    on = false,
    disabled,
    className,
    menuSide = "bottom",
    pinned,
    pinnedSide = "top",
    placeholder,
    summary,
    menuClassName,
    quiet = false,
    "aria-label": ariaLabel,
  } = props;

  const multiple = props.multiple === true;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPos | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const target = e.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      if (target && menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
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
        bottom:
          trigger.bottom + menu.height + DROPDOWN_GAP <=
          window.innerHeight - POPOVER_MARGIN,
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
      const wantsRight =
        trigger.left + menu.width > window.innerWidth - POPOVER_MARGIN;
      const left = Math.min(
        Math.max(
          wantsRight ? trigger.right - menu.width : trigger.left,
          POPOVER_MARGIN,
        ),
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

  const selected: readonly T[] =
    props.multiple && Array.isArray(props.value) ? props.value : [];
  const singleValue = props.multiple ? undefined : props.value;
  const current = multiple
    ? undefined
    : options.find((o) => o.value === singleValue);

  // One pick reads as its own name, not "1 selected".
  const triggerLabel: ReactNode = multiple
    ? selected.length === 0
      ? (placeholder ?? "Any")
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ??
          placeholder ??
          "1 selected")
        : (summary?.(selected.length) ?? `${selected.length} selected`)
    : (current?.label ?? "");

  const isOn = on || (multiple && selected.length > 0);

  const pick = (v: T) => {
    if (!props.multiple) {
      props.onChange(v);
      setOpen(false);
      return;
    }
    props.onChange(
      selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v],
    );
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
          "inline-flex items-center transition-colors duration-100",
          "disabled:opacity-45 disabled:cursor-not-allowed",
          quiet
            ? // No pill and no fixed height: it reads as part of the sentence
              // it sits in, and only the chevron says it opens.
              "gap-1 max-w-[16rem] " + (isOn ? "text-ink" : "hover:text-ink")
            : "gap-1.5 px-2.5 h-[var(--ctl-h)] rounded-full border text-xs font-medium max-w-[11rem] " +
              (isOn
                ? "border-line-strong bg-hover text-ink"
                : "border-line bg-surface text-ink-2 hover:bg-hover"),
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

      {open &&
        typeof document !== "undefined" &&
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
            className={cx("z-40 w-max max-w-[16rem] flex flex-col gap-1", menuClassName)}
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
                const active = multiple
                  ? selected.includes(o.value)
                  : o.value === singleValue;
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
                        className={cx(
                          "ml-auto shrink-0",
                          active ? "text-ink-2" : "opacity-0",
                        )}
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
