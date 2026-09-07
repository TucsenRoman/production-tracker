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
 * remove them per business. It's a shared taxonomy across every location, and
 * a view on the production board rather than a property of any device — a
 * tablet is not bound to a station, so there is nothing per-location to issue.
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

/** A person's lead PIN at a given location, if one's been issued. Lead PINs
 *  are the only non-person PIN in the system: they approve the actions
 *  Permissions has gated, they are not an identity. */
export const leadPinFor = (crewPins, userId, locationId) =>
  crewPins.find((p) => p.role === "lead" && p.userId === userId && p.locationId === locationId) || null;

export const PROVIDERS = [
  { id: "clover", name: "Clover", icon: Store, available: true, blurb: "POS & inventory" },
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

/**
 * A handful of realistic-sounding ways a POS sync can fail, so "Sync now"
 * doesn't just always succeed — an admin needs to see what a broken
 * connection actually looks like before they'll trust the healthy one.
 */
const SYNC_FAILURES = [
  "401 Unauthorized — the API key was rejected. It may have been revoked in Clover.",
  "Timed out waiting for Clover — the location's internet connection may be down.",
  "429 Too Many Requests — Clover rate-limited this sync. It will succeed on retry.",
  "404 Not Found — the merchant ID no longer matches a Clover account.",
];

/**
 * One simulated sync attempt: mostly succeeds, the way a real integration
 * mostly does, and occasionally fails with a message worth reading. Both
 * branches return a shape the caller turns straight into a history entry.
 */
export function simulateSync() {
  if (Math.random() < 0.82) {
    const itemCount = 40 + Math.floor(Math.random() * 55);
    // A successful pull walks the whole catalog page by page — several API
    // calls, not one — while a fast-failing auth error barely spends any.
    const callsUsed = 8 + Math.floor(Math.random() * 18);
    return { ok: true, itemCount, callsUsed, message: `Synced ${itemCount} items from Clover.` };
  }
  const message = SYNC_FAILURES[Math.floor(Math.random() * SYNC_FAILURES.length)];
  const callsUsed = 1 + Math.floor(Math.random() * 4);
  return { ok: false, itemCount: null, callsUsed, message };
}

/* --------------------------------------------------------- Opening hours -- */

/**
 * A location's week, as seven slots indexed the way `Date`/`Intl` index them —
 * 0 is Sunday. A slot is either null (shut that day) or {open, close} in 24h
 * "HH:MM" local-to-that-location time.
 *
 * Stored per location rather than per company because two buildings genuinely
 * keep different hours, and derived against the location's OWN timezone rather
 * than the admin's: the whole point of the status is telling someone in another
 * state whether the door is open right now.
 */
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DEFAULT_DAY_HOURS = { open: "08:00", close: "17:00" };
export const EMPTY_HOURS = [null, null, null, null, null, null, null];

const toMinutes = (v) => {
  const [h, m] = String(v || "").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/** "17:30" -> "5:30 PM", "08:00" -> "8 AM". The :00 is noise. */
export function formatClock(v) {
  const [h, m] = String(v || "").split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, "0")} ${suffix}` : `${hour12} ${suffix}`;
}

/**
 * Is this location open right now, and what happens next?
 *
 * Returns null — render nothing — when there are no hours on file. That case
 * matters: a status chip that says "Closed" because nobody has filled the
 * hours in yet is worse than no chip, because it reads as a fact about the
 * building rather than a gap in the record.
 */
export function openStateAt(hours, timezone, now = new Date()) {
  if (!Array.isArray(hours) || !hours.some(Boolean)) return null;

  let dayIndex;
  let minutes;
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value])
    );
    dayIndex = DAY_LABELS.indexOf(parts.weekday);
    // hour12:false yields "24" for midnight in some engines.
    minutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  } catch {
    return null; // an unrecognised timezone drops the chip rather than guessing
  }
  if (dayIndex < 0 || !Number.isFinite(minutes)) return null;

  const today = hours[dayIndex];
  if (today && minutes >= toMinutes(today.open) && minutes < toMinutes(today.close)) {
    return { open: true, detail: `closes ${formatClock(today.close)}` };
  }

  // Walk forward for the next opening. Eight steps, not seven, so a location
  // open exactly one day a week still resolves — to the same day next week.
  for (let step = 0; step < 8; step += 1) {
    const index = (dayIndex + step) % 7;
    const day = hours[index];
    if (!day) continue;
    // Today only counts if we haven't already passed its opening time.
    if (step === 0 && minutes >= toMinutes(day.open)) continue;
    const when = step === 0 ? "today" : step === 1 ? "tomorrow" : DAY_LABELS[index];
    return { open: false, detail: `opens ${formatClock(day.open)} ${when}` };
  }

  return { open: false, detail: null };
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
      name: "Milaca",
      address: "412 1st Ave SE, Milaca, MN 56353",
      timezone: "America/Chicago",
      photoUrl: "/milaca.jpg",
      // Sun closed, weekdays 8-5.30, Sat a short morning. Index 0 is Sunday.
      hours: [
        null,
        { open: "08:00", close: "17:30" },
        { open: "08:00", close: "17:30" },
        { open: "08:00", close: "17:30" },
        { open: "08:00", close: "17:30" },
        { open: "08:00", close: "17:30" },
        { open: "08:00", close: "14:00" },
      ],
    },
  ],

  /* `avatarUrl` is demo seed data: placeholder headshots under public/avatars,
   * standing in for people who don't exist. Swap for real photos or drop the
   * field — the card falls back to initials on its own — before this is in
   * front of anyone who might take them for staff. */
  users: [
    {
      id: "U-1",
      name: "Dana Whitfield",
      email: "dana@milacameats.com",
      avatarUrl: "/avatars/dana-whitfield.jpg",
      role: "admin",
      locationIds: ["LOC-1"],
      status: "active",
      invitedAt: "2024-03-12T00:00:00.000Z",
    },
    {
      id: "U-2",
      name: "Maria Ruiz",
      email: "maria.ruiz@milacameats.com",
      avatarUrl: "/avatars/maria-ruiz.jpg",
      role: "admin",
      locationIds: ["LOC-1"],
      status: "active",
      invitedAt: "2024-04-02T00:00:00.000Z",
    },
    {
      id: "U-3",
      name: "Marcus Reed",
      email: "marcus.reed@milacameats.com",
      avatarUrl: "/avatars/marcus-reed.jpg",
      role: "manager",
      locationIds: ["LOC-1"],
      status: "active",
      invitedAt: "2024-06-18T00:00:00.000Z",
    },
    {
      id: "U-5",
      name: "Jordan Reyes",
      email: "jordan.reyes@milacameats.com",
      avatarUrl: "/avatars/jordan-reyes.jpg",
      role: "admin",
      locationIds: ["LOC-1"],
      status: "invited",
      invitedAt: "2026-08-18T00:00:00.000Z",
    },
  ],

  crewPins: [
    { id: "PIN-2", pin: "2222", role: "lead", userId: "U-2", locationId: "LOC-1" },
    { id: "PIN-4", pin: "4444", role: "lead", userId: "U-3", locationId: "LOC-1" },
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
      lastResult: "ok",
      lastError: null,
      webhookActive: true,
      lastWebhookAt: "2026-08-23T13:40:00.000Z",
      // Clover's own developer-account cap, not a ProTrack limit — the bar on
      // the card is reading Clover's meter, which is exactly why it matters.
      apiCallsUsed: 3684,
      apiCallLimit: 5000,
      // Newest first — the same order the detail modal renders it in.
      history: [
        {
          id: "H-3",
          at: "2026-08-23T13:40:00.000Z",
          type: "sync-ok",
          message: "Synced 62 items from Clover.",
          itemCount: 62,
        },
        {
          id: "H-2",
          at: "2026-08-22T09:15:00.000Z",
          type: "sync-error",
          message: "429 Too Many Requests — Clover rate-limited this sync. It will succeed on retry.",
          itemCount: null,
        },
        {
          id: "H-1",
          at: "2026-08-20T08:00:00.000Z",
          type: "connected",
          message: "Connected to Clover.",
          itemCount: null,
        },
      ],
    },
  ],
};
