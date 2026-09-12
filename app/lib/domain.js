"use client";

/**
 * Domain model: stations, inventory, batch lifecycle, tasks, and the derived
 * numbers the screens read. Kept free of JSX so it can be unit-tested or moved
 * behind an API without touching the UI.
 */

import {
  Boxes,
  BroomSparkles,
  ClipboardList,
  FileText,
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

/* Stage order, names and icons come from `useStations()` (./stations.jsx);
 * this is only the seed it falls back to before anything is configured. */

/** The stations a fresh install starts with, and the fallback if the console
 *  has stored an empty list. */
export const STATIONS = ["Smokehouse", "Packaging"];

/** Target minutes in station, used to flag slow batches. */
export const STAGE_TARGET_MINUTES = { Smokehouse: 240, Packaging: 45 };

/** Yield below this is worth a manager's attention. */
export const LOW_YIELD_PCT = 75;

/* ------------------------------------------------------------- Identity -- */

export const initialsOf = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "?";

/* ------------------------------------------------------------------ Time -- */

export const todayKey = () => new Date().toISOString().slice(0, 10);

export function shiftDate(key, days) {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
 * Stock lives in one of three places: made is not yet put away, freezer is not
 * yet sellable. Clover only ever sees `floor`.
 */
export const STOCK_STATES = [
  { id: "made", label: "Made", short: "Made", hint: "produced, not put away" },
  { id: "freezer", label: "In stock", short: "Freezer", hint: "held in the freezer" },
  { id: "floor", label: "On floor", short: "Floor", hint: "sellable in Clover" },
];

const STATE_IDS = STOCK_STATES.map((s) => s.id);

export const stateLabel = (id) => STOCK_STATES.find((s) => s.id === id)?.label || id;

/** The short name is the PLACE, not the status: a stocking task says
 *  "40 lb freezer" (where to go), not "40 lb in stock". */
export const stateShort = (id) => STOCK_STATES.find((s) => s.id === id)?.short || id;

/** Icon for each stock state — shared by every screen that shows one. */
export const STATE_ICON = { made: PackageCheck, freezer: Snowflake, floor: Store };

/**
 * Broad families used by the floor filters. Only families present in the
 * catalogue are offered, so a long list costs nothing; a short one dumps half
 * the case into "Other".
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
 * Name → family, first rule wins. Order is the design, because meat names
 * overlap:
 *   "Prime Rib Roast"  — roasts must beat ribs
 *   "Ribeye Steak"     — steaks must beat ribs
 *   "Pork Loin Chop"   — chops must beat the loin/roast rule
 *   "Snack Sticks"     — sticks must beat sausage
 *   "Bratwurst"        — brats must beat sausage
 *   "Pork Belly"       — bellies are bacon
 * New keywords go in the most specific rung that can claim them.
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
 * Reorder point per family, in lb on the floor. Starting estimates by how fast
 * a family moves (ground and bacon turn daily, jerky sits for weeks), meant
 * to be overridden per product.
 */
const FAMILY_THRESHOLD = {
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
 * How full the case should be. The minimum answers "should I worry"; the max
 * answers "how much do I carry out", and it must sit above the minimum or a
 * stocker is back at the alert line the moment anything sells. Roughly twice
 * the minimum, rounded to 5, overridable per product.
 */
export const capacityFor = (threshold) =>
  Math.max(threshold + 5, Math.round((threshold * 2.2) / 5) * 5);

/** What the stocker should bring out to fill the case. */
export const refillQty = (item) => Math.max(0, +(item.max - stockIn(item, "floor")).toFixed(1));

/* The smallest batch worth running. Expressed as a GAP, not a level: a third
 * threshold ("top up to here") would still not know that the last few pounds
 * are not worth a changeover. A quarter of the case, rounded to 5, never
 * under 5; per-product and editable. */
export const defaultMinBatch = (max) =>
  Math.max(5, Math.round((Number(max) || 0) / 4 / 5) * 5);

/* Deliberately asymmetric: MAKING has a fixed cost (changeover, smokehouse
 * cycle), which `minBatch` measures. MOVING costs nothing, and a minimum there
 * would invent a reason to leave finished product in the back. */
export const worthMaking = (item, qty) =>
  qty > 0 && qty >= (item.minBatch ?? defaultMinBatch(item.max));
export const worthMoving = (qty) => qty > 0;

/** Older saved records predate `made` and `type`, so fill them in on read. */
export function normalizeItem(item) {
  const type = item.type || productType(item.product);
  // Max derives from the product's actual threshold, not its family default.
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
    // Likewise derived from the product's actual max.
    minBatch: item.minBatch ?? defaultMinBatch(item.max ?? capacityFor(threshold)),
  };
}

const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/**
 * The one writer for a product's stock band, so the invariant holds
 * everywhere: the smallest batch worth running can never exceed the whole
 * case (otherwise the gap can never close and the product reads "fine"
 * forever).
 */
export function setStockRange(item, { threshold, max, minBatch }) {
  const base = normalizeItem(item);
  const min = Math.max(0, num(threshold, base.threshold));
  const ceiling = Math.max(num(max, base.max), min);
  const batch = num(minBatch, base.minBatch ?? defaultMinBatch(ceiling));
  return { ...base, threshold: min, max: ceiling, minBatch: Math.max(0, Math.min(batch, ceiling)) };
}

export const stockIn = (item, state) => Number(item?.[state] ?? 0);

export const totalStock = (item) =>
  +STATE_IDS.reduce((sum, id) => sum + stockIn(item, id), 0).toFixed(1);

const isLow = (item) => stockIn(item, "floor") < item.threshold;

/** Stock standing behind the floor — what could be put out without making any. */
export const behindStock = (item) => +(stockIn(item, "made") + stockIn(item, "freezer")).toFixed(1);

/** How many lb short of the minimum the floor is. Zero when at or above par. */
export const floorDeficit = (item) =>
  Math.max(0, +(item.threshold - stockIn(item, "floor")).toFixed(1));

/* ------------------------------------------------------------------ Cover -- */

/** Under this many days of floor stock is worth acting on today. */
export const COVER_WARN_DAYS = 5;
const COVER_CRITICAL_DAYS = 2;

/**
 * Days the floor will last at the recent selling pace. No velocity, no
 * number: a made-up cover figure is worse than a blank.
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
 * How a product is doing, as a severity rather than an action. Out is the end
 * of the same ladder low sits on, not a separate bucket.
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
 * Deliberately overlaps `low`: not a fourth severity, but the subset of low
 * that costs nothing to fix.
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
 * One-tap version of `canPutOut`: everything behind the floor lands on it in
 * a single step. A no-op when nothing is behind.
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

/* ---------------------------------------------------------------- Batches -- */

/**
 * The two record factories the floor and the console both build through, so
 * the shapes cannot drift.
 *
 * `batchId` on a schedule entry links a plan to the batch it spawned: null
 * means "planned, nobody has started it", an id means "on the floor now".
 * Without it the two would be counted twice.
 */
export function makeScheduleEntry({ product, qty, unit = "lb", batchId = null }) {
  return {
    id: newId("T"),
    text: product,
    qty: Number(qty) || 0,
    unit: unit || "lb",
    batchId,
  };
}

export function makeBatch({ product, qty, station, startedAt }) {
  return {
    id: newId("B"),
    product,
    estWeight: Number(qty) || 0,
    boxWeight: null,
    stage: station,
    // A fact about smoking meat, not about the station list — see stations.jsx.
    needsSmoke: station === "Smokehouse",
    destination: null,
    startedAt,
  };
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

/**
 * What kind of thing a station's clock is measuring. When the minutes are the
 * CREW'S WORK, faster is better. When they belong to the PRODUCT (a cook or
 * cure), a batch that leaves early is undercooked, not ahead of schedule.
 *
 * The kind sets the tolerance on each side, the column's name, and how loudly
 * a miss is reported. The sides are deliberately asymmetric: running long is
 * a scheduling problem (15%); running short is the dangerous direction (5%).
 */
const STATION_KIND = {
  workstation: {
    label: "Workstation",
    blurb: "The time is the crew's work — cutting, packing, loading. Faster is a better day.",
    /** What this station's number is called, in the table and the dialog. */
    noun: "Target",
    over: 0.15,
    /** null means a short run is never a miss — it is just a good day. */
    under: null,
  },
  process: {
    label: "Process",
    blurb: "The time belongs to the product — a cook, chill, cure or brine. The schedule is the requirement.",
    noun: "Schedule",
    over: 0.15,
    under: 0.05,
  },
};

const DEFAULT_STATION_KIND = "workstation";

const kindOf = (config) => {
  if (STATION_KIND[config?.kind]) return config.kind;
  /* Legacy `flagUnder` checkbox in localStorage meant exactly "process";
   * honour it so the setting does not silently switch off. */
  if (config?.flagUnder) return "process";
  return DEFAULT_STATION_KIND;
};

/** The kind supplies the defaults; a station may override either side. A
 *  `null` on a side means that side is never a miss. */
const toleranceFor = (config) => {
  const kind = STATION_KIND[kindOf(config)];
  return {
    over: config?.overPct !== undefined ? config.overPct : kind.over,
    under: config?.underPct !== undefined ? config.underPct : kind.under,
  };
};

/**
 * How a run missed, or null if it did not: "slow" (over) or "short" (under).
 * Two names, not a boolean: short on a process station is a batch that may
 * not be shippable. `targets` and `configs` are passed in so this stays pure.
 */
const targetMiss = (station, minutes, targets = {}, configs = {}) => {
  const target = targets[station] ?? STAGE_TARGET_MINUTES[station];
  if (minutes == null || target == null) return null;
  const { over, under } = toleranceFor(configs[station]);
  if (over != null && minutes > target * (1 + over)) return "slow";
  if (under != null && minutes < target * (1 - under)) return "short";
  return null;
};

/** The narrow "is it slow" question, which is all Insights asks. `targets`
 *  overrides the default per-station minutes. */
export const isOverTarget = (station, minutes, targets = {}) =>
  targetMiss(station, minutes, targets) === "slow";

let idCounter = 0;
/** Sequential, readable, and stable across a render pass. */
export function newId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36).slice(-4)}${idCounter.toString(36)}`.toUpperCase();
}

/* -------------------------------------------------------------- Tasks ---- */

/**
 * Tasks are their own list rather than riding on batches or the schedule: a
 * task can exist with nothing behind it and outlives a single shift.
 *
 * Category icons are stored as a string id, not a component: the category
 * list is persisted state, and a component reference doesn't survive JSON.
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

/** A category can't be removed while a task still points at it. */
export const categoryInUse = (tasks, id) => tasks.some((t) => t.category === id);

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"];
export const PRIORITY_LABEL = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export const PRIORITY_TONE = { low: "neutral", normal: "info", high: "warn", urgent: "danger" };
const priorityRank = (p) => Math.max(0, TASK_PRIORITIES.indexOf(p));

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

/* ------------------------------------------------- Opening state (seeded) -- */

const T = todayKey();

export const SEED = {
  batches: [
    { id: "B-1047", product: "Applewood Bacon", estWeight: 52, boxWeight: 52, stage: "Packaging", needsSmoke: true, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1048", product: "Bratwurst - Jalapeño Cheddar", estWeight: 38, boxWeight: null, stage: "Packaging", needsSmoke: false, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1049", product: "Snack Sticks - Hot", estWeight: 22, boxWeight: null, stage: "Smokehouse", needsSmoke: true, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1050", product: "Bratwurst - Maple", estWeight: 24, boxWeight: null, stage: "Packaging", needsSmoke: false, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1051", product: "Peppered Bacon", estWeight: 44, boxWeight: null, stage: "Smokehouse", needsSmoke: true, destination: null, startedAt: shiftDate(T, 0) },
    { id: "B-1044", product: "Summer Sausage", estWeight: 34, boxWeight: 40, stage: "Shelf-Ready", needsSmoke: true, destination: "floor", finalWeight: 34, startedAt: shiftDate(T, -1) },
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
    { product: "Applewood Bacon", made: 12, freezer: 30, floor: 18, threshold: 45, unit: "lb" },
    { product: "Peppered Bacon", made: 0, freezer: 10, floor: 22, threshold: 30, unit: "lb" },
    { product: "Pork Bellies - Raw", made: 88, freezer: 40, floor: 0, threshold: 60, unit: "lb" },
    { product: "Summer Sausage", made: 0, freezer: 15, floor: 62, threshold: 28, unit: "lb" },
    { product: "Bratwurst - Original", made: 0, freezer: 0, floor: 78, threshold: 35, unit: "lb" },
    { product: "Bratwurst - Jalapeño Cheddar", made: 16, freezer: 25, floor: 14, threshold: 24, unit: "lb" },
    { product: "Bratwurst - Maple", made: 0, freezer: 5, floor: 9, threshold: 16, unit: "lb" },
    { product: "Snack Sticks - Original", made: 0, freezer: 0, floor: 20, threshold: 22, unit: "lb" },
    { product: "Snack Sticks - Honey BBQ", made: 9, freezer: 18, floor: 12, threshold: 15, unit: "lb" },
    { product: "Snack Sticks - Hot", made: 0, freezer: 0, floor: 27, threshold: 20, unit: "lb" },
    { product: "Beef Jerky - Original", made: 0, freezer: 22, floor: 31, threshold: 14, unit: "lb" },
    { product: "Beef Jerky - Teriyaki", made: 5, freezer: 8, floor: 22, threshold: 8, unit: "lb" },
    { product: "Ground Beef - 80/20", made: 0, freezer: 35, floor: 52, threshold: 50, unit: "lb" },
    { product: "Pork Chops - Center Cut", made: 0, freezer: 12, floor: 26, threshold: 25, unit: "lb" },
    { product: "Prime Rib Roast", made: 0, freezer: 18, floor: 9, threshold: 12, unit: "lb" },
    // Names below match the Clover sandbox catalogue 1:1 so these numbers
    // stand in for the 0 lb the sandbox reports (it has no numeric inventory).
    { product: "85-15 Ground Beef", made: 0, freezer: 38, floor: 46, threshold: 40, unit: "lb" },
    { product: "Tomahawk Steak", made: 0, freezer: 33, floor: 17, threshold: 25, unit: "lb" },
    { product: "Filet Mignon Steak", made: 0, freezer: 22, floor: 28, threshold: 25, unit: "lb" },
    { product: "T-Bone Steak", made: 0, freezer: 36, floor: 16, threshold: 25, unit: "lb" },
    { product: "New York Strip Steak", made: 0, freezer: 24, floor: 31, threshold: 25, unit: "lb" },
    { product: "Bone-In Ribeye Steak", made: 0, freezer: 34, floor: 18, threshold: 25, unit: "lb" },
    { product: "Baby Back Ribs", made: 0, freezer: 24, floor: 16, threshold: 20, unit: "lb" },
    { product: "Smoked Ham", made: 0, freezer: 20, floor: 21, threshold: 18, unit: "lb" },
    { product: "Ring Bologna", made: 0, freezer: 6, floor: 7, threshold: 10, unit: "lb" },
    { product: "House Brats", made: 0, freezer: 20, floor: 19, threshold: 30, unit: "lb" },
    { product: "Bone-In Pork Chops", made: 0, freezer: 20, floor: 14, threshold: 25, unit: "lb" },
    { product: "Boneless Chuck Roast", made: 0, freezer: 14, floor: 11, threshold: 15, unit: "lb" },
    { product: "Sirloin Steak", made: 0, freezer: 28, floor: 20, threshold: 25, unit: "lb" },
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
    /* Demo runs booked ahead so the "Planned" tab has content. Spread across
     * +3..+5 so at least some land on weekdays; Targets skips weekends. */
    [shiftDate(T, 3)]: {
      Smokehouse: [
        { id: "T-06", text: "Bratwurst - Jalapeño Cheddar", qty: 30, unit: "lb" },
        { id: "T-07", text: "Tomahawk Steak", qty: 25, unit: "lb" },
        { id: "T-08", text: "Baby Back Ribs", qty: 20, unit: "lb" },
      ],
      Packaging: [
        { id: "T-09", text: "Snack Sticks - Original", qty: 32, unit: "lb" },
        { id: "T-10", text: "Ring Bologna", qty: 14, unit: "lb" },
      ],
    },
    [shiftDate(T, 4)]: {
      Smokehouse: [
        { id: "T-11", text: "T-Bone Steak", qty: 12, unit: "lb" },
        { id: "T-12", text: "Prime Rib Roast", qty: 16, unit: "lb" },
      ],
      Packaging: [
        { id: "T-13", text: "Snack Sticks - Honey BBQ", qty: 24, unit: "lb" },
      ],
    },
    [shiftDate(T, 5)]: {
      Smokehouse: [{ id: "T-14", text: "Bone-In Ribeye Steak", qty: 18, unit: "lb" }],
      Packaging: [{ id: "T-15", text: "Bratwurst - Maple", qty: 22, unit: "lb" }],
    },
  },

  /** Floor tasks: stocking call-outs and general tasks, some open to anyone
   *  on shift and some assigned. */
  tasks: [
    {
      id: "TD-1",
      title: "Move Pork Bellies to the prep table",
      category: "stocking",
      priority: "urgent",
      assignedTo: null,
      dueDate: T,
      note: "88 lb raw in the freezer — smokehouse needs it for tomorrow's bacon run.",
      createdBy: "Dana Whitfield",
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
      assignedTo: null,
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
      assignedTo: null,
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
      createdBy: "Dana Whitfield",
      createdAt: `${shiftDate(T, 0)}T06:00:00`,
      completed: true,
      completedBy: "Shop floor",
      completedAt: `${shiftDate(T, 0)}T09:12:00`,
    },
    {
      id: "TD-7",
      title: "Print new price tags for Snack Sticks - Hot",
      category: "admin",
      priority: "normal",
      assignedTo: "U-2",
      dueDate: shiftDate(T, 1),
      note: "New case price starts tomorrow.",
      createdBy: "Dana Whitfield",
      createdAt: `${shiftDate(T, -1)}T15:30:00`,
      completed: false,
    },
    {
      id: "TD-8",
      title: "Deep clean the smokehouse racks",
      category: "cleaning",
      priority: "normal",
      assignedTo: null,
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
      assignedTo: "U-3",
      dueDate: shiftDate(T, 2),
      note: null,
      createdBy: "Dana Whitfield",
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
      createdBy: "Marcus Reed",
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
      completedBy: "Shop floor",
      completedAt: `${shiftDate(T, -2)}T17:05:00`,
    },
  ],
};
