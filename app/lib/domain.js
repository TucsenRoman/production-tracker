"use client";

/**
 * Domain model: stations, staff, batch lifecycle, and the derived numbers the
 * screens read. Kept free of JSX so it can be unit-tested or moved behind an
 * API later without touching the UI.
 */

import { CheckCircle2, Flame, Package } from "lucide-react";

/* ------------------------------------------------------------- Lifecycle -- */

/** A batch moves Smokehouse → Packaging → Shelf-Ready. */
export const STAGES = ["Smokehouse", "Packaging", "Shelf-Ready"];

/** Stages a person can be signed in to. Shelf-Ready is an outcome, not a post. */
export const STATIONS = ["Smokehouse", "Packaging"];

export const STAGE_ICON = {
  Smokehouse: Flame,
  Packaging: Package,
  "Shelf-Ready": CheckCircle2,
};

/** Target minutes in station, used to flag slow batches. */
export const STAGE_TARGET_MINUTES = { Smokehouse: 240, Packaging: 45 };

/** Yield below this is worth a manager's attention. */
export const LOW_YIELD_PCT = 75;

/* ----------------------------------------------------------------- Staff -- */

/**
 * Shop-floor terminals are shared, so people identify by PIN rather than by
 * session. Managers are the same records with elevated scope.
 */
export const STAFF = [
  { pin: "1111", name: "Jake Nowak", initials: "JN", role: "crew", station: "Smokehouse" },
  { pin: "2222", name: "Maria Ruiz", initials: "MR", role: "manager", station: null },
  { pin: "3333", name: "Tyler Boyd", initials: "TB", role: "crew", station: "Packaging" },
  { pin: "4444", name: "Sam Whitfield", initials: "SW", role: "manager", station: null },
];

export const findStaffByPin = (pin) => STAFF.find((s) => s.pin === pin) || null;

/* ------------------------------------------------------------------ Time -- */

export const todayKey = () => new Date().toISOString().slice(0, 10);

export function shiftDate(key, days) {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Sun–Sat week containing `key`, so the strip never shifts mid-view. */
export function weekOf(key) {
  const base = new Date(`${key}T00:00:00`);
  const start = shiftDate(key, -base.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const dayKey = shiftDate(start, i);
    const d = new Date(`${dayKey}T00:00:00`);
    const dow = d.getDay();
    return {
      key: dayKey,
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: d.getDate(),
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      isToday: dayKey === key,
      isProductionDay: dow >= 1 && dow <= 5,
    };
  });
}

export function formatDay(key) {
  if (!key) return "—";
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Whole days from today to an ISO date key. Negative means overdue. */
export function daysUntil(key) {
  if (!key) return null;
  const a = new Date(`${todayKey()}T00:00:00`);
  const b = new Date(`${key}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

export function dueLabel(key) {
  const d = daysUntil(key);
  if (d === null) return "No date";
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due ${formatDay(key)}`;
}

export function dueTone(key) {
  const d = daysUntil(key);
  if (d === null) return "neutral";
  if (d < 0) return "danger";
  if (d <= 1) return "warn";
  return "neutral";
}

export function relativeTime(iso) {
  if (!iso) return null;
  const secs = Math.round((Date.now() - new Date(iso)) / 1000);
  if (secs < 45) return "just now";
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

/* ---------------------------------------------------------------- Batches -- */

/** Batches that skip the smokehouse start their life in Packaging. */
export function nextStageIndex(batch) {
  let i = batch.stage + 1;
  if (STAGES[i] === "Smokehouse" && !batch.needsSmoke) i += 1;
  return Math.min(i, STAGES.length - 1);
}

/** Only the Smokehouse captures a formal box weight. */
export const weighsInAt = (batch) => (batch.needsSmoke ? "Smokehouse" : null);

export function yieldPct(start, final) {
  if (!start || start <= 0 || final == null) return null;
  return +((final / start) * 100).toFixed(1);
}

export function yieldTone(pct) {
  if (pct == null) return "muted";
  if (pct >= 78) return "ok";
  if (pct >= LOW_YIELD_PCT) return "warn";
  return "danger";
}

export const isOverTarget = (station, minutes) =>
  minutes != null && STAGE_TARGET_MINUTES[station] != null
    ? minutes > STAGE_TARGET_MINUTES[station] * 1.15
    : false;

let idCounter = 0;
/** Sequential, readable, and stable across a render pass. */
export function newId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36).slice(-4)}${idCounter.toString(36)}`.toUpperCase();
}

/* ------------------------------------------------- Opening state (seeded) -- */

const T = todayKey();

export const SEED = {
  batches: [
    { id: "B-1047", product: "Applewood Bacon", estWeight: 52, boxWeight: 52, stage: 1, needsSmoke: true, customer: null, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1048", product: "Bratwurst - Jalapeño Cheddar", estWeight: 38, boxWeight: null, stage: 1, needsSmoke: false, customer: null, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1049", product: "Snack Sticks - Hot", estWeight: 22, boxWeight: null, stage: 0, needsSmoke: true, customer: null, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1050", product: "Bratwurst - Maple", estWeight: 24, boxWeight: null, stage: 1, needsSmoke: false, customer: null, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1051", product: "Peppered Bacon", estWeight: 44, boxWeight: null, stage: 0, needsSmoke: true, customer: null, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1044", product: "Summer Sausage", estWeight: 34, boxWeight: 40, stage: 2, needsSmoke: true, customer: null, destination: "retail", finalWeight: 34, startedAt: shiftDate(T, -1) },
  ],

  /** Closed batches, newest last. Feeds the yield and time comparisons. */
  history: [
    { id: "B-1042", product: "Applewood Bacon", closedOn: shiftDate(T, -10), boxWeight: 62, finalWeight: 47, minutes: { Smokehouse: 260, Packaging: 40 } },
    { id: "B-1041", product: "Summer Sausage", closedOn: shiftDate(T, -11), boxWeight: 40, finalWeight: 34, minutes: { Smokehouse: 210, Packaging: 38 } },
    { id: "B-1039", product: "Bratwurst - Original", closedOn: shiftDate(T, -12), boxWeight: 55, finalWeight: 49, minutes: { Packaging: 50 } },
    { id: "B-1037", product: "Bratwurst - Jalapeño Cheddar", closedOn: shiftDate(T, -13), boxWeight: 38, finalWeight: 33, minutes: { Packaging: 42 } },
    { id: "B-1036", product: "Applewood Bacon", closedOn: shiftDate(T, -14), boxWeight: 58, finalWeight: 41, minutes: { Smokehouse: 305, Packaging: 55 } },
    { id: "B-1033", product: "Snack Sticks - Honey BBQ", closedOn: shiftDate(T, -16), boxWeight: 30, finalWeight: 26, minutes: { Smokehouse: 195, Packaging: 30 } },
  ],

  /** Fallback catalogue, used until Clover responds. */
  inventory: [
    { product: "Applewood Bacon", freezer: 30, floor: 18, threshold: 25, unit: "lb" },
    { product: "Peppered Bacon", freezer: 10, floor: 22, threshold: 20, unit: "lb" },
    { product: "Summer Sausage", freezer: 15, floor: 34, threshold: 20, unit: "lb" },
    { product: "Bratwurst - Original", freezer: 0, floor: 41, threshold: 30, unit: "lb" },
    { product: "Bratwurst - Jalapeño Cheddar", freezer: 25, floor: 14, threshold: 18, unit: "lb" },
    { product: "Bratwurst - Maple", freezer: 5, floor: 9, threshold: 15, unit: "lb" },
    { product: "Snack Sticks - Original", freezer: 0, floor: 20, threshold: 15, unit: "lb" },
    { product: "Snack Sticks - Honey BBQ", freezer: 18, floor: 12, threshold: 15, unit: "lb" },
    { product: "Snack Sticks - Hot", freezer: 0, floor: 27, threshold: 15, unit: "lb" },
  ],

  orders: [
    { id: "C-2033", customer: "Lakeside Catering", dueDate: shiftDate(T, 1), contents: ["50 lb Bacon", "10 lb Ground Beef"], notes: "Shipping out for a wedding — do not substitute cuts.", status: "open", location: null },
    { id: "C-2028", customer: "M. Alvarez", dueDate: shiftDate(T, 2), contents: ["25 lb Bratwurst - Original", "15 lb Snack Sticks - Hot"], notes: "", status: "open", location: null },
    { id: "C-2024", customer: "Hillcrest Diner", dueDate: shiftDate(T, 4), contents: ["40 lb Bacon", "20 lb Summer Sausage"], notes: "Recurring weekly order.", status: "open", location: null },
    { id: "C-2019", customer: "R. Olson", dueDate: shiftDate(T, 6), contents: ["30 lb Ground Beef", "10 lb Snack Sticks - Honey BBQ"], notes: "", status: "ready", location: "Front counter, labeled bin", readyBy: "Tyler Boyd" },
  ],

  schedule: {
    [T]: {
      Smokehouse: [
        { id: "T-01", text: "Applewood Bacon", qty: 3, unit: "racks" },
        { id: "T-02", text: "Snack Sticks - Hot", qty: 20, unit: "lb" },
        { id: "T-03", text: "Peppered Bacon", qty: 44, unit: "lb" },
      ],
      Packaging: [
        { id: "T-04", text: "Summer Sausage", qty: 40, unit: "lb" },
        { id: "T-05", text: "Bratwurst - Maple", qty: 24, unit: "lb" },
      ],
    },
  },
};
