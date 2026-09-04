"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, CircleHelp, MessageSquareText, Settings, Sparkles } from "lucide-react";

import { cx } from "../../components/ui";
import AppShell from "../../components/AppShell";
import { ROLE_LABEL } from "../lib/companyDomain";

/**
 * The console's "view as" — Dana signing in doesn't mean Dana is who cares
 * about today's task list or the smokehouse queue; a floor manager does.
 * Clicking the account block in the sidebar footer opens this instead of
 * making anyone remember a second password: pick a teammate, the session
 * (real, persisted — see useCompanySession) switches to them, same as if
 * they'd signed in themselves. A refresh keeps whoever you switched to,
 * exactly like actually signing in as them would.
 *
 * Pending invites (Jordan Reyes, "invited") aren't offered — there's no one
 * to "become" yet.
 */
function AccountSwitcherMenu({ users, locations, currentUser, onSwitch }) {
  const locationName = (id) => locations.find((l) => l.id === id)?.name;
  const scopeFor = (u) =>
    u.locationIds?.length === 1 ? locationName(u.locationIds[0]) : "All locations";

  return (
    <div className="w-64 bg-surface border border-line rounded-xl shadow-pop overflow-hidden animate-pop-in">
      <div className="px-3 py-2 border-b border-line">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-4">Switch account</p>
        <p className="mt-0.5 text-xs text-ink-3 truncate">See the console the way they do.</p>
      </div>

      <div className="p-1 max-h-72 overflow-y-auto">
        {users.filter((u) => u.status === "active").map((u) => {
          const active = u.id === currentUser.id;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSwitch(u)}
              className={cx(
                "w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-md transition-colors duration-100",
                active ? "bg-primary-soft" : "hover:bg-sunken"
              )}
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ink text-white text-[11px] font-semibold shrink-0">
                {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx("block text-sm font-medium truncate", active ? "text-primary-ink" : "text-ink")}>
                  {u.name}
                  {active && <span className="ml-1.5 text-[11px] font-normal">· current</span>}
                </span>
                <span className="block mt-0.5 text-[11px] leading-snug text-ink-3 truncate">
                  {ROLE_LABEL[u.role]} · {scopeFor(u)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-1 border-t border-line">
        <a
          href="/"
          className="w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-md text-sm font-medium text-ink-2 hover:bg-sunken hover:text-ink transition-colors duration-100"
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sunken text-icon-2 shrink-0">
            <ArrowLeft size={14} />
          </span>
          Switch to the shop floor terminal
        </a>
      </div>

      <p className="px-3 py-2 border-t border-line text-[11px] leading-snug text-ink-4">
        Demo mode — switches your signed-in account, no password needed.
      </p>
    </div>
  );
}

const BRAND_MENU_ITEM =
  "w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-md text-sm font-medium text-ink-2 hover:bg-sunken hover:text-ink transition-colors duration-100";
const BRAND_MENU_ICON = "flex items-center justify-center w-7 h-7 rounded-full bg-sunken text-icon-2 shrink-0";

/**
 * Hangs off the chevron next to the brand title in the sidebar header —
 * company-level PAGES to go to, as opposed to the account switcher above
 * (which is about WHO you are) or the nav rail (shop-floor-style working
 * screens reached via console `view` state).
 *
 * Settings, Feedback, and Plan all open as MODALS (Sept 2026) — the user
 * tried real Next.js routes first, then said "instead lets do modals for
 * both," and Plan was added as a third modal the same way. `onOpenSettings`/
 * `onOpenFeedback`/`onOpenPricing` are plain callbacks (see useBrandModals.js)
 * threaded down from whichever page mounted this — CompanyConsole.jsx or
 * the standalone Help page — each of which owns the modal-open state and
 * renders <BrandModals> alongside <ConsoleShell>. Each button click closes
 * this dropdown itself (the callback does both) before the modal opens.
 *
 * Help is the one exception — a real route (`/company/help`), not a modal,
 * since it's reference material worth deep-linking or leaving open in
 * another tab rather than a quick in-place action. Plain `Link`, same as
 * Settings/Feedback were when they were briefly routes too.
 */
function BrandMenu({ onOpenSettings, onOpenFeedback, onOpenPricing }) {
  return (
    <div className="w-56 bg-surface border border-line rounded-xl shadow-pop overflow-hidden animate-pop-in p-1">
      <button type="button" onClick={onOpenSettings} className={BRAND_MENU_ITEM}>
        <span className={BRAND_MENU_ICON}>
          <Settings size={14} />
        </span>
        Settings
      </button>
      <button type="button" onClick={onOpenFeedback} className={BRAND_MENU_ITEM}>
        <span className={BRAND_MENU_ICON}>
          <MessageSquareText size={14} />
        </span>
        Feedback
      </button>
      <button type="button" onClick={onOpenPricing} className={BRAND_MENU_ITEM}>
        <span className={BRAND_MENU_ICON}>
          <Sparkles size={14} />
        </span>
        Plan
      </button>
      <Link href="/company/help" className={BRAND_MENU_ITEM}>
        <span className={BRAND_MENU_ICON}>
          <CircleHelp size={14} />
        </span>
        Help
      </Link>
    </div>
  );
}

/**
 * Shared app frame for the console SPA (CompanyConsole.jsx) — the AppShell
 * wiring plus its two popovers (AccountSwitcherMenu, BrandMenu). Moved out
 * of CompanyConsole.jsx into its own file (Sept 2026) back when Settings
 * and Feedback were briefly their own standalone routes reusing this same
 * chrome; now that both are modals again (see BrandMenu above), only the
 * console mounts this — kept as its own file regardless, since splitting
 * the account/brand popovers out of CompanyConsole.jsx keeps that file
 * shorter either way.
 */
export default function ConsoleShell({
  company,
  currentUser,
  nav,
  view,
  onNavigate,
  onSignOut,
  bundle,
  userMenuOpen,
  onUserMenuOpenChange,
  onSwitchUser,
  brandMenuOpen,
  onBrandMenuOpenChange,
  onOpenSettings,
  onOpenFeedback,
  onOpenPricing,
  children,
}) {
  return (
    <AppShell
      brand={company.name}
      nav={nav}
      view={view}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      initials={currentUser.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
      userName={currentUser.name}
      userMeta={<p className="text-xs text-ink-3 truncate">{ROLE_LABEL[currentUser.role]}</p>}
      userMenuOpen={userMenuOpen}
      onUserMenuOpenChange={onUserMenuOpenChange}
      userMenu={
        <AccountSwitcherMenu
          users={bundle.users}
          locations={bundle.locations}
          currentUser={currentUser}
          onSwitch={onSwitchUser}
        />
      }
      brandMenuOpen={brandMenuOpen}
      onBrandMenuOpenChange={onBrandMenuOpenChange}
      brandMenu={<BrandMenu onOpenSettings={onOpenSettings} onOpenFeedback={onOpenFeedback} onOpenPricing={onOpenPricing} />}
    >
      {children}
    </AppShell>
  );
}
