"use client";

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import type { ReactNode } from "react";

import { cx, ScrollArea, SlotProvider, SlotTarget, TabDot, Tooltip } from "./ui";
import type { IconComponent } from "./ui";
import { useDoubleTapHotkey } from "../lib/useDoubleTapHotkey";
import type { HotkeyBindings } from "../lib/useDoubleTapHotkey";
import { TabletFrameContext } from "./TabletFrame";

/** One entry in the app's navigation, shared by the rail and the tab bar. */
export interface NavItem {
  id: string;
  label: string;
  /** Short form for the bottom tab bar, where the full label will not fit. */
  short?: string;
  icon: IconComponent;
  count?: number | null;
  /** Addressable but not rendered: still found for `active` (so its label
   *  becomes the page title) but no sidebar row, tab, or hotkey digit. */
  hidden?: boolean;
  /** Renders in its own group after a divider. */
  pinned?: "bottom";
  /** Clusters neighbouring items under a caption. */
  group?: string;
}

/** "rail" (the console) or "tabs" (the shop floor) — see the prop comment. */
export type AppChrome = "rail" | "tabs";

export interface AppShellProps {
  brand?: ReactNode;
  chrome?: AppChrome;
  nav: NavItem[];
  /** The active item's `id`. */
  view: string;
  onNavigate: (id: string) => void;
  onSignOut?: () => void;
  initials?: string;
  userName?: string;
  userBadge?: ReactNode;
  userMeta?: ReactNode;
  sidebarExtra?: ReactNode;
  pageActions?: ReactNode;
  pageSubtitle?: ReactNode;
  overlay?: ReactNode;
  /** The assistant panel's body. Omitted, no rail and no column render. */
  assistant?: ReactNode;
  assistantIcon?: IconComponent;
  assistantLabel?: string;
  assistantOpen?: boolean;
  onAssistantOpenChange?: ((open: boolean) => void) | null;
  userMenuOpen?: boolean;
  onUserMenuOpenChange?: ((open: boolean) => void) | null;
  userMenu?: ReactNode;
  brandMenuOpen?: boolean;
  onBrandMenuOpenChange?: ((open: boolean) => void) | null;
  brandMenu?: ReactNode;
  children?: ReactNode;
}

/**
 * The one app frame, shared by the floor tracker and the Company console.
 *
 *  - a rail on the canvas, no border, that collapses 240px → 48px;
 *  - collapsing animates width/margin (never unmount) on the title and every
 *    nav label, so the rail narrows in one 300ms motion;
 *  - collapsed, the toggle centers on the same 24px axis as the nav icons;
 *  - page content lives in a floating surface card that owns its own scroll.
 *
 * Everything app-specific comes in as props.
 */

/** Static class names so Tailwind can see every column count it may render. */
const TAB_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
};

export default function AppShell({
  brand,
  /**
   * Which chrome this app wears. "rail" (default, the console): collapsible
   * 240px sidebar, floating content card, 32px page title. "tabs" (the shop
   * floor): a bottom tab bar at every width, full-width content.
   *
   * A prop rather than a breakpoint because it is not a question of width:
   * a phone-sized console window still gets the rail, a landscape tablet
   * still gets tabs (the `lg` breakpoint falls between an iPad's two
   * orientations, and a held tablet's thumb can reach the bottom, not a rail).
   */
  chrome = "rail",
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
  // Optional right-hand assistant column (console only). Opt-in the same way
  // the two menus are: pass the body and own the open state.
  assistant = null,
  assistantIcon: AssistantIcon,
  assistantLabel = "Ask",
  assistantOpen = false,
  onAssistantOpenChange = null,
  // Optional account switcher (console only); omitted, the footer is inert.
  userMenuOpen = false,
  onUserMenuOpenChange = null,
  userMenu = null,
  // Same opt-in shape for a menu hung off the brand title (console only).
  brandMenuOpen = false,
  onBrandMenuOpenChange = null,
  brandMenu = null,
  children,
}: AppShellProps) {
  const active = nav.find((n) => n.id === view) || nav[0];
  // `hidden: true` keeps a nav item addressable (still found for `active`, so
  // its label becomes the page title) without a sidebar row, mobile tab, or
  // hotkey digit — for a screen reachable only from somewhere else.
  const visibleNav = useMemo(() => nav.filter((n) => !n.hidden), [nav]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Outside-click/Escape closes the account switcher popover.
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e: Event) => {
      const target = e.target as Node | null;
      if (userMenuRef.current && target && !userMenuRef.current.contains(target))
        onUserMenuOpenChange?.(false);
    };
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && onUserMenuOpenChange?.(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen, onUserMenuOpenChange]);

  // Same for the brand dropdown; the two popovers close independently.
  const brandMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!brandMenuOpen) return;
    const onDown = (e: Event) => {
      const target = e.target as Node | null;
      if (
        brandMenuRef.current &&
        target &&
        !brandMenuRef.current.contains(target)
      )
        onBrandMenuOpenChange?.(false);
    };
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && onBrandMenuOpenChange?.(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [brandMenuOpen, onBrandMenuOpenChange]);

  // Measured, not hardcoded: a sticky element clearing the mobile header
  // needs its real rendered height, safe-area inset included. Reads 0 once
  // the header goes `lg:hidden`, so `var(--app-mobile-header-h, 0px)` needs
  // no desktop override.
  const mobileHeaderRef = useRef<HTMLElement>(null);
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

  // Double-tap "0" toggles the sidebar; double-tap a digit jumps to that nav item.
  const hotkeyBindings = useMemo(() => {
    const bindings: HotkeyBindings = { 0: () => setSidebarOpen((o) => !o) };
    visibleNav.slice(0, 9).forEach((n, i) => {
      bindings[String(i + 1)] = () => onNavigate(n.id);
    });
    return bindings;
  }, [visibleNav, onNavigate]);
  useDoubleTapHotkey(hotkeyBindings);

  // `i` is the item's position in `visibleNav`, so the hotkey digit and the
  // tooltip that names it match the binding built above.
  const renderNavItem = (n: NavItem, i: number) => {
    const on = n.id === view;
    // Hotkeys exist only for the first 9 items; the tooltip names the digit.
    const digit = i < 9 ? String(i + 1) : null;
    const tooltipLabel = digit ? `${n.label} (${digit} ${digit})` : n.label;
    const navButton = (
      <button
        onClick={() => onNavigate(n.id)}
        aria-current={on ? "page" : undefined}
        className={cx(
          "relative w-full flex items-center px-2 h-[var(--ctl-h)] rounded-md text-sm font-medium",
          "transition-colors duration-100",
          // Selection is the same 5% tint as hover; accent is not spent on nav.
          // --row-bg is that tint pre-composited over canvas, so an icon's
          // knockout can match the row exactly.
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
        {/* "trailing" needs a row wider than the icon; collapsed, the row is
            icon-width, so the dot pins to the row's top-right corner. */}
        <TabDot count={n.count} variant={sidebarOpen ? "trailing" : "corner"} />
      </button>
    );
    // Always the same wrapper: swapping Tooltip for a Fragment would remount
    // the subtree and skip the label's collapse transition. `disabled`
    // suppresses the tooltip instead.
    return (
      <Tooltip key={n.id} label={tooltipLabel} side="right" className="w-full" disabled={sidebarOpen}>
        {navButton}
      </Tooltip>
    );
  };

  // `pinned: "bottom"` items render in their own group after a divider.
  const mainNavItems: [NavItem, number][] = [];
  const bottomNavItems: [NavItem, number][] = [];
  visibleNav.forEach((n, i) => (n.pinned === "bottom" ? bottomNavItems : mainNavItems).push([n, i]));

  // Inside a TabletFrame the shell fills a fixed-size mock device, so
  // `h-screen` (which measures the window) would overflow the bezel; use
  // h-full there.
  const framed = useContext(TabletFrameContext);

  /* In tabs mode the desktop branch does not exist at any width, so `lgOnly`
   * blanks the `lg:` classes at the source instead of overriding each one. */
  const tabs = chrome === "tabs";
  const lgOnly = (classes: string) => (tabs ? "" : classes);

  return (
    /* The Slot provider must sit above both the header (target) and
     * `children` (poster). */
    <SlotProvider>
    <div
      className={cx(
        /* Tabs mode owns its scroll rather than letting the page scroll: the
         * TabletFrame mock screen is a fixed-height `overflow: hidden` box,
         * so a page-scrolling layout inside it is clipped at the fold. */
        framed ? "h-full" : tabs ? "h-screen" : "min-h-screen lg:h-screen",
        tabs ? "flex flex-col overflow-hidden" : "lg:flex lg:flex-col lg:overflow-hidden",
        "bg-canvas"
      )}
      style={{ "--app-mobile-header-h": `${mobileHeaderH}px` }}
    >
      <div
        className={
          tabs
            ? "flex-1 flex flex-col min-h-0 overflow-hidden"
            : "lg:flex-1 lg:flex lg:overflow-hidden lg:min-h-0 lg:py-3 lg:pr-3"
        }
      >
        {/* Desktop sidebar. Absent entirely in tabs mode. */}
        {!tabs && (
        <div
          className={cx(
            // No overflow-hidden: the inner <aside> animates its own width in
            // lockstep, and clipping here would cut off the nav Tooltips.
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
            {/* Header row: title left edge lines up with the nav icons
                (row px-2 + ml-2 == nav row px-2 + button px-2).
                justify-between positions the toggle: flush right while open,
                centered on the icon axis once the rail narrows to the
                button's own width. No auto-margin flip needed. */}
            <div className="flex items-center justify-between px-2 h-[var(--ctl-h)] mb-1">
              {/* Relative anchor for the optional brand dropdown. */}
              <div ref={brandMenuRef} className="relative min-w-0">
                {onBrandMenuOpenChange ? (
                  // Text + chevron are one clickable target.
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
              <Tooltip label={sidebarOpen ? "Collapse sidebar (0 0)" : "Expand sidebar (0 0)"} side="right">
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
              {/* `group` clusters neighboring nav items under a caption when
                  expanded, a hairline divider when collapsed. Both stay in
                  the tree; only classes change, so nothing remounts
                  mid-transition. */}
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
              {/* A hairline, not a labeled section. */}
              {bottomNavItems.length > 0 && <div className="my-1 shrink-0 border-t border-line" />}
              {bottomNavItems.map(([n, i]) => renderNavItem(n, i))}
            </nav>

            {/* The footer is opt-in; a shared floor terminal has nobody to
                name, so it opts out. */}
            {userName && (
            <div className="px-2 pt-3">
              <div ref={userMenuRef} className="relative">
                {userMenuOpen && userMenu && (
                  <div className="absolute left-0 right-0 bottom-full mb-2 z-40">{userMenu}</div>
                )}
                <div className="flex items-center py-2">
                  {/* Avatar rides the same 24px axis as the nav icons, so the
                      collapsed rail reads as one column. Clickable only when
                      an account switcher is wired up. */}
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
                  {/* No session, no sign-out control: a button that looks live
                      and does nothing is worse than the space it saves. */}
                  {onSignOut && (
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
                  )}
                </div>
              </div>
            </div>
            )}
          </aside>
        </div>
        )}

        {/* Top bar: phone-width in rail mode, absent in tabs mode (the page
            H2 below names the screen there, scrolling with the content). */}
        {!tabs && (
        <header
          ref={mobileHeaderRef}
          className={cx(
            lgOnly("lg:hidden"),
            tabs && "shrink-0",
            "sticky top-0 z-30 bg-canvas/90 backdrop-blur-sm border-b border-line pt-safe"
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-brand leading-none">{brand}</p>
              <h1 className="mt-1.5 text-base font-medium text-ink leading-none truncate">
                {active.label}
              </h1>
            </div>
            {/* With a session the chip is a sign-out button; with a user but
                no session it is an identity badge. */}
            {userName && (
            <div
              className={cx(
                "flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-surface border border-line shrink-0",
                onSignOut && "cursor-pointer"
              )}
              onClick={onSignOut}
              role={onSignOut ? "button" : undefined}
              aria-label={onSignOut ? "Sign out" : undefined}
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ink text-white text-xs font-medium">
                {initials}
              </span>
              {onSignOut && <LogOut size={13} className="text-ink-3" />}
            </div>
            )}
          </div>
        </header>
        )}

        <main className={cx("flex-1", tabs ? "min-h-0 overflow-hidden" : lgOnly("lg:overflow-hidden"))}>
          <div className={tabs ? "h-full" : lgOnly("lg:h-full")}>
            <ScrollArea
              axis="y"
              // Tabs mode is always the scroll container; rail mode turns
              // overflow on only at `lg:` via the classes below, so ScrollArea
              // must not arm itself there.
              arm={tabs ? true : false}
              void
              // No mask: StickyFadeHeader already fades what scrolls behind
              // the toolbar, and a second one would darken the last row.
              fade={false}
              // Named so a page can scroll *this* element; on mobile the page
              // itself scrolls, so callers fall back to `window`.
              data-app-scroll
              className={cx(
                "mx-auto w-full px-4 pt-5 pb-28 sm:px-6",
                tabs && "h-full thin-scrollbar",
                /* Tabs mode runs edge to edge; rail mode keeps its
                   reading-width cap and floating card. */
                tabs ? "max-w-none" : "max-w-5xl",
                lgOnly(
                  "lg:max-w-none lg:h-full lg:overflow-y-auto thin-scrollbar lg:px-6 lg:py-6" +
                    " lg:rounded-md lg:border lg:border-line lg:bg-surface lg:flex lg:flex-col"
                )
              )}
            >
              {/* The page header carries the page's own actions and a one-line
                  subtitle, so a screen never has to stack them into its
                  content where they read as one more filter. */}
              <div className="mb-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Shown in tabs mode too, since nothing above names the screen. */}
                  <h2 className={cx(lgOnly("hidden lg:block"), "text-[32px] font-bold text-ink leading-tight")}>
                    {active.label}
                  </h2>
                  {/* Two ways in, on purpose: `pageActions` for a shell that
                      already knows the control, the slot for a screen that
                      owns the state behind it. */}
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    {pageActions}
                    <SlotTarget name="page-actions" className="flex items-center gap-2" />
                  </div>
                </div>
                {pageSubtitle}
              </div>
              {children}
            </ScrollArea>
          </div>
        </main>

        {/* The assistant column, and the rail that opens it.
          *
          * The rail is on the FAR right and the panel opens to its left, so
          * the button never moves: open or closed, it is the same pixel. A
          * toggle that slides out from under the cursor as you press it is
          * the small tax every "collapse into the panel header" design
          * charges, and it is paid on every single use.
          *
          * The panel UNMOUNTS when closed. That is safe — and it is the
          * reason the thread lives in AssistantProvider rather than in the
          * panel — and it beats keeping a `w-0` column mounted, which stays
          * in the tab order and steals focus while invisible.
          *
          * Tabs mode gets none of this: the floor tablet has no sidebar at
          * any width, so it has no room for a third column either. */}
        {!tabs && assistant && (
          <>
            <div
              className={cx(
                "hidden lg:flex lg:shrink-0 lg:h-full overflow-hidden transition-all duration-300",
                assistantOpen ? "w-[21rem] ml-3" : "w-0 ml-0"
              )}
              aria-hidden={!assistantOpen}
            >
              {/* Fixed inner width so the wrapper's width can animate without
                  reflowing the panel's own contents mid-transition. */}
              <aside
                aria-label={assistantLabel}
                className="w-[21rem] h-full rounded-md border border-line bg-surface overflow-hidden"
              >
                {assistantOpen && assistant}
              </aside>
            </div>

            <div className="hidden lg:flex lg:shrink-0 lg:flex-col items-center w-10 ml-1">
              <Tooltip label={assistantLabel} side="left">
                <button
                  type="button"
                  onClick={() => onAssistantOpenChange?.(!assistantOpen)}
                  aria-expanded={assistantOpen}
                  aria-label={assistantLabel}
                  className={cx(
                    "w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-100",
                    // Same --row-bg contract the nav rows use, so the icon's
                    // knockout patch matches whatever is actually behind it.
                    assistantOpen
                      ? "bg-hover text-ink [--row-bg:#f4f4f3]"
                      : "text-ink-2 hover:bg-hover hover:text-ink [--row-bg:var(--color-canvas)] hover:[--row-bg:#f4f4f3]"
                  )}
                >
                  {AssistantIcon ? <AssistantIcon size={18} /> : null}
                </button>
              </Tooltip>
            </div>
          </>
        )}

        {overlay}

        {/* The tab bar: phone-width only in rail mode, the whole navigation
            in tabs mode. */}
        <nav
          className={cx(
            lgOnly("lg:hidden"),
            "fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-line pb-safe"
          )}
        >
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
                  {/* The dot hangs off the icon, not the button: the button is
                      a full grid column (~300px on a 1194pt tablet), so a dot
                      pinned to its corner would sit nearer the next tab. */}
                  <span className="relative flex shrink-0">
                    <n.icon size={19} className="shrink-0" />
                    <TabDot count={n.count} variant="glyph" />
                  </span>
                  <span className="truncate max-w-full">{n.short}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
    </SlotProvider>
  );
}
