"use client";

import React, { useMemo, useState } from "react";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cx, Tooltip } from "./ui";
import { useDoubleTapHotkey } from "../lib/useDoubleTapHotkey";

/**
 * The one app frame, shared by the floor Production tracker and the Company
 * console so the two can't drift apart. The Production version was the source
 * of truth for this layout:
 *
 *  - a rail on the canvas, no border, that collapses 240px → 48px;
 *  - collapsing animates width/margin (never unmount) on the title and every
 *    nav label, so the rail narrows in one motion at 300ms;
 *  - collapsed, the toggle centers on the same 24px axis as the nav icons;
 *  - the page content lives in a floating rounded/bordered surface card that
 *    owns its own scroll, with the phone header and tab bar unchanged.
 *
 * Everything app-specific comes in as props: nav items, the sidebar footer
 * user block, page actions/subtitle, and anything overlaid on the frame.
 */

/** Static class names so Tailwind can see every column count it may render. */
const TAB_COLS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
};

export default function AppShell({
  brand,
  nav,
  view,
  onNavigate,
  onSignOut,
  initials,
  userName,
  userBadge = null,
  userMeta = null,
  sidebarExtra = null,
  pageActions = null,
  pageSubtitle = null,
  overlay = null,
  children,
}) {
  const active = nav.find((n) => n.id === view) || nav[0];
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Double-tap "b" toggles the sidebar; double-tap a digit jumps to that nav
  // item. Both are the same gesture, so they're the same hook — see
  // useDoubleTapHotkey for the shared typing/repeat/modifier guard.
  const hotkeyBindings = useMemo(() => {
    const bindings = { b: () => setSidebarOpen((o) => !o) };
    nav.slice(0, 9).forEach((n, i) => {
      bindings[String(i + 1)] = () => onNavigate(n.id);
    });
    return bindings;
  }, [nav, onNavigate]);
  useDoubleTapHotkey(hotkeyBindings);

  return (
    <div className="min-h-screen lg:h-screen lg:flex lg:flex-col lg:overflow-hidden bg-canvas">
      <div className="lg:flex-1 lg:flex lg:overflow-hidden lg:min-h-0 lg:py-3 lg:pr-3">
        {/* Desktop sidebar. Collapsing shrinks the rail to icon width; the nav
            labels collapse their own width/margin over the same 300ms, so
            nothing unmounts or pops — it all narrows together. */}
        <div
          className={cx(
            // No overflow-hidden here: the inner <aside> animates its own
            // width in lockstep, so nothing overflows it at rest — clipping
            // this wrapper too was only cutting off the nav Tooltips, which
            // are meant to float outside the rail.
            "hidden lg:block lg:shrink-0",
            "transition-all duration-300",
            sidebarOpen ? "w-60" : "w-12"
          )}
        >
          <aside
            className={cx(
              "h-full flex flex-col bg-canvas transition-all duration-300",
              sidebarOpen ? "w-60" : "w-12"
            )}
          >
            {/* Header row: title left edge lines up with the nav icons'
                left edge (row px-2 + this ml-2 == nav's row px-2 + button
                px-2). justify-between then does the toggle's positioning for
                free — flush right while open, and naturally centered on the
                icon axis once collapsed, since the rail narrows to exactly
                the button's own width. Only the title's width/opacity
                animate; nothing needs an (unanimatable) auto-margin flip. */}
            <div className="flex items-center justify-between px-2 h-[var(--ctl-h)] mb-1">
              <p
                className={cx(
                  "overflow-hidden whitespace-nowrap text-sm font-medium text-ink transition-all duration-300",
                  sidebarOpen ? "ml-2 max-w-[160px] opacity-100" : "ml-0 max-w-0 opacity-0"
                )}
              >
                {brand}
              </p>
              <Tooltip label={sidebarOpen ? "Collapse sidebar (B B)" : "Expand sidebar (B B)"} side="right">
                <button
                  onClick={() => setSidebarOpen((o) => !o)}
                  aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                  className="w-8 h-[var(--ctl-h)] flex items-center justify-center rounded-md text-icon-2 hover:text-ink hover:bg-hover transition-colors shrink-0"
                >
                  {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                </button>
              </Tooltip>
            </div>

            {sidebarExtra && sidebarOpen && <div className="px-2 pb-2">{sidebarExtra}</div>}

            <nav className="flex-1 flex flex-col gap-0.5 overflow-visible px-2">
              {nav.map((n, i) => {
                const on = n.id === view;
                // Double-tap hotkey only exists for the first 9 items — the
                // tooltip names it the same way the toggle names B B, so
                // it's discoverable rather than tribal knowledge.
                const digit = i < 9 ? String(i + 1) : null;
                const tooltipLabel = digit ? `${n.label} (${digit} ${digit})` : n.label;
                const navButton = (
                  <button
                    onClick={() => onNavigate(n.id)}
                    aria-current={on ? "page" : undefined}
                    className={cx(
                      "w-full flex items-center px-2 h-[var(--ctl-h)] rounded-md text-sm font-medium",
                      "transition-colors duration-100",
                      // Selection is the same 5% tint as hover. Accent is not spent on navigation.
                      on ? "bg-hover text-ink font-medium" : "text-ink-2 hover:bg-hover hover:text-ink"
                    )}
                  >
                    <n.icon size={16} className="shrink-0" />
                    {/* Label collapses instead of unmounting: width and margin
                        animate to zero so the row shrinks to the icon rail. */}
                    <span
                      className={cx(
                        "overflow-hidden whitespace-nowrap transition-all duration-300",
                        sidebarOpen ? "ml-2 max-w-[160px] opacity-100" : "ml-0 max-w-0 opacity-0"
                      )}
                    >
                      {n.label}
                    </span>
                  </button>
                );
                // Always the same wrapper — toggling between Tooltip and a
                // bare Fragment here would change the subtree's element type
                // and force React to remount it, which skipped the label's
                // collapse transition entirely (it'd just snap to state).
                // `disabled` suppresses the tooltip instead, open or not.
                return (
                  <Tooltip key={n.id} label={tooltipLabel} side="right" className="w-full" disabled={sidebarOpen}>
                    {navButton}
                  </Tooltip>
                );
              })}
            </nav>

            <div className="px-2 pt-3">
              <div className="flex items-center py-2">
                {/* Avatar rides the same 24px axis as the nav icons, so the
                    collapsed rail reads as one column. */}
                <span className="w-8 flex items-center justify-center shrink-0">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ink text-white text-xs font-semibold">
                    {initials}
                  </span>
                </span>
                {/* Name block and sign-out collapse their own width the same
                    way the nav labels do — nothing unmounts. */}
                <div
                  className={cx(
                    "min-w-0 overflow-hidden transition-all duration-300",
                    sidebarOpen ? "flex-1 ml-2 opacity-100" : "flex-none w-0 ml-0 opacity-0"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-ink truncate leading-tight">{userName}</p>
                    {userBadge}
                  </div>
                  {userMeta}
                </div>
                <button
                  onClick={onSignOut}
                  aria-label="Sign out"
                  title="Sign out"
                  tabIndex={sidebarOpen ? 0 : -1}
                  className={cx(
                    "h-[var(--ctl-h)] flex items-center justify-center overflow-hidden rounded-md shrink-0",
                    "text-ink-3 hover:text-danger hover:bg-sunken transition-all duration-300",
                    sidebarOpen ? "w-[var(--ctl-h)] ml-2 opacity-100" : "w-0 ml-0 opacity-0"
                  )}
                >
                  <LogOut size={15} className="shrink-0" />
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-canvas/90 backdrop-blur-sm border-b border-line pt-safe">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-brand leading-none mb-1.5">{brand}</p>
              <h1 className="text-base font-medium text-ink leading-none truncate">
                {active.label}
              </h1>
            </div>
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-surface border border-line shrink-0"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ink text-white text-xs font-medium">
                {initials}
              </span>
              <LogOut size={13} className="text-ink-3" />
            </button>
          </div>
        </header>

        <main className="flex-1 lg:overflow-hidden">
          <div className="lg:h-full">
            <div
              className={cx(
                "mx-auto w-full max-w-5xl px-4 pt-5 pb-28 sm:px-6 lg:max-w-none lg:h-full lg:overflow-y-auto thin-scrollbar lg:px-6 lg:py-6",
                "lg:rounded-md lg:border lg:border-line lg:bg-surface lg:flex lg:flex-col"
              )}
            >
              {/* The page header carries the page's OWN actions and a one-line
                  subtitle, so a screen never has to stack them into its content
                  where they read as one more filter. Phones already get the view
                  name from the sticky bar, so only actions and subtitle show. */}
              <div className="mb-4">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="hidden lg:block text-[32px] font-bold text-ink leading-tight">
                    {active.label}
                  </h2>
                  <div className="flex items-center gap-2 ml-auto shrink-0">{pageActions}</div>
                </div>
                {pageSubtitle}
              </div>
              {children}
            </div>
          </div>
        </main>

        {overlay}

        {/* Mobile tab bar */}
        <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-line pb-safe">
          <div className={cx("grid", TAB_COLS[nav.length] || "grid-cols-4")}>
            {nav.map((n) => {
              const on = n.id === view;
              return (
                <button
                  key={n.id}
                  onClick={() => onNavigate(n.id)}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "flex flex-col items-center justify-center gap-1 min-h-14 px-1 py-2",
                    "text-xs font-medium transition-colors duration-100",
                    on ? "text-ink" : "text-ink-3"
                  )}
                >
                  <n.icon size={19} className="shrink-0" />
                  <span className="truncate max-w-full">{n.short}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
