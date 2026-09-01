"use client";

/**
 * Domain model: stations, staff, batch lifecycle, and the derived numbers the
 * screens read. Kept free of JSX so it can be unit-tested or moved behind an
 * API later without touching the UI.
 */

import {
  Boxes,
  BroomSparkles,
  CheckCircle2,
  ClipboardList,
  FileText,
  Flame,
  Package,
  PackageCheck,
  Snowflake,
  Store,
  Tag,
  Thermometer,
  Truck,
  Wrench,
} from "lucide-react";

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
 *
 * Roles are ranked, and the rank is the whole permission model: you may only
 * act on someone below you. Nobody can promote a person to their own level or
 * above, which is what stops a manager from minting a second owner.
 */
export const ROLES = ["crew", "manager", "owner"];

export const ROLE_LABEL = { crew: "Crew", manager: "Manager", owner: "Owner" };

export const ROLE_BLURB = {
  crew: "Runs batches, records weights, moves stock.",
  manager: "Everything crew can do, plus schedule, insights and PINs.",
  owner: "Full access, including managing other managers.",
};

export const roleRank = (role) => Math.max(0, ROLES.indexOf(role));

/** Managers and up see the planning screens. */
export const isManager = (user) => !!user && roleRank(user.role) >= roleRank("manager");

/** You can edit someone strictly below you — and always yourself. */
export function canManageStaff(actor, target) {
  if (!actor || !target) return false;
  if (actor.id === target.id) return true;
  return isManager(actor) && roleRank(actor.role) > roleRank(target.role);
}

/** The roles `actor` is allowed to hand out — always below their own. */
export const assignableRoles = (actor) =>
  ROLES.filter((r) => roleRank(r) < roleRank(actor?.role));

export const initialsOf = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "?";

/** PINs are 4 digits, and a blocked list keeps the obvious ones out. */
export const WEAK_PINS = ["0000", "1111", "1234", "2222", "3333", "4444", "9999"];

export function validatePin(pin, { existing = [], allowWeak = false } = {}) {
  if (!/^\d{4}$/.test(pin || "")) return "Use exactly 4 digits.";
  if (!allowWeak && WEAK_PINS.includes(pin)) return "That PIN is too easy to guess.";
  if (existing.includes(pin)) return "Someone already uses that PIN.";
  return null;
}

export const SEED_STAFF = [
  { id: "S-1", pin: "1470", name: "Jake Nowak", role: "crew", station: "Smokehouse" },
  { id: "S-2", pin: "2635", name: "Maria Ruiz", role: "manager", station: null },
  { id: "S-3", pin: "3812", name: "Tyler Boyd", role: "crew", station: "Packaging" },
  { id: "S-4", pin: "4059", name: "Sam Whitfield", role: "owner", station: null },
].map((s) => ({ ...s, initials: initialsOf(s.name) }));

/** Kept as the seed-only fallback; screens read the live list from useStaff(). */
export const STAFF = SEED_STAFF;

export const findStaffByPin = (pin) => SEED_STAFF.find((s) => s.pin === pin) || null;

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

/* -------------------------------------------------------------- Inventory -- */

/**
 * Stock lives in one of three places, and the difference matters on the floor:
 * a pallet that has been *made* is not the same as one that is put away, and
 * neither is sellable until it is out front. Clover only ever sees `floor`.
 */
export const STOCK_STATES = [
  { id: "made", label: "Made", short: "Made", hint: "produced, not put away" },
  { id: "freezer", label: "In stock", short: "Freezer", hint: "held in the freezer" },
  { id: "floor", label: "On floor", short: "Floor", hint: "sellable in Clover" },
];

export const STATE_IDS = STOCK_STATES.map((s) => s.id);

export const stateLabel = (id) => STOCK_STATES.find((s) => s.id === id)?.label || id;

/** Icon for each stock state — shared by every screen that shows one. */
export const STATE_ICON = { made: PackageCheck, freezer: Snowflake, floor: Store };

/**
 * Broad families used by the floor filters — "show me all the sticks".
 *
 * Only families actually present in the catalogue are offered as filters, so a
 * long list here costs nothing on screen; an over-short one, on the other hand,
 * dumps half the case into "Other" and makes the filter useless for exactly the
 * products whose family isn't obvious from the name.
 */
export const PRODUCT_TYPES = [
  "Bacon",
  "Brats",
  "Sausage",
  "Sticks",
  "Jerky",
  "Ham",
  "Deli",
  "Roasts",
  "Steaks",
  "Chops",
  "Ribs",
  "Ground",
  "Poultry",
  "Other",
];

/**
 * Name → family, first rule wins.
 *
 * Order carries the whole design here, because meat names overlap constantly
 * and the obvious keyword is often the wrong one:
 *   "Prime Rib Roast"  — roasts must beat ribs, or every roast becomes a rib
 *   "Ribeye Steak"     — steaks must beat ribs for the same reason
 *   "Pork Loin Chop"   — chops must beat the loin/roast rule
 *   "Snack Sticks"     — sticks must beat sausage
 *   "Bratwurst"        — brats must beat sausage
 *   "Pork Belly"       — bellies are bacon before they are anything else
 * Adding a keyword to the wrong rung silently reclassifies half a case, so new
 * words go in the most specific rung that can claim them.
 */
const FAMILY_RULES = [
  ["Jerky", ["jerky"]],
  ["Sticks", ["snack stick", "stick"]],
  ["Brats", ["brat"]],
  ["Bacon", ["bacon", "belly", "bellies"]],
  ["Ground", ["ground", "burger", "patty", "patties"]],
  ["Steaks", ["steak", "ribeye", "rib eye", "sirloin", "t-bone", "porterhouse", "filet", "flank", "skirt"]],
  ["Chops", ["chop", "cutlet"]],
  ["Roasts", ["roast", "prime rib", "brisket", "butt", "shoulder", "tenderloin", "loin"]],
  ["Ribs", ["rib"]],
  ["Ham", ["ham", "hock", "prosciutto"]],
  ["Deli", ["bologna", "salami", "pastrami", "liverwurst", "braunschweiger", "head cheese", "pate"]],
  ["Poultry", ["chicken", "turkey", "duck", "poultry", "wing", "drumstick", "thigh"]],
  ["Sausage", ["sausage", "kielbasa", "chorizo", "andouille", "link", "wiener", "hot dog", "frank"]],
];

export function productType(name = "") {
  const n = name.toLowerCase();
  for (const [family, keywords] of FAMILY_RULES) {
    if (keywords.some((k) => n.includes(k))) return family;
  }
  return "Other";
}

/**
 * Sensible reorder point per family, in lb on the floor.
 *
 * A flat minimum across the whole case made every product equally alarming,
 * which is the same as none of them being alarming. These are starting
 * estimates by how fast a family moves and what it costs to hold — ground and
 * bacon turn over daily, jerky sits for weeks — and are meant to be overridden
 * per product once someone who works the counter disagrees.
 */
export const FAMILY_THRESHOLD = {
  Bacon: 40,
  Brats: 30,
  Sausage: 25,
  Sticks: 20,
  Jerky: 12,
  Ham: 20,
  Deli: 10,
  Roasts: 15,
  Steaks: 25,
  Chops: 25,
  Ribs: 20,
  Ground: 40,
  Poultry: 20,
  Other: 15,
};

/** Fallback minimum when a product has no family we recognise. */
export const DEFAULT_THRESHOLD = FAMILY_THRESHOLD.Other;

export const defaultThreshold = (name) => FAMILY_THRESHOLD[productType(name)] ?? DEFAULT_THRESHOLD;

/**
 * How full the case should be — the number the slash is measured against.
 *
 * The minimum answers "should I worry"; the max answers "how much do I carry
 * out", and they are not the same question. A stocker filling to the minimum
 * would be back at the alert line the moment anything sells, so the fill target
 * has to sit above it. Derived at roughly twice the minimum, rounded to a
 * number a person would actually say out loud, and overridable per product.
 */
export const capacityFor = (threshold) =>
  Math.max(threshold + 5, Math.round((threshold * 2.2) / 5) * 5);

export const defaultMax = (name) => capacityFor(defaultThreshold(name));

/** What the stocker should bring out to fill the case. */
export const refillQty = (item) => Math.max(0, +(item.max - stockIn(item, "floor")).toFixed(1));

/** Older saved records predate `made` and `type`, so fill them in on read. */
export function normalizeItem(item) {
  const type = item.type || productType(item.product);
  // A custom minimum should drag the capacity with it, so the max is derived
  // from whatever threshold this product actually ends up with rather than from
  // its family's default.
  const threshold = item.threshold ?? FAMILY_THRESHOLD[type] ?? DEFAULT_THRESHOLD;
  return {
    made: 0,
    freezer: 0,
    floor: 0,
    unit: "lb",
    ...item,
    type,
    threshold,
    max: item.max ?? capacityFor(threshold),
  };
}

export const stockIn = (item, state) => Number(item?.[state] ?? 0);

export const totalStock = (item) =>
  +STATE_IDS.reduce((sum, id) => sum + stockIn(item, id), 0).toFixed(1);

export const isLow = (item) => stockIn(item, "floor") < item.threshold;

/** Stock standing behind the floor — what could be put out without making any. */
export const behindStock = (item) => +(stockIn(item, "made") + stockIn(item, "freezer")).toFixed(1);

/** How many lb short of the minimum the floor is. Zero when at or above par. */
export const floorDeficit = (item) =>
  Math.max(0, +(item.threshold - stockIn(item, "floor")).toFixed(1));

/* ------------------------------------------------------------------ Cover -- */

/** Under this many days of floor stock is worth acting on today. */
export const COVER_WARN_DAYS = 5;
export const COVER_CRITICAL_DAYS = 2;

/**
 * Days the floor will last at the recent selling pace.
 *
 * This is the only inventory number that answers "will I run out" rather than
 * "how much is there", so it is worth more than every weight on the screen —
 * but it is only as honest as the velocity behind it. No velocity, no number:
 * a made-up cover figure is worse than a blank.
 */
export function daysOfCover(item, perDay) {
  if (!perDay || perDay <= 0) return null;
  return +(stockIn(item, "floor") / perDay).toFixed(1);
}

/** Cover once everything in the freezer and on the made pile is put out. */
export function potentialCover(item, perDay) {
  if (!perDay || perDay <= 0) return null;
  return +(totalStock(item) / perDay).toFixed(1);
}

export const coverTone = (days) =>
  days == null ? "muted" : days < COVER_CRITICAL_DAYS ? "danger" : days < COVER_WARN_DAYS ? "warn" : "ok";

/**
 * How a product is doing, as a severity rather than as an action.
 *
 * An earlier version bucketed by the work required — "make this" vs "move
 * that" — which produced the absurd reading of "Make today: 0" while three
 * products sat at zero, because out-of-stock had been split off into its own
 * bucket. Severity avoids that: out is simply the end of the same ladder low
 * sits on, and the ladder warns early enough to prep rather than only once the
 * shelf is bare.
 *
 *   out  — nothing anywhere.
 *   low  — below par on the floor, but some exists somewhere.
 *   ok   — at or above par on the floor.
 */
export function stockStatus(item) {
  if (totalStock(item) <= 0) return "out";
  return isLow(item) ? "low" : "ok";
}

/**
 * Whether the gap can be closed by moving stock instead of making any.
 *
 * Deliberately overlaps `low`: it is not a fourth severity but the subset of
 * low that costs nothing to fix, which is the cheapest work on the screen and
 * worth surfacing on its own.
 */
export const canPutOut = (item) =>
  stockStatus(item) === "low" && behindStock(item) > 0;

/** Move weight between two states on one product, clamped to what is there. */
export function moveStock(item, from, to, amount) {
  const available = stockIn(item, from);
  const qty = Math.min(Math.max(0, Number(amount) || 0), available);
  if (!qty || from === to) return item;
  return {
    ...item,
    [from]: +(available - qty).toFixed(1),
    [to]: +(stockIn(item, to) + qty).toFixed(1),
  };
}

/**
 * The one-tap version of `canPutOut`: everything behind the floor (made and
 * freezer both) lands on it in a single step, instead of the from/to/amount
 * picker `moveStock` needs. A no-op when there's nothing behind to put out.
 */
export function putOnFloor(item) {
  const amount = behindStock(item);
  if (amount <= 0) return item;
  return {
    ...item,
    made: 0,
    freezer: 0,
    floor: +(stockIn(item, "floor") + amount).toFixed(1),
  };
}

// Next tier: the mirror action for the made pile — one tap to put everything
// made away in the freezer, for the "To put away" tile the same way
// `putOnFloor` backs "Put out now". Not built yet.
//
// export function putAway(item) {
//   const amount = stockIn(item, "made");
//   if (amount <= 0) return item;
//   return {
//     ...item,
//     made: 0,
//     freezer: +(stockIn(item, "freezer") + amount).toFixed(1),
//   };
// }

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

/* -------------------------------------------------------------- To-Do ---- */

/**
 * Tasks the floor sees and checks off — stocking call-outs plus whatever else
 * management assigns. Deliberately its own list rather than riding on batches
 * or the schedule: a to-do can exist with nothing behind it ("wipe the display
 * case") and it outlives a single shift.
 */
/**
 * Category icons are stored as a string id, not a component — the list below
 * is persisted state (see `usePersistentState("taskCategories", ...)` in
 * ProductionTracker), and a component reference doesn't survive JSON.
 */
export const TASK_CATEGORY_ICONS = {
  package: Package,
  clipboard: ClipboardList,
  broom: BroomSparkles,
  store: Store,
  wrench: Wrench,
  file: FileText,
  truck: Truck,
  thermometer: Thermometer,
  tag: Tag,
  boxes: Boxes,
};

/** Offered in the "add a category" icon picker, in a sensible order. */
export const TASK_CATEGORY_ICON_OPTIONS = Object.entries(TASK_CATEGORY_ICONS).map(([id, icon]) => ({
  id,
  icon,
}));

export const iconFor = (iconId) => TASK_CATEGORY_ICONS[iconId] || ClipboardList;

/** Seeds `taskCategories` on first load. Editable afterward — see ManageCategoriesModal. */
export const DEFAULT_TASK_CATEGORIES = [
  { id: "stocking", label: "Stocking", iconId: "package" },
  { id: "prep", label: "Prep", iconId: "clipboard" },
  { id: "cleaning", label: "Cleaning", iconId: "broom" },
  { id: "front", label: "Front of house", iconId: "store" },
  { id: "maintenance", label: "Maintenance", iconId: "wrench" },
  { id: "admin", label: "Admin", iconId: "file" },
];

export const categoryIcon = (categories, id) => iconFor(categories.find((c) => c.id === id)?.iconId);
export const categoryLabel = (categories, id) => categories.find((c) => c.id === id)?.label || "Task";

/** A category can't be removed while a task still points at it. */
export const categoryInUse = (tasks, id) => tasks.some((t) => t.category === id);

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"];
export const PRIORITY_LABEL = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export const PRIORITY_TONE = { low: "neutral", normal: "info", high: "warn", urgent: "danger" };
export const priorityRank = (p) => Math.max(0, TASK_PRIORITIES.indexOf(p));

/**
 * Open tasks first — highest priority and soonest due date first within that —
 * then completed tasks, most recently finished first.
 */
export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.completed) return (b.completedAt || "").localeCompare(a.completedAt || "");
    const byPriority = priorityRank(b.priority) - priorityRank(a.priority);
    if (byPriority) return byPriority;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return (a.createdAt || "").localeCompare(b.createdAt || "");
  });
}

/**
 * Crew see what's assigned to them and anything open to whoever's free;
 * managers see the whole list, same as everywhere else permission is scoped.
 */
export function visibleTasks(tasks, user) {
  if (isManager(user)) return tasks;
  return tasks.filter((t) => !t.assignedTo || t.assignedTo === user.id);
}

/* ------------------------------------------------- Opening state (seeded) -- */

const T = todayKey();

export const SEED = {
  batches: [
    { id: "B-1047", product: "Applewood Bacon", estWeight: 52, boxWeight: 52, stage: 1, needsSmoke: true, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1048", product: "Bratwurst - Jalapeño Cheddar", estWeight: 38, boxWeight: null, stage: 1, needsSmoke: false, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1049", product: "Snack Sticks - Hot", estWeight: 22, boxWeight: null, stage: 0, needsSmoke: true, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1050", product: "Bratwurst - Maple", estWeight: 24, boxWeight: null, stage: 1, needsSmoke: false, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1051", product: "Peppered Bacon", estWeight: 44, boxWeight: null, stage: 0, needsSmoke: true, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1044", product: "Summer Sausage", estWeight: 34, boxWeight: 40, stage: 2, needsSmoke: true, destination: "floor", finalWeight: 34, startedAt: shiftDate(T, -1) },
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

  staff: SEED_STAFF,

  /** Fallback catalogue, used until Clover responds. */
  inventory: [
    { product: "Applewood Bacon", made: 12, freezer: 30, floor: 18, threshold: 45, unit: "lb" },
    { product: "Peppered Bacon", made: 0, freezer: 10, floor: 22, threshold: 30, unit: "lb" },
    { product: "Pork Bellies - Raw", made: 88, freezer: 40, floor: 0, threshold: 60, unit: "lb" },
    { product: "Summer Sausage", made: 0, freezer: 15, floor: 34, threshold: 28, unit: "lb" },
    { product: "Bratwurst - Original", made: 0, freezer: 0, floor: 41, threshold: 35, unit: "lb" },
    { product: "Bratwurst - Jalapeño Cheddar", made: 16, freezer: 25, floor: 14, threshold: 24, unit: "lb" },
    { product: "Bratwurst - Maple", made: 0, freezer: 5, floor: 9, threshold: 16, unit: "lb" },
    { product: "Snack Sticks - Original", made: 0, freezer: 0, floor: 20, threshold: 22, unit: "lb" },
    { product: "Snack Sticks - Honey BBQ", made: 9, freezer: 18, floor: 12, threshold: 15, unit: "lb" },
    { product: "Snack Sticks - Hot", made: 0, freezer: 0, floor: 27, threshold: 20, unit: "lb" },
    { product: "Beef Jerky - Original", made: 0, freezer: 22, floor: 31, threshold: 14, unit: "lb" },
    { product: "Beef Jerky - Teriyaki", made: 5, freezer: 8, floor: 11, threshold: 8, unit: "lb" },
    { product: "Ground Beef - 80/20", made: 0, freezer: 35, floor: 52, threshold: 50, unit: "lb" },
    { product: "Pork Chops - Center Cut", made: 0, freezer: 12, floor: 26, threshold: 25, unit: "lb" },
    { product: "Prime Rib Roast", made: 0, freezer: 18, floor: 9, threshold: 12, unit: "lb" },
    // Demo names below match the Clover sandbox catalogue 1:1 so the fallback
    // numbers show up as this product's floor/freezer stock instead of the
    // 0 lb Clover reports (no numeric-quantity Inventory app in the sandbox).
    { product: "85-15 Ground Beef", made: 0, freezer: 38, floor: 46, threshold: 40, unit: "lb" },
    { product: "Tomahawk Steak", made: 0, freezer: 33, floor: 17, threshold: 25, unit: "lb" },
    { product: "Filet Mignon Steak", made: 0, freezer: 22, floor: 28, threshold: 25, unit: "lb" },
    { product: "T-Bone Steak", made: 0, freezer: 36, floor: 16, threshold: 25, unit: "lb" },
    { product: "New York Strip Steak", made: 0, freezer: 24, floor: 31, threshold: 25, unit: "lb" },
    { product: "Bone-In Ribeye Steak", made: 0, freezer: 34, floor: 18, threshold: 25, unit: "lb" },
    { product: "Baby Back Ribs", made: 0, freezer: 24, floor: 16, threshold: 20, unit: "lb" },
    { product: "Smoked Ham", made: 0, freezer: 20, floor: 21, threshold: 18, unit: "lb" },
    { product: "Ring Bologna", made: 0, freezer: 6, floor: 7, threshold: 10, unit: "lb" },
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

  /**
   * Floor to-do list. A mix of stocking call-outs and general tasks, some
   * open to anyone on shift and some assigned to a specific person — the way
   * Maria and Sam actually hand out work at open and mid-shift.
   */
  todos: [
    {
      id: "TD-1",
      title: "Move Pork Bellies to the prep table",
      category: "stocking",
      priority: "urgent",
      assignedTo: "S-1",
      dueDate: T,
      note: "88 lb raw in the freezer — smokehouse needs it for tomorrow's bacon run.",
      createdBy: "Sam Whitfield",
      createdAt: `${shiftDate(T, 0)}T06:45:00`,
      completed: false,
    },
    {
      id: "TD-2",
      title: "Restock Applewood Bacon on the floor",
      category: "stocking",
      priority: "high",
      assignedTo: null,
      dueDate: T,
      note: "Floor is under par — pull from the freezer if the smokehouse hasn't caught up yet.",
      createdBy: "Maria Ruiz",
      createdAt: `${shiftDate(T, 0)}T07:10:00`,
      completed: false,
    },
    {
      id: "TD-3",
      title: "Portion Snack Sticks - Honey BBQ into 1 lb bags",
      category: "prep",
      priority: "normal",
      assignedTo: "S-3",
      dueDate: T,
      note: "18 lb in the freezer, ready to bag.",
      createdBy: "Maria Ruiz",
      createdAt: `${shiftDate(T, 0)}T07:30:00`,
      completed: false,
    },
    {
      id: "TD-4",
      title: "Face and rotate the jerky case",
      category: "front",
      priority: "normal",
      assignedTo: null,
      dueDate: T,
      note: "Pull anything past its date to the front.",
      createdBy: "Maria Ruiz",
      createdAt: `${shiftDate(T, -1)}T16:00:00`,
      completed: false,
    },
    {
      id: "TD-5",
      title: "Wipe down and restock the display case glass",
      category: "cleaning",
      priority: "low",
      assignedTo: "S-3",
      dueDate: T,
      note: null,
      createdBy: "Maria Ruiz",
      createdAt: `${shiftDate(T, 0)}T08:00:00`,
      completed: false,
    },
    {
      id: "TD-6",
      title: "Log the walk-in freezer temperature",
      category: "maintenance",
      priority: "high",
      assignedTo: null,
      dueDate: T,
      note: "Twice a shift — clipboard's on the freezer door.",
      createdBy: "Sam Whitfield",
      createdAt: `${shiftDate(T, 0)}T06:00:00`,
      completed: true,
      completedBy: "Tyler Boyd",
      completedAt: `${shiftDate(T, 0)}T09:12:00`,
    },
    {
      id: "TD-7",
      title: "Print new price tags for Snack Sticks - Hot",
      category: "admin",
      priority: "normal",
      assignedTo: "S-2",
      dueDate: shiftDate(T, 1),
      note: "New case price starts tomorrow.",
      createdBy: "Sam Whitfield",
      createdAt: `${shiftDate(T, -1)}T15:30:00`,
      completed: false,
    },
    {
      id: "TD-8",
      title: "Deep clean the smokehouse racks",
      category: "cleaning",
      priority: "normal",
      assignedTo: "S-1",
      dueDate: shiftDate(T, -1),
      note: "Weekly — pushed from yesterday.",
      createdBy: "Maria Ruiz",
      createdAt: `${shiftDate(T, -2)}T14:00:00`,
      completed: false,
    },
    {
      id: "TD-9",
      title: "Count the petty cash drawer",
      category: "admin",
      priority: "low",
      assignedTo: "S-2",
      dueDate: shiftDate(T, 2),
      note: null,
      createdBy: "Sam Whitfield",
      createdAt: `${shiftDate(T, -1)}T17:00:00`,
      completed: false,
    },
    {
      id: "TD-10",
      title: "Replace the vacuum sealer bag roll",
      category: "maintenance",
      priority: "normal",
      assignedTo: null,
      dueDate: null,
      note: "New rolls are in the supply closet, top shelf.",
      createdBy: "Tyler Boyd",
      createdAt: `${shiftDate(T, -3)}T11:00:00`,
      completed: false,
    },
    {
      id: "TD-11",
      title: "Sweep and mop the packaging floor",
      category: "cleaning",
      priority: "low",
      assignedTo: null,
      dueDate: shiftDate(T, -2),
      note: null,
      createdBy: "Maria Ruiz",
      createdAt: `${shiftDate(T, -2)}T16:30:00`,
      completed: true,
      completedBy: "Jake Nowak",
      completedAt: `${shiftDate(T, -2)}T17:05:00`,
    },
  ],
};
