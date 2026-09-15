"use client";

import {
  Blocks,
  ChartBar,
  ChartNoAxesCombined,
  ListTodo,
  Package,
  ShieldCheck,
  Store,
  UsersRound,
} from "lucide-react";

/**
 * The console's sidebar nav, shared with the Help page via `navFor` so both
 * render an identical rail. Settings/Feedback/Plan are modals, not `view`
 * state, so they're not here; Help is a route and adds its own `hidden`
 * entry locally.
 */
export const NAV = [
  /* Was `InsightsIcon`, the sparkle-magnifier. That icon is the assistant's
   * now (see ConsoleShell): the rail lists PLACES, and the assistant is a
   * mode you turn on from anywhere, not somewhere you go. Insights keeps its
   * top slot — it is the screen a manager opens daily, and filing it under
   * System with the setup screens would demote the wrong thing. */
  { id: "insights", label: "Insights", short: "Insights", icon: ChartNoAxesCombined },
  { id: "production", label: "Targets", short: "Targets", icon: ChartBar, managerOnly: true, group: "Operations" },
  { id: "tasks", label: "Assignments", short: "Assignments", icon: ListTodo, managerOnly: true, group: "Operations" },
  { id: "inventory", label: "Inventory", short: "Inventory", icon: Package, managerOnly: true, group: "Operations" },
  { id: "team", label: "Team", short: "Team", icon: UsersRound, adminOnly: true, group: "People" },
  { id: "permissions", label: "Permissions", short: "Permissions", icon: ShieldCheck, adminOnly: true, group: "People" },
  { id: "locations", label: "Locations", short: "Locations", icon: Store, adminOnly: true, group: "System" },
  { id: "stations", label: "Stations", short: "Stations", icon: Blocks, adminOnly: true, group: "System" },
];

/**
 * Role filter for NAV. The two flags are EXCLUSIVE, not a ladder: Operations
 * is a floor manager's daily work at their own location, which an admin has
 * none of; an admin runs the company. Anything both need (Insights) carries
 * neither flag.
 */
export function navFor({ isAdmin, isManager }) {
  return NAV.filter((n) => (isAdmin || !n.adminOnly) && (isManager || !n.managerOnly));
}

