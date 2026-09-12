"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpFromLine,
  Check,
  CalendarPlus,
  Factory,
  Clock,
  Package,
  Palette,
  TriangleAlert,
  SlidersHorizontal,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Popover,
  SectionHeading,
  Segmented,
  Slot,
  StickyFadeHeader,
  Tooltip,
  cx,
} from "../../components/ui";
import {
  behindStock,
  defaultMinBatch,
  normalizeItem,
  refillQty,
  stockIn,
  shiftDate,
  worthMaking,
  worthMoving,
} from "../../lib/domain";

/**
 * Console-side production targets: what is on the floor, the min/max it
 * should sit between, and what to plan to get there.
 *
 * Numbers use the domain's vocabulary: `threshold` is the min, `max` the
 * fill target, `refillQty` the gap from floor to max, `behindStock` what
 * could be put out without making anything. That last one is why the
 * recommendation is split into "move N" and "make M" — "plan 82 lb" is
 * wrong when 42 lb of it is already in the freezer.
 *
 * Vocabulary: the console SCHEDULES A BATCH (never "run"/"book"). The floor
 * terminal calls an in-progress job a batch; this is the same object earlier
 * in its life. "Planned" is a batch nobody has touched (the `schedule` map),
 * "In production" is one that physically exists (the `batches` array); the
 * two stores are separate and `handleAddScheduleTask` never writes to the
 * second.
 */

/* Colour only where it discriminates. The BADGE says how much trouble a
 * product is in, and only trouble earns a hue (`out` danger, `below` warn,
 * rest neutral). The BAR bands are a categorical question — told apart, not
 * ranked — so they are distinct hues, not a tint ramp. Four bands: how far a
 * batch is through the smokehouse is the floor's question, not a planning
 * one. */
const STATE = {
  /* Empty and under par are different problems: one has a customer standing
   * in front of the case, the other is a number trending the wrong way. */
  out: { label: "Out", tone: "danger", rank: 0 },
  below: { label: "Low", tone: "warn", rank: 1 },
  make: { label: "Needs a batch", tone: "neutral", rank: 2 },
  move: { label: "Move from back", tone: "neutral", rank: 3 },
  planned: { label: "Planned", tone: "neutral", rank: 4 },
  /* Above its minimum AND the remaining gap is too small to be worth an
   * action. Both halves matter: above the minimum alone may still leave a
   * real hole, and a small gap alone can still be an emergency (2 lb on a
   * 60 lb minimum). Ranked under `planned` (which has a person's name on it)
   * and above `full` (which has no question at all). */
  fine: { label: "Fine", tone: "neutral", rank: 5 },
  /* "At target", not "On hand" — "On hand" names a band on the bar, and one
   * screen cannot have it mean two things. Rarely renders (badges are
   * out/below only) but matches the row's own fallback text. */
  full: { label: "At target", tone: "neutral", rank: 6 },
};

/* The sections, in order. A ranking never says "from here down, nothing";
 * a grouping does. NEEDS YOU: something is wrong and you can act. WORTH A
 * TOP-UP: nothing wrong, but a hole worth filling. COVERED: short, and
 * nothing you can do. FINE: nothing to do. The last two collapse — on a
 * normal morning this screen should be three rows tall and a count. */
const GROUPS = [
  {
    id: "needs",
    label: "Needs you",
    icon: TriangleAlert,
    /* Something is wrong AND you can fix it — see `covered` for why the
     * second half matters. */
    match: (r) => (r.state === "out" || r.state === "below") && r.hasAction,
  },
  {
    id: "worth",
    label: "Worth a top-up",
    icon: ArrowUpFromLine,
    /* Keyed on whether there is anything to DO, not on the state name: a
     * product whose batch is booked can still have freezer stock worth
     * carrying out. */
    match: (r) => r.hasAction,
  },
  {
    id: "covered",
    label: "Covered",
    icon: Clock,
    /* Below the minimum with no button to press (batch booked, back empty).
     * Not NEEDS YOU — a list that asks for something it cannot accept is
     * worse than one that stays quiet. Not FINE either — a case short of
     * its minimum is short today, whatever lands next Tuesday. */
    match: (r) => r.state === "out" || r.state === "below",
    collapsible: true,
  },
  {
    id: "fine",
    label: "Fine",
    icon: Check,
    /* Catch-all: above minimum, nothing worth doing. Each row still says
     * which flavour of fine in its own quiet text. */
    match: () => true,
    collapsible: true,
  },
];


/* The bar's legend, in draw order: closest-to-sold through to
 * nobody-has-arranged-it, so reading the key top to bottom reads the
 * pipeline. The remainder is bare track ("Till full"), not a fill.
 *
 * Two naming rules for that remainder: it names its DESTINATION, not its
 * status (status words like "unassigned" read as a sixth pile of meat), and
 * it names the destination the way the shop says it, not the schema —
 * "max" is a field, "full" is a case. "0 till full" and state `full` are
 * the same fact. */
const BANDS = [
  { key: "floor", label: "On floor", swatch: "bg-stage-floor" },
  { key: "onhand", label: "On hand", swatch: "bg-stage-onhand" },
  { key: "production", label: "In production", swatch: "bg-stage-production" },
  { key: "planned", label: "Planned", swatch: "bg-stage-planned" },
];

/* Where back stock is pulled from, in order. The bar shows one "On hand"
 * band, but the domain tracks two places (`made` sitting out, `freezer` put
 * away cold), and the split belongs on the task somebody walks with: "88 off
 * the made pile, 40 out of the freezer" is a route. Made first because it is
 * already out and at temperature and meant to be transient; the freezer is
 * the reserve. */
const PULL_ORDER = ["made", "freezer"];

/** Split an amount across the back locations, made first. */
function splitPull(item, amount) {
  let left = amount;
  const out = [];
  for (const where of PULL_ORDER) {
    if (left <= 0) break;
    const have = stockIn(item, where);
    const take = Math.min(have, left);
    if (take > 0) {
      out.push({ where, qty: +take.toFixed(1) });
      left -= take;
    }
  }
  return out;
}

const WHERE_LABEL = { made: "the made pile", freezer: "the freezer" };
const pullSentence = (parts, unit) =>
  parts.map((p) => `${Math.round(p.qty)} ${unit} from ${WHERE_LABEL[p.where]}`).join(", ");

export default function ProductionScreen({
  schedule,
  inventory,
  batches = [],
  today,
  stations,
  onSetRange,
  onAddTask,
  onAddTasks,
  tasks = [],
  onAddStocking,
}) {
  const [rangesOpen, setRangesOpen] = useState(false);
  /* How much of the column each bar's track occupies — see the Segmented. */
  const [lengthMode, setLengthMode] = useState("fill");
  const [keyOpen, setKeyOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  /* Collapsible groups start closed: they are the rows you came here NOT
   * to read. */
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const toggleGroup = (id) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* Where an accepted plan lands: the next production day AFTER today.
   * Planning from the console never spawns a live batch (see
   * handleAddScheduleTask); today's run is underway and belongs to the floor
   * terminal, a manager at a desk is committing the days ahead. */
  const defaultDay = useMemo(() => {
    for (let i = 1; i <= 7; i += 1) {
      const key = shiftDate(today, i);
      const dow = new Date(`${key}T00:00:00`).getDay();
      if (dow !== 0 && dow !== 6) return key;
    }
    return shiftDate(today, 1);
  }, [today]);

  /* Built by hand rather than one toLocaleDateString call: asking Intl for
   * weekday + day together renders "7 Mon" in en-US, which reads as a typo. */
  const defaultDayLabel = useMemo(() => {
    const d = new Date(`${defaultDay}T00:00:00`);
    return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()}`;
  }, [defaultDay]);

  const rows = useMemo(() => {
    /* What is already committed per product, as two piles: a batch that
     * physically exists, and a line booked on a future day nobody has
     * touched. Both count as "committed" for classification; the bar draws
     * them apart. */
    const scheduled = new Map();
    const inProduction = new Map();
    /* `unit`, when given, must match the product's own unit or the quantity
     * is skipped — a plan measured in racks is not pounds of bacon. Entries
     * with no unit (a batch, a stocking task) are counted as-is. */
    const unitOf = new Map(inventory.map((i) => [i.product, i.unit || "lb"]));
    const bump = (map, product, n, unit) => {
      if (unit != null && unit !== (unitOf.get(product) || "lb")) return;
      map.set(product, (map.get(product) || 0) + n);
    };

    /* A rolling window forward, not the rest of the calendar week — on a
     * Friday a week-bounded scan would see no plan at all. Today is in the
     * window: a started line carries its `batchId` and is skipped here
     * because `inProduction` already counts that batch; unstarted lines are
     * real committed work. */
    for (let i = 0; i <= 7; i += 1) {
      const key = shiftDate(today, i);
      const dow = new Date(`${key}T00:00:00`).getDay();
      if (dow === 0 || dow === 6) continue; // no production at the weekend
      for (const station of stations) {
        for (const t of (schedule[key] || {})[station] || []) {
          if (t.batchId) continue; // already a live batch — counted below
          bump(scheduled, t.text, Number(t.qty) || 0, t.unit);
        }
      }
    }
    /* Every unfinished batch counts the same regardless of stage; from a
     * planning desk the only question is "is this quantity already coming?". */
    for (const b of batches) {
      if (b.finalWeight != null) continue; // already landed in stock
      const qty = Number(b.boxWeight ?? b.estWeight) || 0;
      bump(inProduction, b.product, qty);
    }

    /* Moves already asked for. A stocking task changes nothing in inventory
     * until somebody carries the boxes, so without this the screen re-offers
     * "Stock 42" every time it opens. Matched on the task's `product` field,
     * not its title. */
    const stocking = new Map();
    for (const t of tasks) {
      if (t.completed || t.category !== "stocking" || !t.product) continue;
      bump(stocking, t.product, Number(t.qty) || 0);
    }

    return inventory
      .map(normalizeItem)
      .map((item) => {
        const floor = stockIn(item, "floor");
        const behind = behindStock(item);
        const refill = refillQty(item);
        const fromBack = Math.min(refill, behind);
        const stockingQty = stocking.get(item.product) || 0;
        const stillToStock = Math.max(0, Math.round(fromBack - stockingQty));
        /* Back stock somebody has already been sent for. CLAMPED for the
         * availability maths, RAW for anything shown to a person: they
         * diverge when somebody overrides the counts (ask for 33 off a shelf
         * the records say holds 20), and a row saying "20 queued" against a
         * task reading "Restock 33 lb" looks like the instruction did not
         * land. */
        const queuedStock = Math.round(Math.min(stockingQty, fromBack));
        const queuedRaw = Math.round(stockingQty);
        const toMake = Math.max(0, +(refill - behind).toFixed(1));
        const scheduledQty = scheduled.get(item.product) || 0;
        const inProductionQty = inProduction.get(item.product) || 0;
        const planned = scheduledQty + inProductionQty;

        /* Min is the trigger, max is only the target. Two ways onto the
         * list: URGENT (below the minimum; offered regardless of how small
         * the fix, because running out is loud and a small batch is only a
         * changeover) and WORTH IT (above the minimum but a hole big enough
         * to fill: moving qualifies at any size, making must clear the
         * product's minimum batch). Everything else is `fine`. */
        const stillToMake = Math.max(0, Math.round(toMake - planned));
        const urgent = floor < item.threshold;
        const canOffer =
          worthMoving(stillToStock) || worthMaking(item, stillToMake);

        /* Order matters: being below the minimum outranks having a plan. A
         * booked batch lands next week; the floor is short today. */
        let state;
        if (refill <= 0) state = "full";
        else if (floor <= 0) state = "out";
        else if (urgent) state = "below";
        else if (planned >= toMake && toMake > 0) state = "planned";
        else if (!canOffer) state = "fine";
        else if (stillToMake > 0) state = "make";
        else state = "move";

        /* Computed once here so the row and its section cannot disagree
         * about whether there is a button. */
        const canMakeNow =
          stillToMake > 0 && (urgent || worthMaking(item, stillToMake));
        const hasAction = worthMoving(stillToStock) || canMakeNow;

        return {
          item,
          floor,
          behind,
          refill,
          fromBack,
          stillToStock,
          queuedStock,
          queuedRaw,
          toMake,
          planned,
          stillToMake,
          hasAction,
          canMakeNow,
          scheduled: scheduledQty,
          inProduction: inProductionQty,
          state,
        };
      })
      .sort(
        (a, b) =>
          STATE[a.state].rank - STATE[b.state].rank ||
          b.refill - a.refill ||
          a.item.product.localeCompare(b.item.product),
      );
  }, [inventory, schedule, batches, tasks, today, stations]);

  /* Only "attention" rows feed the header — a planned or on-hand product
   * has nothing left to decide. */
  const attention = useMemo(
    () => rows.filter((r) => ["out", "below", "make", "move"].includes(r.state)),
    [rows],
  );

  const groupOf = (r) => GROUPS.findIndex((g) => g.match(r));
  const countIn = (gi) => rows.filter((r) => groupOf(r) === gi).length;
  const needsCount = countIn(0);
  const worthCount = countIn(1);
  const coveredCount = countIn(2);
  const fineCount = countIn(3);
  /* Only batches worth running. A product still below its minimum stays in
   * regardless of size — see the classification above for the asymmetry. */
  const runnable = attention.filter(
    (r) =>
      worthMaking(r.item, Math.round(r.toMake - r.planned)) ||
      (r.floor < r.item.threshold && r.toMake - r.planned >= 1),
  );

  /* Scale mode's shared ruler: the largest target in the catalogue takes the
   * full column, everything else takes its honest fraction of that. */
  const biggestMax = useMemo(
    () => rows.reduce((n, r) => Math.max(n, r.item.max || 0), 0),
    [rows],
  );
  const trackPctFor = (item) => {
    if (lengthMode !== "scale" || biggestMax <= 0) return 100;
    /* Hard floor of 4%, a small deliberate lie: below that a track cannot
     * show its fill, hold a hover, or carry the minimum tick. */
    return Math.max(4, ((item.max || 0) / biggestMax) * 100);
  };

  /* The bulk proposal only — the button opens a review, it does not commit.
   * A mis-click here is multiplied by the number of rows. */
  const bulkTasks = runnable
    .map((r) => ({
      day: defaultDay,
      station: stations[0],
      product: r.item.product,
      qty: Math.max(0, Math.round(r.toMake - r.planned)),
      unit: r.item.unit,
    }))
    .filter((t) => t.qty > 0);

  const commitBulk = (tasks) => {
    if (tasks.length === 0) return;
    if (onAddTasks) onAddTasks(tasks);
    else tasks.forEach((t) => onAddTask(t.day, t.station, t.product, t.qty, t.unit));
    setBulkOpen(false);
  };

  return (
    <div>
      {/* Min & max is a settings dialog, opened monthly at best, so it sits
       *  with the page title rather than in the everyday toolbar — which
       *  also keeps the bulk button aligned above the Delegate column. */}
      {/* Posted through `Slot` so the button and its handler stay in one
       *  file. */}
      <Slot name="page-actions">
        <Tooltip label="Levels by product">
          <IconButton
            label="Levels by product"
            icon={SlidersHorizontal}
            onClick={() => setRangesOpen(true)}
          />
        </Tooltip>
      </Slot>

      {/* z=50, not the default 10: a hovered band sits at z-10 and the
       *  minimum tick at z-20, and `PlanMeter`'s wrapper (relative, auto
       *  z-index) opens no stacking context to contain them, so a row
       *  scrolling under the toolbar would paint its tick through it. */}
      <StickyFadeHeader pad={28} z={50}>
        {/* Mode and key live in the toolbar with the other whole-list
         *  controls, and stay pinned so the key is still on screen at row
         *  forty. */}
        {/* px-2 matches the list rows' padding so columns line up. */}
        <div className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap px-2">
          <div className="flex items-center gap-3 flex-wrap">
          {/* Fill / Scale — what the LENGTH of a track means. Fill: every
           *  track is the full column, read against its own product's max;
           *  right for "which products need a decision", wrong for comparing
           *  rows. Scale: one ruler for the catalogue, so a pound is the
           *  same distance on every row. A MODE rather than a default so
           *  the reader chose it and can see which choice is live. */}
            {/* Bare chips, no track: a bordered box around a group is the
             *  one structure this design system bans, and the border made
             *  the control 34px tall in a row of 28px controls. */}
            <Segmented
              size="sm"
              value={lengthMode}
              onChange={setLengthMode}
              options={[
                {
                  value: "fill",
                  label: "Fill",
                  hint: "Every bar fills the column — each one read against its own product's max",
                },
                {
                  value: "scale",
                  label: "Scale",
                  hint: "One scale for all products — bar length is the size of the target, so rows compare",
                },
              ]}
            />
            {/* The key sits with Fill/Scale because both answer "how to read
             *  the bars"; the right-hand side answers "what to do about
             *  them". It floats rather than taking a line under the toolbar,
             *  so the bars do not move while you consult it. */}
            {/* `Popover` portals it and positions it fixed for a reason:
             *  this toolbar is a `StickyFadeHeader`, whose mask-image clips
             *  its subtree, so an absolutely-positioned panel would be cut
             *  off at the padding edge and faded by the gradient.
             *  Start-aligned because the icon is at the left of the row. */}
            <Popover
              open={keyOpen}
              onClose={() => setKeyOpen(false)}
              align="start"
              label="What the colours on the bars mean"
              panelClassName="p-3"
              content={
                <ul className="flex flex-col gap-1.5 text-xs text-ink-2 whitespace-nowrap">
                  {BANDS.map((b) => (
                    <li key={b.key} className="flex items-center gap-2">
                      <span className={cx("w-2.5 h-2.5 rounded-full shrink-0", b.swatch)} />
                      {b.label}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-line border border-line-strong" />
                    Till full
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-[3px] h-3 rounded-full shrink-0 bg-ink mx-[3.5px]" />
                    Minimum
                  </li>
                </ul>
              }
            >
              {/* Suppressed while the panel is up: the pointer is still on
               *  the icon after the click, so the tooltip would fire on top
               *  of the panel it just opened. */}
              <Tooltip label="What the colours mean" disabled={keyOpen}>
                <IconButton
                  label="Colour key"
                  icon={Palette}
                  aria-expanded={keyOpen}
                  onClick={() => setKeyOpen((v) => !v)}
                  className={keyOpen ? "bg-hover text-icon" : undefined}
                />
              </Tooltip>
            </Popover>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* The shape of the morning: how many need me, how many are
             *  worth a look, how many I can ignore. "N fine" is what gives
             *  the other two scale. */}
            <span className="text-xs tnum">
              {needsCount > 0 && (
                <span className="text-danger font-medium">{needsCount} need you</span>
              )}
              {needsCount > 0 && worthCount > 0 && (
                <span className="text-ink-3"> · </span>
              )}
              {worthCount > 0 && (
                <span className="text-ink-2">{worthCount} worth a top-up</span>
              )}
              {(needsCount > 0 || worthCount > 0) && fineCount + coveredCount > 0 && (
                <span className="text-ink-3"> · </span>
              )}
              {fineCount + coveredCount > 0 && (
                <span className="text-ink-3">{fineCount + coveredCount} fine</span>
              )}
            </span>
            {bulkTasks.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={CalendarPlus}
                onClick={() => setBulkOpen(true)}
              >
                Schedule {bulkTasks.length}{" "}
                {bulkTasks.length === 1 ? "batch" : "batches"}&hellip;
              </Button>
            )}
            {/* Min & max is icon-only and up in the page actions: settings
             *  should not sit at the same weight as the everyday action. */}
          </div>
        </div>

      </StickyFadeHeader>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Check} title="No products yet" description="Add products from Inventory to see targets here." />
        </Card>
      ) : (
        <div>
          {/* Striped, not ruled: a tint separates by contrast alone and is
           *  the guide rail for tracking a bar across to its button. The
           *  stripe restarts inside each section so a group always opens on
           *  white. */}
          {GROUPS.map((g, gi) => {
            /* First match wins, so every row lands in exactly one section
             * and the counts add up to the catalogue. */
            const items = rows.filter(
              (r) => GROUPS.findIndex((x) => x.match(r)) === gi,
            );
            if (items.length === 0) return null;
            const open = !g.collapsible || openGroups.has(g.id);
            return (
              <section key={g.id} className="mb-5 last:mb-0">
                {/* The heading is the containing device; `pl-6` on the list
                 *  closes the group at the other end. */}
                {g.collapsible ? (
                  /* Only the no-action groups collapse — collapsing NEEDS
                   *  YOU would be offering to hide the work. */
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleGroup(g.id)}
                    className="w-full text-left rounded-md -mx-1 px-1 hover:bg-faint transition-colors duration-100"
                  >
                    <SectionHeading icon={g.icon} label={g.label} count={items.length} />
                  </button>
                ) : (
                  <SectionHeading icon={g.icon} label={g.label} count={items.length} />
                )}

                {open && (
                  <ul className="pl-6">
                    {items.map((row, i) => (
                      <PlanRow
                        key={row.item.product}
                        row={row}
                        defaultDay={defaultDay}
                        defaultDayLabel={defaultDayLabel}
                        onAddTask={onAddTask}
                        onAddStocking={onAddStocking}
                        striped={i % 2 === 1}
                        trackPct={trackPctFor(row.item)}
                        stations={stations}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {bulkOpen && (
        <BulkBookModal
          tasks={bulkTasks}
          dayLabel={defaultDayLabel}
          stations={stations}
          onClose={() => setBulkOpen(false)}
          onConfirm={commitBulk}
        />
      )}

      {rangesOpen && (
        <RangesModal
          inventory={inventory}
          onSetRange={onSetRange}
          onClose={() => setRangesOpen(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ parts -- */

/**
 * The pipeline bar for one product: floor, back stock that could be put out
 * today, batches that physically exist, batches booked but untouched, and
 * bare track for the distance still to max.
 *
 * Each band is its own hover target with its own number, positioned on the
 * pointer (`followCursor` is load-bearing — a segment can be most of the
 * bar's width). `adding` is the ghost of an amount being typed in the
 * modal: where the bar would reach if that batch were booked.
 */
function PlanMeter({ row, adding = 0, trackPct = 100 }) {
  const { item, floor, fromBack, inProduction, scheduled } = row;
  const max = item.max;
  const pct = (n) => (max > 0 ? Math.max(0, Math.min(100, (n / max) * 100)) : 0);

  const cFloor = floor;
  const cOnHand = cFloor + fromBack;
  const cProduction = cOnHand + inProduction;
  const cPlanned = cProduction + scheduled;
  const tillMax = Math.max(0, max - cPlanned);

  /* Discrete [start, end] segments rather than cumulative spans from zero,
   * so a band can be hovered and resized without its neighbours moving.
   * Each segment is stretched left by CAP_TUCK and they are painted right
   * to left, so every rounded left cap lands under the segment drawn after
   * it and the bar reads as continuous. */
  const SEGMENTS = [
    { key: "floor", from: 0, to: cFloor, swatch: "bg-stage-floor", label: `${Math.round(floor)} ${item.unit} on floor` },
    { key: "onhand", from: cFloor, to: cOnHand, swatch: "bg-stage-onhand", label: `${Math.round(fromBack)} ${item.unit} on hand, ready to move` },
    { key: "production", from: cOnHand, to: cProduction, swatch: "bg-stage-production", label: `${Math.round(inProduction)} ${item.unit} in production` },
    { key: "planned", from: cProduction, to: cPlanned, swatch: "bg-stage-planned", label: `${Math.round(scheduled)} ${item.unit} planned` },
  ].filter((s) => s.to > s.from);

  /* Overlap is one full bar height, not one radius. At one radius the two
   * caps still curve against each other and the union pinches to ~87% in
   * the middle — a visible notch. For a cap to read as a colour boundary
   * the band behind it must be at full height across the whole curve, and
   * a band only reaches full height one radius in, so the tuck is two
   * radii: 14px, the hovered band height, so the seam holds in that state
   * too. The first segment starts flush at zero — a negative offset there
   * pokes out of the track. */
  const CAP_TUCK = 14;
  const place = (s, i) =>
    i === 0
      ? { left: 0, width: `${pct(s.to)}%` }
      : {
          left: `calc(${pct(s.from)}% - ${CAP_TUCK}px)`,
          width: `calc(${pct(s.to) - pct(s.from)}% + ${CAP_TUCK}px)`,
        };

  return (
    /* Three boxes deep: a fixed 16px hover area so the row never twitches,
     * a 14px stage for a grown segment, and the 10px resting track. */
    <div
      className="relative h-4 flex items-center transition-[width] duration-300 ease-out motion-reduce:transition-none"
      style={{ width: `${trackPct}%` }}
    >
      <div className="relative w-full h-3.5">
        {/* The resting track. Its hover names the max and the distance to
         *  it — neither is printed anywhere else on the row. */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-line">
          <span aria-hidden="true" className="absolute inset-0">
            <Tooltip
              label={`Maximum ${max} ${item.unit} · ${Math.round(tillMax)} ${item.unit} till full`}
              className="w-full h-full"
              disabled={tillMax <= 0}
              followCursor
            />
          </span>
        </div>

        {/* The typed amount, in the gap it would fill. Not hoverable: it is
         *  a preview, not a thing to inspect. */}
        {adding > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 h-2.5 pointer-events-none rounded-full bg-cold-soft transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
            style={{
              left: `calc(${pct(cPlanned)}% - 14px)`,
              width: `calc(${pct(Math.min(max, cPlanned + adding)) - pct(cPlanned)}% + 14px)`,
            }}
          />
        )}

        {/* Right to left, so each cap tucks under its left-hand neighbour. */}
        {[...SEGMENTS].reverse().map((s) => {
          const i = SEGMENTS.indexOf(s);
          return (
            <span
              key={s.key}
              aria-hidden="true"
              /* 10px at rest, 14px on its own hover (the band, not the
               * bar). Centred so it thickens outward instead of dropping. */
              className={cx(
                "absolute top-1/2 -translate-y-1/2 h-2.5 hover:h-3.5 rounded-full hover:z-10",
                "transition-[height,left,width] duration-[120ms] ease-out motion-reduce:transition-none",
                s.swatch,
              )}
              style={place(s, i)}
            >
              <Tooltip label={s.label} className="w-full h-full" followCursor />
            </span>
          );
        })}

        {/* The minimum tick. Ink, not amber: it marks a position on a scale,
         *  true whether or not anything is wrong, and muted fills would
         *  swallow a lighter line. It hovers because its value is printed
         *  nowhere else on the row. The 3px line sits in a 12px hover target
         *  since a hairline is a pixel-accurate mouse move; above the
         *  segments so it stays reachable at either end. */}
        <span
          className="absolute z-20 top-1/2 -translate-y-1/2 -translate-x-1/2 h-[18px] transition-[left] duration-300 ease-out motion-reduce:transition-none"
          style={{ left: `${pct(item.threshold)}%` }}
        >
          <Tooltip
            label={`Minimum ${item.threshold} ${item.unit}`}
            className="h-full w-3 justify-center"
            followCursor
          >
            <span aria-hidden="true" className="w-[3px] h-full rounded-full bg-ink" />
          </Tooltip>
        </span>
      </div>
    </div>
  );
}

/**
 * One product, one row: the meter, the badge and the decision together.
 * The action slot is never empty — where there is nothing to do it carries
 * the reason, because a blank right-hand side reads as broken.
 */
function PlanRow({
  row,
  defaultDay,
  defaultDayLabel,
  onAddTask,
  onAddStocking,
  striped = false,
  trackPct = 100,
  stations,
}) {
  const { item, stillToStock, queuedRaw, stillToMake, state } = row;
  const s = STATE[state];

  const [open, setOpen] = useState(false);

  /* Queued only — booked batches already have a band on the bar. A stocking
   * task is the one commitment the bar cannot draw, because it moves
   * nothing until somebody carries the boxes. */
  const committed = queuedRaw > 0 ? `${queuedRaw} queued` : null;

  const canMake = row.canMakeNow;
  const canStock = stillToStock > 0 && !!onAddStocking;
  const hasAction = row.hasAction && (canMake || canStock);

  return (
    <>
      <li className={cx("px-2 py-2 rounded-md", striped && "bg-faint")}>
        <div className="flex items-center gap-3">
          {/* Names get two lines and the full name on hover: several
           *  products share a prefix long enough that a single truncated
           *  line was identical across them. */}
          <span className="w-60 shrink-0 min-w-0 flex items-start gap-2 self-center">
            {/* `Tooltip` is `inline-flex shrink-0`, so `min-w-0` on it does
             *  nothing and it shoves the chip out of the column. This
             *  wrapper puts the shrink where flexbox can act on it;
             *  `max-w-full` inside keeps the tooltip's box within it so the
             *  name clamps. */}
            <span className="min-w-0 flex-1">
              <Tooltip label={item.product} className="max-w-full">
                <span className="text-sm font-medium text-ink leading-snug line-clamp-2 text-left">
                  {item.product}
                </span>
              </Tooltip>
            </span>
            {/* "Out" only. Every row under NEEDS YOU is low by definition,
             *  so a "Low" badge would be the heading repeated in amber. Out
             *  discriminates within the group. */}
            {state === "out" && <Badge tone={s.tone}>{s.label}</Badge>}
            {/* What has already been asked for. It cannot live on the bar
             *  (bands are physical stock) or in the action column (it would
             *  break the button alignment), so it sits with the name. */}
            {/* shrink-0 so a long product name cannot clip it — the name is
             *  the flexible half of this column. */}
            {committed && (
              <span className="shrink-0">
                <Badge tone="neutral">{committed}</Badge>
              </span>
            )}
          </span>

          <div className="flex-1 min-w-0">
            <PlanMeter row={row} trackPct={trackPct} />
          </div>

          {/* No number column: the bar already draws floor, minimum and
           *  max, and scanning twenty bars for shape is instant where
           *  scanning twenty numbers is arithmetic. Precision lives in the
           *  band hovers and the Delegate modal. */}

          {/* One verb. HOW (a batch at a station, or stock from the back)
           *  and HOW MUCH are the same decision, made in the modal with the
           *  bar in front of you. */}
          {/* One fixed-width cell holds either the button or the reason
           *  there isn't one, kept quiet (ink-4) so a column of reasons
           *  never competes with the buttons. */}
          <span className="w-28 shrink-0 flex justify-end">
            {hasAction ? (
              /* Outlined, always. Urgency is carried by the section heading;
               *  the screen's one filled accent belongs to the confirm
               *  inside the modal, not to twenty invitations to open one. */
              <Button
                size="sm"
                className="w-full"
                variant="secondary"
                onClick={() => setOpen(true)}
              >
                Delegate
              </Button>
            ) : (
              /* Only the reasons the chip does not already give. */
              <span className="text-xs text-ink-4 tnum truncate">
                {state === "full"
                  ? "at target"
                  : /* The reason in the gap's own units — "fine" alone
                     *  invites "fine according to what?". */
                    state === "fine" && stillToMake > 0
                    ? `${stillToMake} ${item.unit} short of a batch`
                    : null}
              </span>
            )}
          </span>
        </div>

      </li>

      {open && (
        <DelegateModal
          row={row}
          recStock={stillToStock}
          recMake={stillToMake}
          canStock={canStock}
          canMake={canMake}
          defaultDayLabel={defaultDayLabel}
          stations={stations}
          onClose={() => setOpen(false)}
          onConfirm={(how, qty, station, pull) => {
            if (how === "make") onAddTask(defaultDay, station, item.product, qty, item.unit);
            else
              onAddStocking(item.product, qty, item.unit, state === "out", {
                parts: pull,
                sentence: pullSentence(pull, item.unit),
              });
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * Delegating one product: which route, and how much. Opens on the
 * recommended route with the recommended amount typed, so the fast path is
 * a click and Enter. The bar comes with it and the ghost band moves as you
 * type, so an overshoot is visible.
 *
 * Switching route re-types the amount: 42 lb is right for carrying stock
 * out and wrong for booking a batch, and a leftover default gets committed
 * without being read.
 */
function DelegateModal({
  row,
  recStock,
  recMake,
  canStock,
  canMake,
  defaultDayLabel,
  stations,
  onClose,
  onConfirm,
}) {
  const { item, floor, fromBack, inProduction, scheduled, planned, queuedStock, toMake, refill } = row;

  /* Opens on the route that puts product on the floor soonest: stocking
   * happens today, a batch lands next week. */
  const [how, setHow] = useState(canStock ? "stock" : "make");
  /* Every route has an amount, including ones the screen would not suggest.
   * When the recommendation is zero, fall back to the gap-to-full — the
   * number someone overriding is asserting is real. */
  const recFor = (h) =>
    h === "make"
      ? recMake > 0
        ? recMake
        : Math.max(0, Math.round(refill - planned))
      : recStock > 0
        ? recStock
        : Math.max(0, Math.round(refill));
  const [qty, setQty] = useState(String(recFor(canStock ? "stock" : "make")));
  const [station, setStation] = useState(stations[0]);
  const n = Number(qty) || 0;
  const isMake = how === "make";

  /* From the typed amount, not the recommendation — the task must describe
   * the trip somebody is actually making. */
  const pull = splitPull(item, Math.min(n, fromBack));
  /* How much of the requested move the records cannot account for; positive
   * only on an override. */
  const unrecorded = Math.max(0, Math.round(n - pull.reduce((t, x) => t + x.qty, 0)));

  const pickHow = (next) => {
    setHow(next);
    setQty(String(recFor(next)));
  };

  const minBatch = item.minBatch ?? defaultMinBatch(item.max);

  /* Quick amounts are DESTINATIONS, not percentages of the amount: "To min"
   * is what it takes to reach the minimum, "To 80%" is the case at 80% of
   * what it holds (reads as full from across the shop). Destinations
   * already reached are dropped and duplicates collapse.
   *
   * Measured from a different base per route. MOVING raises the floor by
   * exactly what you carry, so measure from the floor. MAKING adds to the
   * pipeline, which already contains back stock and batches on the way;
   * measuring from the floor would ask for product that is already coming
   * and disagree with the hint an inch below. */
  const quickBase = isMake ? floor + fromBack + inProduction + scheduled : floor;
  const QUICK = (() => {
    const out = [];
    const add = (label, value) => {
      const v = Math.max(0, Math.round(value));
      if (v > 0 && !out.some((q) => q.value === v)) out.push({ label, value: v });
    };
    add("To min", item.threshold - quickBase);
    add("To 80%", item.max * 0.8 - quickBase);
    add("To full", item.max - quickBase);
    /* The smallest batch worth doing is a destination too — and the only
     * one left when everything else is covered, i.e. the override case. */
    if (isMake) add("One batch", minBatch);
    return out;
  })();
  const tillMax = Math.max(0, item.max - (floor + fromBack + inProduction + scheduled));
  /* Overshoot is the one thing the bar cannot show (it clamps at 100%), so
   * it is said in words. */
  const over = Math.max(0, Math.round(n - tillMax));

  /* Both routes are always shown and always usable; the reason a route is
   * unnecessary is stated, never enforced. A closed door with a reason on
   * it is not clutter; a missing door is. See ROUTES below. */
  const stockWhy = canStock
    ? null
    : queuedStock > 0
      ? `${queuedStock} ${item.unit} is already on today's task list`
      : fromBack > 0
        ? "nothing left in the back once what's queued is out"
        : "nothing in the back to put out";
  const makeWhy = canMake
    ? null
    : toMake <= 0
      /* No em dash inside the reason: the sentence it lands in already has
       * one. */
      ? "the back already covers the gap"
      : `${Math.round(planned)} ${item.unit} is already booked`;

  /* Neither route is ever locked. Every figure here is downstream of a
   * count somebody typed on a tablet with cold hands; stock pulled and
   * never logged, or a stale freezer number, both make the screen say "the
   * back already covers the gap" to a person standing in front of an empty
   * freezer. The screen states what it believes and why, right under the
   * control, and the door stays open. */
  const ROUTES = [
    { value: "stock", label: "Stock from back" },
    { value: "make", label: "Schedule a batch" },
  ];
  const why = isMake ? makeWhy : stockWhy;

  return (
    <Modal
      open
      icon={isMake ? Factory : Package}
      title={`Delegate ${item.product}`}
      onClose={onClose}
      footer={
        <>
          {/* Ghost, not outlined: a bordered Cancel sits at the same weight
           *  as the action it declines. */}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={n <= 0} onClick={() => onConfirm(how, n, station, pull)}>
            {isMake ? `Schedule ${n} ${item.unit}` : "Add to today's list"}
          </Button>
        </>
      }
    >
      <div className="mt-1">
        <PlanMeter row={row} adding={n} />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3 tnum">
        {BANDS.map((b) => {
          const value =
            b.key === "floor"
              ? floor
              : b.key === "onhand"
                ? fromBack
                : b.key === "production"
                  ? inProduction
                  : scheduled;
          if (value <= 0) return null;
          return (
            <span key={b.key} className="flex items-center gap-1.5">
              <span className={cx("w-2.5 h-2.5 rounded-full", b.swatch)} />
              {b.label} {Math.round(value)}
            </span>
          );
        })}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-line border border-line-strong" />
          Till full {Math.round(tillMax)}
        </span>
      </div>

      {/* A stack of `Field`s, one rhythm: label above, control, hint below.
       *  Everything explanatory is a hint attached to the control it
       *  explains. */}
      <div className="mt-4 space-y-4">
        {/* Everything under the chips is one hint, in one order: what this
         *  route does, why the other is shut, then the trip itself. `Field`
         *  renders its hint AFTER its children, so the pieces are spans
         *  inside the hint (legal inside its <p>) rather than siblings of
         *  the control. */}
        <Field
          label="How"
          hint={
            <>
              {isMake
                ? `Schedules a batch at a station. Lands ${defaultDayLabel} — today's production belongs to the floor terminal.`
                : "Goes to today's task list, open to anyone on shift. Nothing gets made — this is stock already sitting in the back."}
              {/* Warn ink, and phrased as the screen's opinion ("wouldn't
               *  suggest") rather than a rule ("can't") — a second opinion
               *  you are free to overrule. */}
              {why && (
                <span className="block mt-1.5 text-warn">
                  The screen wouldn&rsquo;t suggest this — {why}. Go ahead
                  anyway if the counts are off.
                </span>
              )}
              {/* The route, not just the amount — whoever picks this up has
               *  to walk somewhere. The split follows the typed amount. Full
               *  ink inside a light-ink block: it is the one line that is an
               *  instruction to a person rather than an explanation of a
               *  control. */}
              {!isMake && n > 0 && (
                <span className="block mt-1.5 text-ink tnum">
                  {pull.length > 0 && <>Pull {pullSentence(pull, item.unit)}.</>}
                  {/* The override made visible: the person walking to the
                   *  freezer is the one who can settle the count. */}
                  {unrecorded > 0 && (
                    <span className={pull.length > 0 ? "block mt-1" : undefined}>
                      {unrecorded} {item.unit} more than the count shows — worth a
                      recount while you&rsquo;re back there.
                    </span>
                  )}
                </span>
              )}
            </>
          }
        >
          <Segmented size="sm" value={how} onChange={pickHow} options={ROUTES} />
        </Field>

        <div className="flex items-start gap-4 flex-wrap">
          <Field
            label={`Amount (${item.unit})`}
            hint={
              /* "Recommended" is a lie on an override — the recommendation
               *  there is zero, as the warn line above just said. */
              <span className="tnum">
                {why ? "Gap to full" : "Recommended"} {recFor(how)} {item.unit}
                {planned > 0 && ` · ${Math.round(planned)} already committed`}
              </span>
            }
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="w-24 block">
                <Input
                  autoFocus
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="tnum"
                  aria-label={`Amount for ${item.product}`}
                />
              </span>
              {/* Ghost until it matches the box, then the active-chip tint:
               *  the cheapest way to say "you are at a round place". */}
              {QUICK.map((q) => (
                <Button
                  key={q.label}
                  size="sm"
                  variant={n === q.value ? "subtle" : "ghost"}
                  aria-pressed={n === q.value}
                  onClick={() => setQty(String(q.value))}
                >
                  {q.label}
                </Button>
              ))}
            </div>
            {/* Warn weight: overshoot is the one mistake the recommendation
             *  exists to prevent and the bar cannot draw it. */}
            {over > 0 && (
              <p className="mt-1.5 text-xs font-medium text-warn tnum">
                {over} {item.unit} over max
              </p>
            )}
            {/* The other end of the guardrail. The screen will not propose a
             *  batch under this size but nothing stops you typing one (a
             *  rush order, a gap before a holiday) — a default, not a rule. */}
            {isMake && n > 0 && n < minBatch && (
              <p className="mt-1.5 text-xs text-ink-3 tnum">
                Under the {minBatch} {item.unit} smallest batch for this product.
              </p>
            )}
          </Field>

          {isMake && (
            <Field label="Station">
              <Segmented
                size="sm"
                value={station}
                onChange={setStation}
                options={stations.map((st) => ({ value: st, label: st }))}
              />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Review before a bulk booking: a confirmation that shows the work rather
 * than asking "are you sure?". Rows start checked so the fast path is still
 * two clicks; unchecking is for the one product the manager knows something
 * the screen doesn't about.
 */
function BulkBookModal({ tasks, dayLabel, stations, onClose, onConfirm }) {
  const [dropped, setDropped] = useState(() => new Set());
  const [station, setStation] = useState(stations[0]);

  const toggle = (product) =>
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(product)) next.delete(product);
      else next.add(product);
      return next;
    });

  const chosen = tasks.filter((t) => !dropped.has(t.product));
  const total = chosen.reduce((n, t) => n + t.qty, 0);
  const unit = tasks[0]?.unit || "lb";

  return (
    <Modal
      open
      size="lg"
      icon={CalendarPlus}
      title="Schedule these batches"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={chosen.length === 0}
            onClick={() => onConfirm(chosen.map((t) => ({ ...t, station })))}
          >
            Schedule {chosen.length} {chosen.length === 1 ? "batch" : "batches"}
          </Button>
        </>
      }
    >
      <p className="text-xs text-ink-3">
        Every product that still needs a batch, at its recommended amount. All
        of these land {dayLabel} — today&rsquo;s production belongs to the
        floor terminal.
      </p>

      {/* One station for the lot. Per-batch stations belong in the row's
       *  own Delegate modal; asking for twelve here would make the fast
       *  path slower than doing it one at a time. */}
      <Field label="Station" className="mt-3">
        <Segmented
          size="sm"
          value={station}
          onChange={setStation}
          options={stations.map((st) => ({ value: st, label: st }))}
        />
      </Field>

      <ul className="mt-3 border-y border-line divide-y divide-line max-h-[45vh] overflow-y-auto">
        {tasks.map((t) => {
          const on = !dropped.has(t.product);
          return (
            <li key={t.product}>
              {/* The whole row toggles and the box is a drawing (aria-hidden,
               *  no handler of its own) — the app's task-row contract.
               *  Filled with ink, not the accent: selection is not an accent
               *  in this system. */}
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t.product)}
                className={cx(
                  "w-full flex items-center gap-2.5 px-1 py-2 rounded-md text-left",
                  "transition-colors duration-100 hover:bg-faint",
                  !on && "opacity-45",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "shrink-0 flex items-center justify-center w-4 h-4 rounded border",
                    "transition-colors duration-100",
                    on
                      ? "border-ink bg-ink text-white"
                      : "border-line-strong text-transparent",
                  )}
                >
                  <Check size={10} strokeWidth={3} />
                </span>
                <span className="flex-1 min-w-0 truncate text-sm text-ink">
                  {t.product}
                </span>
                <span className="shrink-0 text-sm text-ink tnum">
                  {t.qty} {t.unit}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-ink-4 tnum">
        {Math.round(total)} {unit} across {chosen.length}{" "}
        {chosen.length === 1 ? "batch" : "batches"}
        {dropped.size > 0 && ` · ${dropped.size} skipped`}
      </p>
    </Modal>
  );
}

/* Mutually exclusive, so the counts add up to the catalogue. "Under min"
 * deliberately excludes the empty ones — those are their own bucket. */
const RANGE_FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "out", label: "Out", match: (i) => stockIn(i, "floor") <= 0 },
  {
    id: "under",
    label: "Under min",
    match: (i) => stockIn(i, "floor") > 0 && stockIn(i, "floor") < i.threshold,
  },
  {
    id: "in",
    label: "In range",
    match: (i) => stockIn(i, "floor") >= i.threshold && stockIn(i, "floor") < i.max,
  },
  { id: "over", label: "At max", match: (i) => stockIn(i, "floor") >= i.max },
];

/** Which value each sortable column reads off a product. */
const RANGE_COLUMNS = {
  product: (i) => i.product,
  floor: (i) => stockIn(i, "floor"),
  min: (i) => i.threshold,
  max: (i) => i.max,
  batch: (i) => i.minBatch ?? defaultMinBatch(i.max),
};

function RangesModal({ inventory, onSetRange, onClose }) {
  const [q, setQ] = useState("");
  /* Alphabetical to start — the list is for finding a known product. A
   * number column starts DESCENDING, because the reason to sort by it is
   * almost always to see the extremes first. */
  const [sort, setSort] = useState({ key: "product", dir: "asc" });
  const [filter, setFilter] = useState("all");

  const onSort = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "product" ? "asc" : "desc" },
    );

  const searched = inventory
    .map(normalizeItem)
    .filter((i) => i.product.toLowerCase().includes(q.trim().toLowerCase()));

  /* Counts come off the searched set, not the whole catalogue, so a filter
   * chip never promises rows the search has already excluded. */
  const counts = Object.fromEntries(
    RANGE_FILTERS.map((f) => [f.id, searched.filter(f.match).length]),
  );
  const active = RANGE_FILTERS.find((f) => f.id === filter) || RANGE_FILTERS[0];

  const items = searched
    .filter(active.match)
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const read = RANGE_COLUMNS[sort.key] || RANGE_COLUMNS.product;
      const va = read(a);
      const vb = read(b);
      const cmp =
        typeof va === "string" ? va.localeCompare(vb) : va - vb;
      // Product name as the tiebreak, so equal numbers never reshuffle.
      return dir * cmp || a.product.localeCompare(b.product);
    });

  return (
    <Modal
      open
      size="lg"
      icon={SlidersHorizontal}
      title="Levels by product"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a product…"
      />

      <div className="mt-2.5">
        <Segmented
          fade
          size="sm"
          value={filter}
          onChange={setFilter}
          options={RANGE_FILTERS.map((f) => ({
            value: f.id,
            label: f.label,
            count: f.id === "all" ? undefined : counts[f.id] || undefined,
          }))}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 px-1">
        <SortHeader label="Product" col="product" sort={sort} onSort={onSort} className="flex-1 justify-start" />
        <SortHeader label="On floor" col="floor" sort={sort} onSort={onSort} className="w-16 justify-end" />
        <SortHeader label="Min" col="min" sort={sort} onSort={onSort} className="w-16 justify-center" />
        <SortHeader label="Max" col="max" sort={sort} onSort={onSort} className="w-16 justify-center" />
        {/* Min says when to start, max where to stop, min batch whether the
         *  job is big enough to be worth doing — three numbers, one place. */}
        <SortHeader label="Min batch" col="batch" sort={sort} onSort={onSort} className="w-20 justify-center" />
      </div>

      <div className="mt-1 border-y border-line max-h-[50vh] overflow-y-auto">
        {items.length === 0 ? (
          /* Left-aligned (this design system does not centre) and ink-3,
           * not ink-4: the lightest grey reads as disabled when it is the
           * only content. */
          <p className="px-1 py-6 text-xs text-ink-3">
            {q ? `No product matches “${q}”.` : "Nothing in this state."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <RangeRow key={item.product} item={item} onSetRange={onSetRange} />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function SortHeader({ label, col, sort, onSort, className }) {
  const active = sort.key === col;
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cx(
        "flex items-center gap-1 shrink-0 text-xs font-medium transition-colors",
        active ? "text-ink" : "text-ink-3 hover:text-ink",
        className,
      )}
    >
      {label}
      {/* Only the active column shows a direction — an arrow on every header
       *  reads as decoration and stops meaning anything. */}
      {active && <Icon size={11} className="shrink-0" />}
    </button>
  );
}

function RangeRow({ item, onSetRange }) {
  const [min, setMin] = useState(String(item.threshold));
  const [max, setMax] = useState(String(item.max));
  const [batch, setBatch] = useState(
    String(item.minBatch ?? defaultMinBatch(item.max)),
  );
  const floor = stockIn(item, "floor");

  const commit = () => {
    const t = Number(min) || 0;
    const m = Number(max) || 0;
    const b = Number(batch) || 0;
    const was = item.minBatch ?? defaultMinBatch(item.max);
    if (t === item.threshold && m === item.max && b === was) return;
    onSetRange(item.product, { threshold: t, max: m, minBatch: b });
  };
  const onKey = (e) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    /* py-1: with a 28px input inside this lands the row at 36px, matching
     * the batch list in the bulk dialog. */
    <li className="flex items-center gap-2 px-1 py-1">
      <span className="flex-1 min-w-0 truncate text-sm text-ink">{item.product}</span>
      <span
        className={cx(
          "w-16 text-right shrink-0 text-xs tnum",
          floor <= 0
            ? "text-danger font-semibold"
            : floor < item.threshold
              ? "text-warn font-medium"
              : "text-ink-4",
        )}
      >
        {floor}
      </span>
      <span className="w-16 shrink-0">
        <Input
          type="number"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          className="tnum"
          aria-label={`Minimum for ${item.product}`}
        />
      </span>
      <span className="w-16 shrink-0">
        <Input
          type="number"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          className="tnum"
          aria-label={`Maximum for ${item.product}`}
        />
      </span>
      <span className="w-20 shrink-0">
        <Input
          type="number"
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          className="tnum"
          aria-label={`Smallest batch worth running for ${item.product}`}
        />
      </span>
    </li>
  );
}
