"use client";

/**
 * Role switcher.
 *
 * This build is a demo, so the switcher is always available: showing the
 * permission-gated screens is the point, and making someone sign out and
 * re-enter a PIN to see the manager view is friction with no payoff.
 *
 * If this ever becomes a real deployment, put it behind
 * `process.env.NODE_ENV !== "production"` — a shop-floor tablet with a "become
 * owner" button would undo the whole PIN hierarchy it sits on top of.
 *
 * The role change is session-only either way: the stored staff record is
 * untouched, so a refresh returns the user to the role they actually hold.
 * Where the CHIP sits on screen is a different kind of state — that one
 * genuinely should survive a refresh, so it's the one thing here that goes
 * through `usePersistentState` instead.
 */

import React, { useEffect, useRef, useState } from "react";
import { ChevronUp, ShieldCheck } from "lucide-react";

import { ROLES, ROLE_BLURB, ROLE_LABEL } from "../lib/domain";
import { usePersistentState } from "../lib/store";
import { useDoubleTapHotkey } from "../lib/useDoubleTapHotkey";
import { cx } from "./ui";

/** Kept clear of the viewport edge so the chip is never flush against — or
 *  clipped by — the glass. */
const EDGE_MARGIN = 12;

export default function RoleSwitcher({ user, onChange }) {
  const [open, setOpen] = useState(false);
  // Whether the whole chip (button + popover) is on screen at all — separate
  // from `open`, which is just the popover. The hotkey hides/shows the chip
  // itself so it can be gotten out of the way entirely during a demo, not
  // just collapsed to its closed state.
  const [visible, setVisible] = useState(true);
  // null = the default corner (bottom-right, clear of the mobile tab bar).
  // Anything else is a `{ right, bottom }` pair — distance from those two
  // viewport edges, the same terms the default corner is already
  // positioned in (see the CSS below) — set once, on drop, so a session
  // that never drags it never touches localStorage at all.
  const [pos, setPos] = usePersistentState("roleSwitcherPos", null);
  // The in-flight position while actually dragging — kept out of `pos` (and
  // so out of localStorage) until the drop, both so a drag-in-progress never
  // spams writes and so a click that never crosses the move threshold never
  // touches storage either.
  const [live, setLive] = useState(null);

  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  // Sole purpose: tell the click handler that the pointerup it's about to
  // see was the end of a drag, not a tap — click fires right after
  // pointerup for the same interaction, so a flag set there and read+
  // cleared here is all synchronization this needs.
  const suppressClickRef = useRef(false);

  // A drop can leave the chip somewhere a later, narrower viewport doesn't
  // have room for (rotate a tablet, shrink a window). Re-clamp on resize
  // rather than let it hide off-screen with no way back but clearing
  // localStorage by hand.
  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? clampToViewport(p, wrapRef.current) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(pos)]);

  // Double-tap "*" hides or shows the chip itself — same shared gesture as
  // the sidebar's "b b" and the nav's digit-digit hotkeys (see
  // useDoubleTapHotkey), just not routed through AppShell since this panel
  // already owns its own state. Wider window than the 1000ms default: "*" is
  // a shifted key (Shift+8 on a standard layout), so the chord takes longer
  // to repeat than a bare "b" or digit does. Hiding also closes the popover,
  // so bringing the chip back never reopens it already expanded.
  useDoubleTapHotkey(
    {
      "*": () =>
        setVisible((v) => {
          if (v) setOpen(false);
          return !v;
        }),
    },
    { windowMs: 1400 }
  );

  if (!user || !visible) return null;

  // Highest first, so the ladder reads top-down the way the popover stacks.
  const roles = [...ROLES].reverse();

  const current = live || pos;

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    const rect = wrapRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originRight: window.innerWidth - rect.right,
      originBottom: window.innerHeight - rect.bottom,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    // A few px of slop before it counts as a drag — otherwise every plain
    // tap (a pointerdown and pointerup rarely land on the exact same pixel)
    // would read as a zero-distance drag and swallow the click.
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) setOpen(false); // don't drag the popover around with it
    d.moved = true;
    setLive(clampToViewport({ right: d.originRight - dx, bottom: d.originBottom - dy }, wrapRef.current));
  };

  const endDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(d.pointerId)) {
      e.currentTarget.releasePointerCapture(d.pointerId);
    }
    if (d.moved) {
      suppressClickRef.current = true;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setPos(clampToViewport({ right: d.originRight - dx, bottom: d.originBottom - dy }, wrapRef.current));
    }
    setLive(null);
  };

  const handleToggleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen((v) => !v);
  };

  return (
    <div
      ref={wrapRef}
      // Hover for a mouse, tap for a tablet, focus for a keyboard — the same
      // wrapper covers all three, and wrapping the popover keeps it open while
      // the pointer travels from the button up into it.
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      style={current ? { right: current.right, bottom: current.bottom } : undefined}
      className={cx(
        "fixed z-[55] flex flex-col items-end gap-2",
        // Falls back to its original corner until the first drag ever sets
        // an explicit position — `right`/`bottom` above take over from
        // there, same edges, so opening the popover still grows the panel
        // up and to the left instead of shifting the button itself.
        !current && "right-4 bottom-20 lg:right-5 lg:bottom-5"
      )}
    >
      {open && (
        <div className="w-56 bg-surface border border-line rounded-xl shadow-pop overflow-hidden animate-pop-in">
          <div className="px-3 py-2 border-b border-line">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-4">
              View as
            </p>
            <p className="mt-0.5 text-xs text-ink-3 truncate">{user.name}</p>
          </div>

          <div className="p-1">
            {roles.map((role) => {
              const active = user.role === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    onChange(role);
                    setOpen(false);
                  }}
                  className={cx(
                    "w-full text-left px-2.5 py-2 rounded-md transition-colors duration-100",
                    active ? "bg-primary-soft" : "hover:bg-sunken"
                  )}
                >
                  <span
                    className={cx(
                      "block text-sm font-medium",
                      active ? "text-primary-ink" : "text-ink"
                    )}
                  >
                    {ROLE_LABEL[role]}
                    {active && <span className="ml-1.5 text-[11px] font-normal">· current</span>}
                  </span>
                  <span className="block mt-0.5 text-[11px] leading-snug text-ink-3">
                    {ROLE_BLURB[role]}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="px-3 py-2 border-t border-line text-[11px] leading-snug text-ink-4">
            Session only — a refresh restores the real role.
          </p>
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        aria-label={`Development role switcher — currently ${ROLE_LABEL[user.role]}. Press * twice to hide. Drag to move.`}
        title="Press * twice to hide"
        onClick={handleToggleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cx(
          "flex items-center gap-1.5 pl-3 pr-2.5 h-10 rounded-full shadow-lg",
          "border border-line-strong bg-surface text-ink-2",
          "hover:bg-sunken transition-colors duration-100",
          // No text selection or browser touch-scroll fighting the drag —
          // needed on the element that owns the pointer capture, not the
          // wrapper.
          "touch-none select-none cursor-grab active:cursor-grabbing"
        )}
      >
        <ShieldCheck size={15} className="text-primary-ink shrink-0" />
        <span className="text-xs font-medium capitalize">{ROLE_LABEL[user.role]}</span>
        <ChevronUp
          size={13}
          className={cx("text-ink-4 transition-transform duration-150", open && "rotate-180")}
        />
      </button>
    </div>
  );
}

function clampToViewport({ right, bottom }, el) {
  if (typeof window === "undefined") return { right, bottom };
  const w = el?.offsetWidth || 160;
  const h = el?.offsetHeight || 40;
  const max = (viewport, size) => Math.max(EDGE_MARGIN, viewport - size - EDGE_MARGIN);
  return {
    right: Math.min(Math.max(right, EDGE_MARGIN), max(window.innerWidth, w)),
    bottom: Math.min(Math.max(bottom, EDGE_MARGIN), max(window.innerHeight, h)),
  };
}
