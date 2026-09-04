"use client";

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cx, TabDot, Tooltip } from "./ui";
import { useDoubleTapHotkey } from "../lib/useDoubleTapHotkey";
import { TabletFrameContext } from "./TabletFrame";

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
  // Optional account switcher hook — only the console passes these. When
  // omitted the sidebar footer renders exactly as it always has (the floor
  // app doesn't pass them, so it's unaffected).
  userMenuOpen = false,
  onUserMenuOpenChange = null,
  userMenu = null,
  // Same opt-in shape as the account switcher above, for a menu hung off
  // the brand title instead of the footer — only the console passes these
  // (see CompanyConsole's BrandMenu). Omitted, the header renders exactly
  // as it always has: brand text, then the collapse toggle, nothing else.
  brandMenuOpen = false,
  onBrandMenuOpenChange = null,
  brandMenu = null,
  children,
}) {
  const active = nav.find((n) => n.id === view) || nav[0];
  // Opt-in `hidden: true` on a nav item keeps it addressable (still
  // findable above for `active`, so its own `label` becomes the page
  // title when `view` points at it) without giving it a sidebar row, a
  // mobile tab, or a hotkey digit — for a screen reachable only from
  // somewhere else (e.g. the console's Settings, opened from the account
  // popover). Neither app set this before, so this is purely additive:
  // no `n.hidden` means no behavior change from today.
  const visibleNav = useMemo(() => nav.filter((n) => !n.hidden), [nav]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Same outside-click/Escape pattern as the Dropdown in ui.jsx — closes the
  // account switcher popover without the caller having to wire that up itself.
  const userMenuRef = useRef(null);
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) onUserMenuOpenChange?.(false);
    };
    const onKey = (e) => e.key === "Escape" && onUserMenuOpenChange?.(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen, onUserMenuOpenChange]);

  // Same pattern again for the brand dropdown — two independent popovers,
  // each closing on its own outside click/Escape, never on each other's.
  const brandMenuRef = useRef(null);
  useEffect(() => {
    if (!brandMenuOpen) return;
    const onDown = (e) => {
      if (brandMenuRef.current && !brandMenuRef.current.contains(e.target)) onBrandMenuOpenChange?.(false);
    };
    const onKey = (e) => e.key === "Escape" && onBrandMenuOpenChange?.(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [brandMenuOpen, onBrandMenuOpenChange]);

  // Measured, not guessed — a page that wants a sticky element to clear the
  // mobile header (see TasksScreen's sticky toolbar) needs the header's real
  // rendered height, safe-area inset and all, not a hardcoded px value that
  // drifts out of sync the next time this header's content changes. Comes
  // back 0 once the header itself goes `lg:hidden`, so a consumer needs no
  // separate desktop override — `var(--app-mobile-header-h, 0px)` is already
  // 0 there.
  const mobileHeaderRef = useRef(null);
  const [mobileHeaderH, setMobileHeaderH] = useState(0);
  useEffect(() => {
    const el = mobileHeaderRef.current;
    if (!el) return;
    const update = () => setMobileHeaderH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Double-tap "b" toggles the sidebar; double-tap a digit jumps to that nav
  // item. Both are the same gesture, so they're the same hook — see
  // useDoubleTapHotkey for the shared typing/repeat/modifier guard.
  const hotkeyBindings = useMemo(() => {
    const bindings = { b: () => setSidebarOpen((o) => !o) };
    visibleNav.slice(0, 9).forEach((n, i) => {
      bindings[String(i + 1)] = () => onNavigate(n.id);
    });
    return bindings;
  }, [visibleNav, onNavigate]);
  useDoubleTapHotkey(hotkeyBindings);

  // Split once so a pinned item (Insights) renders after a divider at the
  // end of the rail instead of inline with the rest. `i` stays the item's
  // position in the original `nav` array so its hotkey digit — and the
  // tooltip that names it — still matches the binding built above.
  const renderNavItem = (n, i) => {
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
          "relative w-full flex items-center px-2 h-[var(--ctl-h)] rounded-md text-sm font-medium",
          "transition-colors duration-100",
          // Selection is the same 5% tint as hover. Accent is not spent on navigation.
          // --row-bg tracks that same state as a flat color (the 5% tint
          // pre-composited over canvas) so an icon like Insights' can give
          // its own knockout a background that never mismatches the row.
          on
            ? "bg-hover text-ink font-medium [--row-bg:#f4f4f3]"
            : "text-ink-2 hover:bg-hover hover:text-ink [--row-bg:var(--color-canvas)] hover:[--row-bg:#f4f4f3]"
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
        {/* "trailing" only works once the row is wider than the icon —
            the expanded rail has room for it at the row's own right edge.
            Collapsed, the row IS icon-width, so it falls back to
            "corner": pinned to the row's own top-right, hanging mostly
            outside it rather than centered on top of the icon. */}
        <TabDot count={n.count} variant={sidebarOpen ? "trailing" : "corner"} />
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
  };

  // `pinned: "bottom"` (Insights) breaks off into its own group after a
  // divider; everything else keeps its normal order.
  const mainNavItems = [];
  const bottomNavItems = [];
  visibleNav.forEach((n, i) => (n.pinned === "bottom" ? bottomNavItems : mainNavItems).push([n, i]));

  // Inside a TabletFrame the shell fills a fixed-size mock device instead of
  // the real browser viewport, so `min-h-screen`/`h-screen` (which measure
  // against the window, not this element's own container) would overflow
  // the frame's bezel. Swap to h-full there; CompanyConsole never renders
  // inside a TabletFrame so `framed` is always false for it.
  const framed = useContext(TabletFrameContext);

  return (
    <div
      className={cx(
        framed ? "h-full" : "min-h-screen lg:h-screen",
        "lg:flex lg:flex-col lg:overflow-hidden bg-canvas"
      )}
      style={{ "--app-mobile-header-h": `${mobileHeaderH}px` }}
    >
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
              {/* Relative anchor for the optional brand dropdown (Settings
                  and other real pages, on the console) — the chevron only
                  renders when a caller wires onBrandMenuOpenChange, and
                  only while the rail is open (collapsed, there's no room
                  for the brand text it sits beside either). */}
              <div ref={brandMenuRef} className="relative min-w-0">
                {onBrandMenuOpenChange ? (
                  // Text + chevron are one clickable target (not text next to
                  // a separate small chevron button) so clicking anywhere on
                  // the brand title opens the menu.
                  <button
                    type="button"
                    onClick={() => onBrandMenuOpenChange(!brandMenuOpen)}
                    aria-haspopup="true"
                    aria-expanded={brandMenuOpen}
                    aria-label={`${brand} menu`}
                    className="flex items-center min-w-0 rounded hover:bg-hover transition-colors"
                  >
                    <p
                      className={cx(
                        "overflow-hidden whitespace-nowrap text-sm font-medium text-ink transition-all duration-300",
                        sidebarOpen ? "ml-2 max-w-[160px] opacity-100" : "ml-0 max-w-0 opacity-0"
                      )}
                    >
                      {brand}
                    </p>
                    <ChevronDown
                      size={14}
                      className={cx(
                        "ml-0.5 mr-1 text-icon-3 shrink-0 transition-all duration-300",
                        brandMenuOpen && "rotate-180",
                        sidebarOpen ? "ml-2 max-w-[160px] opacity-100" : "ml-0 max-w-0 opacity-0"
                      )}
                    />
                  </button>
                ) : (
                  <p
                    className={cx(
                      "overflow-hidden whitespace-nowrap text-sm font-medium text-ink transition-all duration-300",
                      sidebarOpen ? "ml-2 max-w-[160px] opacity-100" : "ml-0 max-w-0 opacity-0"
                    )}
                  >
                    {brand}
                  </p>
                )}
                {brandMenuOpen && brandMenu && (
                  <div className="absolute left-0 top-full mt-1 z-40">{brandMenu}</div>
                )}
              </div>
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
              {/* Optional `group` on a nav item clusters it with its
                  neighbors of the same group under one quiet section label.
                  Expanded: a small uppercase caption above the cluster —
                  collapsed: the caption has nothing to sit next to, so it
                  shrinks away and a hairline divider stands in for it
                  instead, same treatment as the bottom-pinned divider below.
                  Both the divider and the label are always in the tree;
                  only their classes change with sidebarOpen, so nothing
                  swaps element type or remounts mid-transition. */}
              {mainNavItems.map(([n, i], idx) => {
                const prevGroup = idx > 0 ? mainNavItems[idx - 1][0].group : undefined;
                const isNewGroup = idx > 0 && n.group !== prevGroup;
                return (
                  <React.Fragment key={n.id}>
                    {isNewGroup && (
                      <div className="shrink-0 mt-2">
                        <div
                          className={cx(
                            "border-t transition-colors duration-300 my-1",
                            sidebarOpen ? "border-transparent" : "border-line"
                          )}
                        />
                        {n.group && (
                          <p
                            className={cx(
                              "px-2 text-[10px] font-semibold uppercase tracking-wide text-ink-3",
                              "overflow-hidden whitespace-nowrap transition-all duration-300",
                              sidebarOpen ? "max-h-6 opacity-100 mb-1" : "max-h-0 opacity-0 mb-0"
                            )}
                          >
                            {n.group}
                          </p>
                        )}
                      </div>
                    )}
                    {renderNavItem(n, i)}
                  </React.Fragment>
                );
              })}
              {/* A hairline, not a labeled section — Insights is still a nav
                  item, just one the user asked kept visually apart from the
                  rest of the tabs. */}
              {bottomNavItems.length > 0 && <div className="my-1 shrink-0 border-t border-line" />}
              {bottomNavItems.map(([n, i]) => renderNavItem(n, i))}
            </nav>

            <div className="px-2 pt-3">
              <div ref={userMenuRef} className="relative">
                {userMenuOpen && userMenu && (
                  <div className="absolute left-0 right-0 bottom-full mb-2 z-40">{userMenu}</div>
                )}
                <div className="flex items-center py-2">
                  {/* Avatar rides the same 24px axis as the nav icons, so the
                      collapsed rail reads as one column. Clickable to open
                      the account switcher when the caller wired one up
                      (console only — the floor app doesn't pass onUserMenuOpenChange,
                      so this stays a plain, inert block there). */}
                  {onUserMenuOpenChange ? (
                    <button
                      type="button"
                      onClick={() => onUserMenuOpenChange(!userMenuOpen)}
                      aria-haspopup="true"
                      aria-expanded={userMenuOpen}
                      aria-label={`Switch account — currently ${userName}`}
                      className="flex-1 min-w-0 flex items-center rounded-md hover:bg-hover transition-colors duration-100"
                    >
                      <span className="w-8 flex items-center justify-center shrink-0">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ink text-white text-xs font-semibold">
                          {initials}
                        </span>
                      </span>
                      <div
                        className={cx(
                          "min-w-0 overflow-hidden transition-all duration-300 text-left",
                          sidebarOpen ? "flex-1 ml-2 opacity-100" : "flex-none w-0 ml-0 opacity-0"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-ink truncate leading-tight">{userName}</p>
                          {userBadge}
                        </div>
                        {userMeta}
                      </div>
                    </button>
                  ) : (
                    <div className="flex-1 min-w-0 flex items-center">
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
                    </div>
                  )}
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
            </div>
          </aside>
        </div>

        {/* Mobile top bar */}
        <header
          ref={mobileHeaderRef}
          className="lg:hidden sticky top-0 z-30 bg-canvas/90 backdrop-blur-sm border-b border-line pt-safe"
        >
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
              // Named so a page (see TasksScreen's "back to top" control) can
              // find and scroll *this* element specifically — on mobile the
              // page itself scrolls instead, so callers should still fall
              // back to `window` when this doesn't move.
              data-app-scroll
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
          <div className={cx("grid", TAB_COLS[visibleNav.length] || "grid-cols-4")}>
            {visibleNav.map((n) => {
              const on = n.id === view;
              return (
                <button
                  key={n.id}
                  onClick={() => onNavigate(n.id)}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "relative flex flex-col items-center justify-center gap-1 min-h-14 px-1 py-2",
                    "text-xs font-medium transition-colors duration-100",
                    on ? "text-ink" : "text-ink-3"
                  )}
                >
                  <n.icon size={19} className="shrink-0" />
                  <span className="truncate max-w-full">{n.short}</span>
                  {/* Compact icon-first cell, same as the collapsed
                      rail — "corner" (pinned to the cell's own top-right)
                      reads right where "trailing" would float off toward
                      the cell's far edge, away from the centered icon. */}
                  <TabDot count={n.count} variant="corner" />
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
