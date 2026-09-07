"use client";

import {
  Blocks,
  ChartBar,
  ListTodo,
  Package,
  ShieldCheck,
  Store,
  UsersRound,
} from "lucide-react";

import InsightsIcon from "../components/InsightsIcon";

/**
 * The console's sidebar nav (CompanyConsole.jsx), also reused by the
 * standalone Help page (app/company/help) for an identical rail — see
 * `navFor` below. One list, one place to add/rename/reorder/regroup a
 * screen; see AppShell.jsx's project-memory notes for the grouping/
 * hidden-item/icon history behind these entries.
 *
 * Settings, Feedback, and Plan are deliberately NOT in here — they're
 * modals (Sept 2026, opened from the chevron next to the brand title via
 * ConsoleShell's BrandMenu — see SettingsModal.jsx / FeedbackModal.jsx /
 * PricingModal.jsx), not console `view` state or routes, so they don't
 * belong in an array that only exists to drive `view` switching. Help IS
 * a route (`/company/help`) — unlike the other three, it's reference
 * material worth deep-linking/keeping open in another tab — so it carries
 * its own single `hidden` nav entry locally on that page, same trick
 * Settings/Feedback used back when they were briefly routes too.
 */
/* Integrations is deliberately NOT in here (Sept 2026). It was a screen that
 * rendered a card per location — the same list Locations already renders — so
 * it dissolved into the location's own detail page as a "Connections" section
 * (app/company/components/LocationConnections.jsx). A location's POS pairing
 * is something the location HAS, like its team, not a separate subject with
 * its own place in the rail. */
export const NAV = [
  { id: "insights", label: "Insights", short: "Insights", icon: InsightsIcon },
  { id: "production", label: "Targets", short: "Targets", icon: ChartBar, managerOnly: true, group: "Operations" },
  { id: "tasks", label: "Assignments", short: "Assignments", icon: ListTodo, managerOnly: true, group: "Operations" },
  { id: "inventory", label: "Inventory", short: "Inventory", icon: Package, managerOnly: true, group: "Operations" },
  { id: "team", label: "Team", short: "Team", icon: UsersRound, adminOnly: true, group: "People" },
  { id: "permissions", label: "Permissions", short: "Permissions", icon: ShieldCheck, adminOnly: true, group: "People" },
  { id: "locations", label: "Locations", short: "Locations", icon: Store, adminOnly: true, group: "System" },
  { id: "stations", label: "Stations", short: "Stations", icon: Blocks, adminOnly: true, group: "System" },
];

/**
 * Same role filter CompanyConsole.jsx applies to NAV, factored out so the
 * standalone Help page computes an identical rail rather than re-deriving it.
 *
 * The two flags are EXCLUSIVE, not a ladder (Sept 2026). `managerOnly` used
 * to mean "manager tier or above", so an admin saw the Operations group too —
 * but Operations is the floor manager's daily work (what to run, who does it,
 * what's on hand at THEIR location), and an admin has no location of their own
 * to answer those questions for. An admin runs the company: people, access,
 * locations, stations, and the Insights that read across all of them. So
 * `adminOnly` is admin-and-only-admin, `managerOnly` is manager-and-only-
 * manager, and anything both roles need (Insights) carries neither flag.
 */
export function navFor({ isAdmin, isManager }) {
  return NAV.filter((n) => (isAdmin || !n.adminOnly) && (isManager || !n.managerOnly));
}

