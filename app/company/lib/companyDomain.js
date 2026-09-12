"use client";

/**
 * Company domain model: the account layer above a shop floor. A company owns
 * locations, a roster of admin/manager users, and each location's POS
 * integration. Separate from ../../lib/domain.js so the floor terminal and
 * the console can evolve independently.
 */

import { Boxes, ShoppingBag, Store } from "lucide-react";

import { STATIONS } from "../../lib/domain";

/**
 * Two roles: admin (full company access) and floor manager (their own
 * location's day-to-day work). No "staff" tier — floor-level people don't
 * get named accounts; approvals on a tablet use a person's PIN instead.
 */
export const ROLES = ["admin", "manager"];

export const ROLE_LABEL = {
  admin: "Admin",
  manager: "Floor manager",
};

/** A station name just needs to be non-empty — trimmed, no other rules. */
export const isValidStationName = (v) => String(v || "").trim().length > 0;

/** A PIN is exactly 4 digits, unique across the whole company. */
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
  { id: "clover", name: "Clover", icon: Store, available: true, blurb: "POS & inventory" },
  { id: "square", name: "Square", icon: ShoppingBag, available: false, blurb: "POS + payments" },
  { id: "toast", name: "Toast", icon: Boxes, available: false, blurb: "POS for restaurants" },
];

/**
 * Floor actions an admin can require a manager PIN for. Company-wide, not
 * per location: one rule set, set once. `targeted` actions are instead
 * granted to a named list of people (`accessUserIds`, editable via
 * actionAccess.js) rather than an on/off toggle.
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
    id: "switch-location",
    label: "Change which shop a tablet is set to",
    detail:
      "Re-points a floor tablet at a different location. Everything logged after it — batches, stock moves, tasks — files against the new shop.",
    defaultRequiresLead: true,
    /* Named people rather than a toggle: getting this wrong is silent — the
     * tablet keeps working, just filing against the wrong shop. */
    targeted: true,
    accessUserIds: ["U-1", "U-2"],
  },
  {
    id: "manage-task-categories",
    label: "Manage assignment categories",
    detail: "Adds, renames, or removes the task categories in Assignments — the Settings button beside New task.",
    defaultRequiresLead: true,
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

/** Realistic failure messages so a demo "Sync now" doesn't always succeed. */
const SYNC_FAILURES = [
  "401 Unauthorized — the API key was rejected. It may have been revoked in Clover.",
  "Timed out waiting for Clover — the location's internet connection may be down.",
  "429 Too Many Requests — Clover rate-limited this sync. It will succeed on retry.",
  "404 Not Found — the merchant ID no longer matches a Clover account.",
];

/** One simulated sync attempt; both branches return a history-entry shape. */
export function simulateSync() {
  if (Math.random() < 0.82) {
    const itemCount = 40 + Math.floor(Math.random() * 55);
    // A successful pull pages through the catalog (several calls); a
    // fast-failing error barely spends any.
    const callsUsed = 8 + Math.floor(Math.random() * 18);
    return { ok: true, itemCount, callsUsed, message: `Synced ${itemCount} items from Clover.` };
  }
  const message = SYNC_FAILURES[Math.floor(Math.random() * SYNC_FAILURES.length)];
  const callsUsed = 1 + Math.floor(Math.random() * 4);
  return { ok: false, itemCount: null, callsUsed, message };
}

/* --------------------------------------------------------- Opening hours -- */

/**
 * A location's week: seven slots indexed like `Date` (0 is Sunday), each null
 * (shut) or {open, close} in 24h "HH:MM" local to that location. Open state is
 * derived in the location's own timezone, not the admin's.
 */
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DEFAULT_DAY_HOURS = { open: "08:00", close: "17:00" };
export const EMPTY_HOURS = [null, null, null, null, null, null, null];

const toMinutes = (v) => {
  const [h, m] = String(v || "").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/** "17:30" -> "5:30 PM", "08:00" -> "8 AM". The :00 is noise. */
function formatClock(v) {
  const [h, m] = String(v || "").split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, "0")} ${suffix}` : `${hour12} ${suffix}`;
}

/**
 * Is this location open right now, and what happens next? Returns null when
 * there are no hours on file: a "Closed" chip for a gap in the record would
 * read as a fact about the building.
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

/**
 * A second location, kept out of `COMPANY_SEED`: the everyday demo is one
 * shop, but many screens only show their real shape with two. The account
 * switcher's dev toggle folds this in and out at runtime
 * (`handleToggleLocations` in CompanyConsole.jsx), so everything here must be
 * removable by id. Deliberately no integration record — an unconnected
 * location is a state the Locations screen otherwise never shows.
 */
export const DEMO_SECOND_LOCATION = {
  location: {
    id: "LOC-2",
    name: "Princeton",
    address: "118 Rum River Dr, Princeton, MN 55371",
    timezone: "America/Chicago",
    /* Unsplash CDN, cropped server-side to the card's 900x394. Photo by
     * Fitri Ariningrum. Demo data — swap for the real shop. */
    photoUrl:
      "https://images.unsplash.com/photo-1722581248341-de9b34c116bb?w=900&h=394&fit=crop&q=70&auto=format",
    hours: [
      null,
      { open: "08:00", close: "17:00" },
      { open: "08:00", close: "17:00" },
      { open: "08:00", close: "17:00" },
      { open: "08:00", close: "17:00" },
      { open: "08:00", close: "17:00" },
      { open: "08:00", close: "12:00" },
    ],
  },
  /* One manager who works only there, one who covers both locations. */
  users: [
    {
      id: "U-6",
      name: "Tomás Delgado",
      email: "tomas.delgado@milacameats.com",
      /* `crop=faces` centres the square on the face. Photo by Vitaly Gariev. */
      avatarUrl:
        "https://images.unsplash.com/photo-1758874573822-d6c79fd1b216?w=128&h=128&fit=crop&crop=faces&q=75&auto=format",
      role: "manager",
      locationIds: ["LOC-2"],
      status: "active",
      invitedAt: "2025-09-15T00:00:00.000Z",
    },
    {
      id: "U-7",
      name: "Priya Raghavan",
      email: "priya.raghavan@milacameats.com",
      /* Photo by Vitaly Gariev. */
      avatarUrl:
        "https://images.unsplash.com/photo-1758876019338-c190822f6ca0?w=128&h=128&fit=crop&crop=faces&q=75&auto=format",
      role: "manager",
      locationIds: ["LOC-1", "LOC-2"],
      status: "active",
      invitedAt: "2026-01-08T00:00:00.000Z",
    },
  ],
  crewPins: [
    { id: "PIN-5", pin: "5555", role: "lead", userId: "U-6", locationId: "LOC-2" },
  ],
};

export const COMPANY_SEED = {
  company: {
    name: "Milaca Meats",
    plan: "Enterprise",
    ownerEmail: "dana@milacameats.com",
    createdAt: "2024-03-12T00:00:00.000Z",
  },

  stations: STATIONS,

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

  /* `avatarUrl` is placeholder demo data; drop the field and the card falls
   * back to initials. */
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
      /* Admins hold a PIN too: it approves gated actions on a tablet. */
      pin: "1357",
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
      pin: "2468",
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
      // Clover's own account cap, not a ProTrack limit.
      apiCallsUsed: 3684,
      apiCallLimit: 5000,
      // Newest first — the order it renders in.
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
