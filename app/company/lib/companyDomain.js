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
 * Only owner/admin/manager are invitable company accounts — deliberately no
 * "staff" tier here. That's what Crew PINs are for: floor-level people churn
 * too fast for named email accounts to make sense, so they get a PIN instead
 * of a login (see CREW_ROLES below).
 */
export const ROLES = ["owner", "admin", "manager"];

export const ROLE_LABEL = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
};

/** Owner is the only role that can't be changed or removed by another admin. */
export const ROLE_LOCKED = { owner: true };

/**
 * A "crew" PIN belongs to a STATION, not a person — Smokehouse, Packaging,
 * or whatever else a company sets up on the Stations screen. Anyone working
 * that station that shift enters the same code; whichever tablet it's
 * entered on is that station's tablet for the session. Nobody's name is
 * attached, so nothing needs to change when floor crew turns over.
 *
 * A "lead" PIN is the deliberate exception: a manager/lead's PIN IS tied to
 * them by name, since leads carry personal accountability a station doesn't.
 * That's a different vocabulary from the company ROLES above on purpose — a
 * "lead" PIN and a company "Manager" account (email + password, Team tab)
 * are not the same thing.
 */
export const CREW_ROLES = ["crew", "lead"];
export const CREW_ROLE_LABEL = { crew: "Station", lead: "Lead" };

/**
 * Starting stations for a fresh company — editable from here on out via the
 * Stations screen. Not hardcoded past this seed: `stations` lives in company
 * state (see COMPANY_SEED.stations below) so an admin can rename, add, or
 * remove them per business, and Crew PINs picks up whatever the list is.
 */
export const DEFAULT_STATIONS = ["Smokehouse", "Packaging"];

/** A station name just needs to be non-empty — trimmed, no other rules. */
export const isValidStationName = (v) => String(v || "").trim().length > 0;

/** A crew PIN is exactly 4 digits, unique across the whole company. */
export const isValidPin = (v) => /^\d{4}$/.test(String(v || ""));

export function generatePin(existingPins) {
  const taken = new Set(existingPins);
  let pin;
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (taken.has(pin));
  return pin;
}

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
    id: "mark-order-ready",
    label: "Mark an order ready",
    detail: "Flags an order as picked, packed, and waiting at the counter.",
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
    label: "Freezer → floor transfer",
    detail: "Moves stock from the freezer count onto the sales floor.",
    defaultRequiresLead: false,
  },
  {
    id: "override-yield-flag",
    label: "Override a low-yield flag",
    detail: "Dismisses a below-threshold yield warning without a manager review.",
    defaultRequiresLead: true,
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
      role: "owner",
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
    { id: "PIN-1", pin: "1111", role: "crew", station: "Smokehouse", label: "", locationId: "LOC-1" },
    { id: "PIN-2", pin: "2222", role: "lead", station: null, name: "Maria Ruiz", locationId: "LOC-1" },
    { id: "PIN-3", pin: "3333", role: "crew", station: "Packaging", label: "", locationId: "LOC-1" },
    { id: "PIN-4", pin: "4444", role: "lead", station: null, name: "Sam Whitfield", locationId: "LOC-1" },
    { id: "PIN-5", pin: "5555", role: "crew", station: "Smokehouse", label: "", locationId: "LOC-2" },
    { id: "PIN-6", pin: "6666", role: "crew", station: "Packaging", label: "", locationId: "LOC-2" },
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
