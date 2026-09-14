"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";

const TOOLTIP_GAP = 6; // trigger-to-bubble gap, in every direction
const TOOLTIP_DELAY = 700; // hover dwell before the bubble shows, in ms
const TOOLTIP_MARGIN = 8; // never closer than this to the viewport edge

export type TooltipSide = "top" | "bottom" | "left" | "right";

interface Point {
  top: number;
  left: number;
}

const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

export interface TooltipProps {
  label: ReactNode;
  children?: ReactNode;
  /** A preference, not a promise — see below. */
  side?: TooltipSide;
  className?: string;
  disabled?: boolean;
  /** Pin the bubble above the pointer instead of the trigger's centre. For a
   *  trigger that is a long strip, the centre can be far from the pointer. */
  followCursor?: boolean;
  /** Hover dwell before the bubble appears, in ms. */
  delay?: number;
}

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
  followCursor = false,
  // Long enough that passing the pointer across a toolbar does not trail
  // labels behind it.
  delay = TOOLTIP_DELAY,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  // Viewport coordinates; null until measured, so nothing paints at (0,0).
  const [pos, setPos] = useState<Point | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  // Last known pointer position. A ref: only read when repositioning.
  const cursorRef = useRef({ x: 0, y: 0 });

  const reposition = () => {
    const bubble = bubbleRef.current?.getBoundingClientRect();
    if (!bubble) return;

    const clamp = (value: number, size: number, max: number) =>
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

    const fits = (s: TooltipSide) => {
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
    const placed = fits(side)
      ? side
      : fits(OPPOSITE[side])
        ? OPPOSITE[side]
        : side;

    let top: number;
    let left: number;
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

  const show = (e?: ReactMouseEvent | ReactFocusEvent) => {
    if (disabled) return;
    if (followCursor && e && "clientX" in e) {
      cursorRef.current = { x: e.clientX, y: e.clientY };
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timerRef.current);
    setOpen(false);
    setPos(null);
  };
  // followCursor only: keep the bubble above the pointer as it moves.
  const track = (e: ReactMouseEvent) => {
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
    React.isValidElement<{ title?: string | null }>(children) &&
    children.props?.title !== null
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
