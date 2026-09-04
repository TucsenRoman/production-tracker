"use client";

import {
  Blocks,
  Building2,
  ChartColumnIncreasing,
  ListTodo,
  Package,
  Route,
  ShieldCheck,
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
export const NAV = [
  { id: "insights", label: "Insights", short: "Insights", icon: InsightsIcon },
  { id: "production", label: "Targets", short: "Targets", icon: ChartColumnIncreasing, managerOnly: true, group: "Operations" },
  { id: "tasks", label: "Assignments", short: "Assignments", icon: ListTodo, managerOnly: true, group: "Operations" },
  { id: "inventory", label: "Inventory", short: "Inventory", icon: Package, managerOnly: true, group: "Operations" },
  { id: "team", label: "Team", short: "Team", icon: UsersRound, adminOnly: true, group: "People" },
  { id: "permissions", label: "Permissions", short: "Permissions", icon: ShieldCheck, adminOnly: true, group: "People" },
  { id: "locations", label: "Locations", short: "Locations", icon: Building2, adminOnly: true, group: "Setup" },
  { id: "stations", label: "Stations", short: "Stations", icon: Blocks, adminOnly: true, group: "Setup" },
  { id: "integrations", label: "Integrations", short: "Integrations", icon: Route, adminOnly: true, group: "Setup" },
];

/** Same role filter CompanyConsole.jsx applies to NAV, factored out so the standalone Help page computes an identical rail rather than re-deriving it. */
export function navFor({ isAdmin, isManagerTier }) {
  return NAV.filter((n) => (isAdmin || !n.adminOnly) && (isManagerTier || !n.managerOnly));
}

