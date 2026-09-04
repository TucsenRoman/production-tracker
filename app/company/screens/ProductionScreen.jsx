"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  SlidersHorizontal,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Segmented,
  StickyFadeHeader,
  cx,
} from "../../components/ui";
import {
  STATIONS,
  behindStock,
  normalizeItem,
  refillQty,
  stockIn,
  shiftDate,
} from "../../lib/domain";

/**
 * Console-side production targets.
 *
 * The flow this screen runs, in the order a manager actually thinks it:
 *
 *   1. here is what is on the floor
 *   2. here is the min and the max it should sit between
 *   3. so here is what you should plan — and how much of that is a run
 *      versus stock already sitting in the back
 *   4. disagree? change the amount, or change the min and max themselves
 *
 * Every number comes from the domain's own vocabulary rather than a private
 * one invented here: `threshold` is the min, `max` the fill target,
 * `refillQty` the gap between the floor and that max, `behindStock` what
 * could be put out without making anything at all.
 *
 * That last one is why the recommendation is split. "Plan 82 lb" is wrong
 * when 42 lb of it is already in the freezer — the honest answer is move 42
 * and make 40, and a screen that says 82 sends someone to smoke bacon that
 * already exists.
 *
 * The day-by-day strip stayed on the floor Board, where a shift is genuinely
 * working one day at a time. A manager is deciding what to commit, not what
 * is happening at 2pm on Thursday.
 */

/* Colour only where it discriminates.
 *
 * This had six tones at once — red, amber, grey, cold blue, info blue,
 * green — and four of them earned nothing. Inside the Planned tab every
 * badge is "Planned", inside On hand every badge is "On hand": a hue that
 * is constant down the whole grid is decoration, not information. The
 * states only vary within "Needs a plan", and there the thing worth seeing
 * from across the room is which products are actually hurting.
 *
 * So red and amber survive and everything else goes quiet. What kind of
 * work a card needs is already written on it — a Make button or a "move 24
 * from back" hint — and saying it a second time in a colour just spends the
 * screen's contrast on a fact already stated in words. */
const STATE = {
  /* Nothing on the floor is not the same problem as being under par: one is
   * a case a customer is standing in front of, the other is a number
   * trending the wrong way. */
  out: { label: "Out", tone: "danger", rank: 0 },
  below: { label: "Below min", tone: "warn", rank: 1 },
  make: { label: "Needs a run", tone: "neutral", rank: 2 },
  move: { label: "Move from back", tone: "neutral", rank: 3 },
  planned: { label: "Planned", tone: "neutral", rank: 4 },
  full: { label: "On hand", tone: "neutral", rank: 5 },
};

export default function ProductionScreen({
  schedule,
  inventory,
  batches = [],
  today,
  onSetRange,
  onAddTask,
}) {
  const [tab, setTab] = useState("attention");
  const [rangesOpen, setRangesOpen] = useState(false);

  /* Where an accepted plan lands: the next production day AFTER today.
   *
   * Not today. Planning from the console deliberately never spawns a live
   * batch (see handleAddScheduleTask), and the committed-work scan below
   * skips today because on the FLOOR a same-day add does spawn one and
   * counting both would double-book. Net effect if this pointed at today:
   * the one-click button would write a plan that the card it sits on could
   * never see, so nothing on screen moved and the click looked broken.
   *
   * Aiming at tomorrow is also the truer product stance — today's run is
   * already underway and belongs to the floor terminal; a manager at a desk
   * is committing the days ahead. */
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
    /* What is already committed against each product: runs booked on days
     * that haven't happened, plus batches physically in flight. Today's
     * schedule rows are skipped because adding one on today spawns a batch
     * too, and counting both would double-book a product against itself. */
    const committed = new Map();
    const bump = (product, n) =>
      committed.set(product, (committed.get(product) || 0) + n);

    /* A rolling window forward, NOT the rest of the calendar week. On a
     * Friday the current week has no production days left, so a week-bounded
     * scan could never see a plan at all and everything read as unplanned —
     * including runs booked for Monday. A plan is a plan regardless of which
     * week it falls in. Today is excluded because adding a run on today
     * spawns a batch too, and both would count. */
    for (let i = 1; i <= 7; i += 1) {
      const key = shiftDate(today, i);
      const dow = new Date(`${key}T00:00:00`).getDay();
      if (dow === 0 || dow === 6) continue; // no production at the weekend
      for (const station of STATIONS) {
        for (const t of (schedule[key] || {})[station] || []) {
          bump(t.text, Number(t.qty) || 0);
        }
      }
    }
    for (const b of batches) {
      if (b.finalWeight != null) continue; // already landed in stock
      bump(b.product, Number(b.boxWeight ?? b.estWeight) || 0);
    }

    return inventory
      .map(normalizeItem)
      .map((item) => {
        const floor = stockIn(item, "floor");
        const behind = behindStock(item);
        const refill = refillQty(item);
        const fromBack = Math.min(refill, behind);
        const toMake = Math.max(0, +(refill - behind).toFixed(1));
        const planned = committed.get(item.product) || 0;

        let state;
        if (refill <= 0) state = "full";
        else if (planned >= toMake && toMake > 0) state = "planned";
        else if (floor <= 0) state = "out";
        else if (floor < item.threshold) state = "below";
        else if (toMake > 0) state = "make";
        else state = "move";

        return { item, floor, behind, refill, fromBack, toMake, planned, state };
      })
      .sort(
        (a, b) =>
          STATE[a.state].rank - STATE[b.state].rank ||
          b.refill - a.refill ||
          a.item.product.localeCompare(b.item.product),
      );
  }, [inventory, schedule, batches, today]);

  /* Three states a product can be in, as tabs rather than one long mixed
   * list: something you still have to decide about, something already
   * committed, and something that needs nothing. They're read at different
   * moments — you work the first, check the second, and ignore the third. */
  const groups = useMemo(
    () => ({
      attention: rows.filter((r) => ["out", "below", "make", "move"].includes(r.state)),
      planned: rows.filter((r) => r.state === "planned"),
      stocked: rows.filter((r) => r.state === "full"),
    }),
    [rows],
  );

  const shown = groups[tab] || [];
  const totalToMake = groups.attention.reduce(
    (n, r) => n + Math.max(0, r.toMake - r.planned),
    0,
  );
  const totalToMove = groups.attention.reduce((n, r) => n + r.fromBack, 0);
  const outCount = rows.filter((r) => r.state === "out").length;
  const belowMin = rows.filter((r) => r.state === "below").length;

  return (
    <div>
      <StickyFadeHeader pad={28}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* shrink-0 is load-bearing, not tidiness. As a shrinkable flex item
           *  the summary block beside it squeezed this rail to exactly its
           *  content width, which is the one place ScrollRail's 14px of
           *  reserved clip room tips the overflow test over — so it armed,
           *  faded its own last tab, and flickered as the measurement crossed
           *  back and forth. Fixed width in, the arming state can no longer
           *  feed back into the width it is measured against. The row wraps
           *  instead when the viewport is genuinely too narrow. */}
          {/* No `fade`. Three short tabs in a wide header never genuinely
           *  overflow, so asking for a scroller only gave ScrollRail a
           *  chance to arm on a transient and then clip the last tab's count
           *  badge against its own reserved room. A row that cannot overflow
           *  should not be a rail. TasksScreen keeps `fade` — five tabs there
           *  really can outgrow a narrow terminal. */}
          <Segmented
            className="shrink-0"
            value={tab}
            onChange={setTab}
            options={[
              {
                value: "attention",
                label: "Needs a plan",
                icon: AlertTriangle,
                count: groups.attention.length || undefined,
              },
              {
                value: "planned",
                label: "Planned",
                icon: ClipboardCheck,
                count: groups.planned.length || undefined,
              },
              {
                value: "stocked",
                label: "On hand",
                icon: Check,
                count: groups.stocked.length || undefined,
              },
            ]}
          />

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-ink-3 tnum">
              {outCount > 0 && (
                <span className="text-danger font-medium">{outCount} out · </span>
              )}
              {belowMin > 0 && (
                <span className="text-warn font-medium">{belowMin} below min · </span>
              )}
              {Math.round(totalToMove)} lb to move · {Math.round(totalToMake)} lb to make
            </span>
            <Button
              size="sm"
              variant="secondary"
              icon={SlidersHorizontal}
              onClick={() => setRangesOpen(true)}
            >
              Min &amp; max
            </Button>
          </div>
        </div>
      </StickyFadeHeader>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={Check}
            title={
              tab === "attention"
                ? "Nothing waiting on a decision"
                : tab === "planned"
                  ? "Nothing planned yet"
                  : "Nothing fully on hand"
            }
            description={
              tab === "attention"
                ? "Every product is either planned for or already on hand."
                : tab === "planned"
                  ? "Runs you add from the other tab show up here."
                  : "Every case is below its max right now."
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map((row) => (
            <PlanCard
              key={row.item.product}
              row={row}
              defaultDay={defaultDay}
              defaultDayLabel={defaultDayLabel}
              onAddTask={onAddTask}
            />
          ))}
        </div>
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
 * The band, drawn along the card rather than beside it.
 *
 * This was a 24x56 vertical column, and at that size it could not do its
 * job: you could not tell 26 of 25-55 from 28 of 25-55 by looking, which
 * makes it decoration wearing a measurement's clothes. It also carried a
 * border and an inset ground, so an empty one (a product at zero) read as
 * a broken box rather than an empty case.
 *
 * Horizontal, full width, four pixels tall: the same information gets ten
 * times the length to express itself in, and proportion becomes legible at
 * a glance. The minimum is a tick that overhangs the track top and bottom
 * so it reads as a mark ON the scale rather than another segment of it.
 */
function RangeBar({ floor, min, max, adding = 0 }) {
  const pct = (n) => (max > 0 ? Math.max(0, Math.min(100, (n / max) * 100)) : 0);
  return (
    <div className="relative h-1">
      <div className="absolute inset-0 rounded-full bg-line overflow-hidden">
        {adding > 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-full bg-cold-soft"
            style={{ width: `${pct(floor + adding)}%` }}
          />
        )}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-full bg-ink-2"
          style={{ width: `${pct(floor)}%` }}
        />
      </div>
      {/* Neutral, not amber. The tick marks where the minimum SITS — it's a
       *  gradation on a scale, true of every product whether or not anything
       *  is wrong. Painting it amber put ten warning-coloured marks on a
       *  screen where amber is supposed to mean "this one is below par", and
       *  a warning that is always on stops being a warning. */}
      <span
        aria-hidden="true"
        title={`Minimum ${min}`}
        className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-full bg-ink-4"
        style={{ left: `${pct(min)}%` }}
      />
    </div>
  );
}

function PlanCard({ row, defaultDay, defaultDayLabel, onAddTask }) {
  const { item, floor, refill, fromBack, toMake, planned, state } = row;
  const s = STATE[state];

  const stillToMake = Math.max(0, Math.round(toMake - planned));
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(stillToMake || Math.round(refill)));
  const [station, setStation] = useState(STATIONS[0]);
  const n = Number(qty) || 0;

  const canPlan = stillToMake > 0;

  return (
    <div className="flex flex-col gap-1.5 border border-line rounded-md bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink min-w-0 truncate">
          {item.product}
        </span>
        <Badge tone={s.tone} icon={state === "full" ? Check : undefined}>
          {s.label}
        </Badge>
      </div>

      <div className="flex items-center gap-2.5">
        <p className="flex-1 min-w-0 tnum leading-none">
          <span className="text-xl font-semibold text-ink">{floor}</span>
          <span className="text-xs text-ink-3">
            {" "}
            / {item.threshold}&ndash;{item.max} {item.unit}
          </span>
        </p>

        {/* Every card says what to do in the same slot. Where there's nothing
         *  to MAKE the slot isn't empty — it carries the reason, because a
         *  card reading "Below min" with a blank right-hand side looks
         *  broken rather than finished. Below-min with a full freezer behind
         *  it is a move, not a run, and the console can't move stock. */}
        {!canPlan && (
          <span className="text-xs text-ink-4 tnum shrink-0">
            {toMake <= 0 && fromBack > 0
              ? `move ${Math.round(fromBack)} from back`
              : planned > 0
                ? `${Math.round(planned)} planned`
                : null}
          </span>
        )}

        {canPlan && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              size="sm"
              variant={state === "out" || state === "below" ? "primary" : "secondary"}
              onClick={() => onAddTask(defaultDay, station, item.product, stillToMake)}
            >
              Make {stillToMake}
            </Button>
            <IconButton
              label={open ? "Hide options" : "Change amount or station"}
              icon={open ? ChevronUp : ChevronDown}
              onClick={() => setOpen((v) => !v)}
            />
          </div>
        )}
      </div>

      <RangeBar
        floor={floor}
        min={item.threshold}
        max={item.max}
        adding={open ? n : 0}
      />

      {open && canPlan && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="w-14 shrink-0">
            <Input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="tnum"
              aria-label={`Amount to plan for ${item.product}`}
            />
          </span>
          <Segmented
            size="sm"
            value={station}
            onChange={setStation}
            options={STATIONS.map((st) => ({ value: st, label: st }))}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={n <= 0}
            onClick={() => onAddTask(defaultDay, station, item.product, n)}
          >
            Add
          </Button>
          <span className="text-xs text-ink-4 tnum">
            lands {defaultDayLabel}
            {fromBack > 0 && ` · ${Math.round(fromBack)} already in back`}
          </span>
        </div>
      )}
    </div>
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
};

function RangesModal({ inventory, onSetRange, onClose }) {
  const [q, setQ] = useState("");
  /* Alphabetical to start — the list is for finding a known product. Clicking
   * a number column starts DESCENDING, because the reason to sort by "on
   * floor" or "min" is almost always to see the extremes first, and making
   * someone click twice to get there is a small tax paid every time. */
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
      title="Min & max by product"
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
      </div>

      <div className="mt-1 border-y border-line max-h-[50vh] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-ink-4">
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
  const floor = stockIn(item, "floor");

  const commit = () => {
    const t = Number(min) || 0;
    const m = Number(max) || 0;
    if (t === item.threshold && m === item.max) return;
    onSetRange(item.product, { threshold: t, max: m });
  };
  const onKey = (e) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <li className="flex items-center gap-2 px-1 py-1.5">
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
    </li>
  );
}
