"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, CircleHelp, MessageSquareText, Settings, Sparkles } from "lucide-react";

import { SlotTarget, cx } from "../../components/ui";
import AppShell from "../../components/AppShell";
import { ROLE_LABEL } from "../lib/companyDomain";

/**
 * Demo "view as" menu: pick a teammate and the persisted session switches to
 * them (see useCompanySession), so a refresh keeps the switched user.
 * Pending invites aren't offered — there's no one to become yet.
 */
function AccountSwitcherMenu({ users, locations, currentUser, onSwitch, twoLocations, onToggleLocations }) {
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

      {/* Demo toggle: much of the console only shows its real shape with two
       *  locations, but the everyday demo is one shop, so the second location
       *  (and its two managers) is a switch rather than seed data. */}
      {onToggleLocations && (
        <div className="px-3 py-2.5 border-t border-line">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-4">Demo data</p>
          <div className="mt-1.5 flex items-center gap-1">
            {[
              { value: false, label: "One location" },
              { value: true, label: "Two" },
            ].map((o) => (
              <button
                key={String(o.value)}
                type="button"
                aria-pressed={twoLocations === o.value}
                onClick={() => onToggleLocations(o.value)}
                className={cx(
                  "px-2 h-7 rounded-md text-xs font-medium transition-colors duration-100",
                  twoLocations === o.value
                    ? "bg-hover text-ink"
                    : "text-ink-2 hover:bg-faint hover:text-ink"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
 * Brand-title dropdown: company-level pages, as opposed to the account
 * switcher (who you are) or the nav rail (working screens).
 *
 * Settings, Feedback and Plan open as modals; the callbacks come from
 * useBrandModals.js in whichever page mounted this, and each closes this
 * dropdown before opening the modal. Help is a real route because it's
 * reference material worth deep-linking or leaving open in another tab.
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

/** App frame for the console: AppShell wiring plus its two popovers. */
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
  twoLocations,
  onToggleLocations,
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
          twoLocations={twoLocations}
          onToggleLocations={onToggleLocations}
        />
      }
      brandMenuOpen={brandMenuOpen}
      onBrandMenuOpenChange={onBrandMenuOpenChange}
      brandMenu={<BrandMenu onOpenSettings={onOpenSettings} onOpenFeedback={onOpenFeedback} onOpenPricing={onOpenPricing} />}
      /* Same target and classes as the floor shell; `empty:hidden` so a
       * screen with no subtitle costs no space. */
      pageSubtitle={
        <SlotTarget
          name="page-subtitle"
          className="empty:hidden mt-1 text-sm text-ink-2 leading-normal"
        />
      }
    >
      {children}
    </AppShell>
  );
}
