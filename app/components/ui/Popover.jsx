"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { PANEL, POPOVER_GAP, POPOVER_MARGIN } from "./floating";

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
