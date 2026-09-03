"use client";

/**
 * Enterprise/company domain model.
 *
 * This is the account layer that sits above a shop floor: a company owns one
 * or more locations, a roster of admin/manager users (distinct from the PIN-
 * based shop-floor staff), and the integrations each location connects to
 * its POS. Kept in its own module — separate from ../../lib/domain.js — so
 * the shop-floor terminal and the admin console can evolve independently.
 */

import { Boxes, ShoppingBag, Store } from "lucide-react";

/**
 * Two tiers, as of now — Admin (full company access) and Floor manager
 * (their own location's Production planning + Tasks; day-to-day floor
 * work). There used to be a separate "Owner" above Admin; it was dissolved
 * into Admin since nothing in this build actually needed a role only one
 * person could hold. If that's ever needed again — or a third custom tier,
 * or per-permission toggles instead of fixed tiers — this is the array to
 * extend; PermissionsScreen's GATED_ACTIONS is already action-scoped rather
 * than role-scoped, so it wouldn't need to change.
 *
 * Deliberately no "staff" tier here. That's what floor PINs are for:
 * floor-level people churn too fast for named email accounts to make sense,
 * so a station gets a code instead of a login (see PIN_KINDS below).
 */
export const ROLES = ["admin", "manager"];

export const ROLE_LABEL = {
  admin: "Admin",
  manager: "Floor manager",
};

/**
 * Floor PINs come in two kinds that behave nothing alike, which is why they
 * live in two different places in the console rather than one "Crew PINs"
 * screen:
 *
 * A "station" code belongs to the STATION, not a person — Smokehouse,
 * Packaging, or whatever else a company sets up on the Stations screen.
 * Punching it into a tablet isn't a login, it's telling that tablet what to
 * track for the rest of the shift — long-lived terminal context. Nobody's
 * name is attached, so nothing changes when floor crew turns over. Managed
 * from a location's detail view, since the same station needs a different
 * code at every location (two buildings can't share one tablet identity).
 *
 * A "lead" PIN is the deliberate exception: it's tied to a real person by
 * `userId`, since a lead carries personal accountability a station doesn't.
 * It's momentary, not a context switch — a lead punches it in to authorize
 * one gated action (see GATED_ACTIONS below) without taking over the
 * tablet's station. Managed from the Team screen, generated off an actual
 * account rather than a free-typed name, so it can't drift out of sync with
 * who that person actually is.
 */
export const PIN_KINDS = ["station", "lead"];
export const PIN_KIND_LABEL = { station: "Station", lead: "Lead" };

/**
 * Starting stations for a fresh company — editable from here on out via the
 * Stations screen. Not hardcoded past this seed: `stations` lives in company
 * state (see COMPANY_SEED.stations below) so an admin can rename, add, or
 * remove them per business. It's a shared taxonomy across every location —
 * each location's detail view (under Locations) is where the actual per-
 * location device codes for those stations get issued.
 */
export const DEFAULT_STATIONS = ["Smokehouse", "Packaging"];

/** A station name just needs to be non-empty — trimmed, no other rules. */
export const isValidStationName = (v) => String(v || "").trim().length > 0;

/** A floor PIN is exactly 4 digits, unique across the whole company. */
export const isValidPin = (v) => /^\d{4}$/.test(String(v || ""));

export function generatePin(existingPins) {
  const taken = new Set(existingPins);
  let pin;
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (taken.has(pin));
  return pin;
}

/** Active device codes for one station at one location — usually just one. */
export const stationPinsFor = (crewPins, locationId, station) =>
  crewPins.filter((p) => p.role === "station" && p.locationId === locationId && p.station === station);

/** A person's lead PIN at a given location, if one's been issued. */
export const leadPinFor = (crewPins, userId, locationId) =>
  crewPins.find((p) => p.role === "lead" && p.userId === userId && p.locationId === locationId) || null;

export const PROVIDERS = [
  { id: "clover", name: "Clover", icon: Store, available: true, blurb: "POS + inventory sync" },
  { id: "square", name: "Square", icon: ShoppingBag, available: false, blurb: "POS + payments" },
  { id: "toast", name: "Toast", icon: Boxes, available: false, blurb: "POS for restaurants" },
];

/**
 * Shop-floor actions an enterprise admin can gate behind a Lead-tier PIN.
 * Toggled off (the default for routine steps), any station PIN can perform
 * the action. Toggled on, only a Lead PIN — or a Team account with
 * manager-or-above scope — can. Company-wide, not per location: the whole
 * point is one consistent rule set an enterprise admin sets once.
 */
export const GATED_ACTIONS = [
  {
    id: "close-batch",
    label: "Close out a batch",
    detail: "Locks in the final weight and yield — the number the whole shift gets measured against.",
    defaultRequiresLead: true,
  },
  {
    id: "weigh-in",
    label: "Record a box weigh-in",
    detail: "Logging the Smokehouse box weight as a batch moves to Packaging.",
    defaultRequiresLead: false,
  },
  {
    id: "reopen-batch",
    label: "Reopen a closed batch",
    detail: "Undoes a finalized batch so its weight or stage can be corrected.",
    defaultRequiresLead: true,
  },
  {
    id: "inventory-transfer",
    label: "Move stock between states",
    detail: "Moves stock between made, freezer and the sales floor.",
    defaultRequiresLead: false,
  },
  {
    id: "override-yield-flag",
    label: "Override a low-yield flag",
    detail: "Dismisses a below-threshold yield warning without a manager review.",
    defaultRequiresLead: true,
  },
  {
    id: "manage-task-categories",
    label: "Manage assignment categories",
    detail: "Adds, renames, or removes the task categories in Assignments — the Settings button beside New task.",
    defaultRequiresLead: true,
    // This one's a mock of a different, more granular control than the rest
    // of this list: instead of a company-wide Lead-PIN toggle, it's scoped
    // to specific named people (`accessUserIds`, into COMPANY_SEED.users).
    // PermissionsScreen renders it as an overlapping-avatars-plus-pencil
    // control rather than the Switch — a stand-in for what a real
    // per-person permissions UI would look like, not a wired-up one.
    targeted: true,
    accessUserIds: ["U-1", "U-2"],
  },
];

/** One boolean per gated action, keyed by id — the shape `permissions` state takes. */
export function defaultPermissions() {
  return Object.fromEntries(GATED_ACTIONS.map((a) => [a.id, a.defaultRequiresLead]));
}

let idCounter = 0;
export function newCompanyId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36).slice(-4)}${idCounter.toString(36)}`.toUpperCase();
}

/** Loose but real-looking validation — enough to catch obvious typos in a demo. */
export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

export function maskKey(value) {
  if (!value) return "";
  const s = String(value);
  if (s.length <= 4) return "••••";
  return `•••• •••• ${s.slice(-4)}`;
}

/* ------------------------------------------------------------ Seed state -- */

export const COMPANY_SEED = {
  company: {
    name: "Milaca Meats",
    plan: "Enterprise",
    ownerEmail: "dana@milacameats.com",
    createdAt: "2024-03-12T00:00:00.000Z",
  },

  stations: ["Smokehouse", "Packaging"],

  locations: [
    {
      id: "LOC-1",
      name: "Milaca Meats — Main St",
      address: "412 1st Ave SE, Milaca, MN 56353",
      timezone: "America/Chicago",
    },
    {
      id: "LOC-2",
      name: "Milaca Meats — Foreston Depot",
      address: "88 Depot Rd, Foreston, MN 56330",
      timezone: "America/Chicago",
    },
  ],

  users: [
    {
      id: "U-1",
      name: "Dana Whitfield",
      email: "dana@milacameats.com",
      role: "admin",
      locationIds: ["LOC-1", "LOC-2"],
      status: "active",
      invitedAt: "2024-03-12T00:00:00.000Z",
    },
    {
      id: "U-2",
      name: "Maria Ruiz",
      email: "maria.ruiz@milacameats.com",
      role: "admin",
      locationIds: ["LOC-1", "LOC-2"],
      status: "active",
      invitedAt: "2024-04-02T00:00:00.000Z",
    },
    {
      id: "U-3",
      name: "Sam Whitfield",
      email: "sam@milacameats.com",
      role: "manager",
      locationIds: ["LOC-1"],
      status: "active",
      invitedAt: "2024-06-18T00:00:00.000Z",
    },
    {
      id: "U-4",
      name: "Tyler Boyd",
      email: "tyler.boyd@milacameats.com",
      role: "manager",
      locationIds: ["LOC-2"],
      status: "active",
      invitedAt: "2025-01-09T00:00:00.000Z",
    },
    {
      id: "U-5",
      name: "Jordan Reyes",
      email: "jordan.reyes@milacameats.com",
      role: "admin",
      locationIds: ["LOC-1", "LOC-2"],
      status: "invited",
      invitedAt: "2026-08-18T00:00:00.000Z",
    },
  ],

  crewPins: [
    { id: "PIN-1", pin: "1111", role: "station", station: "Smokehouse", label: "", locationId: "LOC-1" },
    { id: "PIN-2", pin: "2222", role: "lead", userId: "U-2", locationId: "LOC-1" },
    { id: "PIN-3", pin: "3333", role: "station", station: "Packaging", label: "", locationId: "LOC-1" },
    { id: "PIN-4", pin: "4444", role: "lead", userId: "U-3", locationId: "LOC-1" },
    { id: "PIN-5", pin: "5555", role: "station", station: "Smokehouse", label: "", locationId: "LOC-2" },
    { id: "PIN-6", pin: "6666", role: "station", station: "Packaging", label: "", locationId: "LOC-2" },
  ],

  integrations: [
    {
      id: "INT-1",
      locationId: "LOC-1",
      provider: "clover",
      status: "connected",
      merchantId: "MC3819204471",
      apiKey: "clv_live_9f2a7c4e1b8d6053",
      lastSynced: "2026-08-23T13:40:00.000Z",
    },
    {
      id: "INT-2",
      locationId: "LOC-2",
      provider: "clover",
      status: "disconnected",
      merchantId: "",
      apiKey: "",
      lastSynced: null,
    },
  ],
};
