"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowRightCircle,
  ArrowUpAZ,
  ArrowUpWideNarrow,
  Beef,
  Bone,
  CloudOff,
  CookingPot,
  Drumstick,
  Flame,
  Ham,
  Hamburger,
  Layers,
  Package,
  PackageCheck,
  PackageX,
  Plus,
  RefreshCw,
  Sandwich,
  Snowflake,
  Store,
  Timer,
  Utensils,
} from "lucide-react";

import {
  Badge,
  Button,
  Dropdown,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  RowActions,
  SearchInput,
  SectionHeading,
  Segmented,
  SkeletonRows,
  Slot,
  StatCard,
  StatGrid,
  StickyFadeHeader,
  Tooltip,
  cx,
} from "../components/ui";
import ItemModal from "../components/ItemModal";
import {
  COVER_WARN_DAYS,
  DEFAULT_THRESHOLD,
  behindStock,
  canPutOut,
  capacityFor,
  PRODUCT_TYPES,
  STATE_ICON,
  STOCK_STATES,
  coverTone,
  daysOfCover,
  defaultThreshold,
  productType,
  refillQty,
  relativeTime,
  stockIn,
  stockStatus,
  totalStock,
} from "../lib/domain";

const COVER_TONE = { danger: "text-danger", warn: "text-warn", ok: "text-ok", muted: "text-ink-3" };

/** Traffic light on the floor count: nothing / below par / at or over par. */
const FLOOR_TONE = { out: "text-danger", low: "text-warn", ok: "text-ok" };

/* One icon per product family, so a section is identifiable from across the
 * room on the wall terminal rather than only by reading its word. The
 * whole-muscle cuts deliberately share one mark — they are the same kind of
 * thing to whoever is stocking the case — and anything unrecognised falls
 * through to a plain box. */
const FAMILY_ICON = {
  Bacon: Layers,
  Brats: Utensils,
  Sausage: CookingPot,
  Sticks: Bone,
  Jerky: Flame,
  Ham: Ham,
  Deli: Sandwich,
  Roasts: Beef,
  Steaks: Beef,
  Chops: Beef,
  Ribs: Beef,
  Ground: Hamburger,
  Poultry: Drumstick,
  Other: Package,
};

/*
 * The floor count carries no operator at all.
 *
 * Every symbolic form tried before this one made the reader decode something:
 * "0 / 45" implied a ceiling that wasn't there, "18 < 45" changed which
 * benchmark the second number meant depending on the row's state, and
 * "45 < 18 < 100" is false on exactly the rows that matter. Stock leads and is
 * traffic-lit; the range sits beside it as a plain, unchanging reference.
 */

/**
 * The overview row counts products, not pounds.
 *
 * A combined weight across bacon and jerky answers no question anyone on the
 * floor is actually asking. "Five products are below par" does — so the tiles
 * read as a severity ladder, and each one is also the filter that shows you
 * which products it is talking about.
 *
 * "Put out now" deliberately overlaps "Low stock": it is the slice of low that
 * needs no production at all, which makes it the first thing worth doing.
 */
const FOCUS = [
  {
    id: "putOut",
    label: "Put out now",
    icon: ArrowRightCircle,
    tone: "primary",
    hint: "covered from the back",
    match: canPutOut,
  },
  {
    id: "low",
    label: "Low stock",
    icon: AlertTriangle,
    tone: "warn",
    hint: "below par — prep before it's gone",
    match: (i) => stockStatus(i) === "low",
  },
  {
    id: "out",
    label: "Out of stock",
    icon: PackageX,
    tone: "danger",
    hint: "nothing anywhere",
    match: (i) => stockStatus(i) === "out",
  },
  {
    id: "madePile",
    label: "To put away",
    icon: PackageCheck,
    tone: "neutral",
    hint: "made, still not filed",
    match: (i) => stockIn(i, "made") > 0,
  },
];

/**
 * Sync status and the refresh action are one fact, not two — "we're connected
 * to Clover" and "click here to re-check" are the same click target. A badge
 * plus a separate button said it twice and cost two control widths for it.
 *
 * The click itself is throttled locally: a register can get mashed, and
 * Clover's API doesn't need a request for every tap. One refresh goes out,
 * then the button won't fire again for REFRESH_COOLDOWN_MS regardless of how
 * fast `status` comes back — that's the caller's business, not the guard's.
 */
const REFRESH_COOLDOWN_MS = 4000;

function SourceBadge({ status, syncedAt, onRefresh }) {
  const [cooling, setCooling] = useState(false);
  const timerRef = useRef(null);

  const loading = status === "loading";
  const error = status === "error";
  const blocked = loading || cooling;
  const label = loading ? "Syncing…" : error ? "Unreachable" : syncedAt ? relativeTime(syncedAt) : "Sync";

  const handleClick = () => {
    if (blocked) return;
    onRefresh();
    setCooling(true);
    timerRef.current = setTimeout(() => setCooling(false), REFRESH_COOLDOWN_MS);
  };

  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={blocked}
      title={error ? "Clover unreachable — click to retry" : "Click to refresh from Clover"}
      className={cx(
        "inline-flex items-center gap-1.5 px-2.5 h-[var(--ctl-h)] rounded-full border",
        "text-xs font-medium transition-colors duration-100",
        blocked ? "cursor-wait opacity-70" : "",
        error
          ? "border-warn-line bg-warn-soft text-warn hover:bg-warn-soft"
          : "border-line bg-surface text-ink-3 hover:bg-hover hover:text-ink-2"
      )}
    >
      {error ? (
        <CloudOff size={12} className="shrink-0" />
      ) : (
        <RefreshCw size={12} className={cx("shrink-0", loading && "animate-spin")} />
      )}
      {label}
    </button>
  );
}

/* --------------------------------------------------------------- Move flow -- */

/**
 * One dialog for every hop — made → freezer, freezer → floor, and the returns
 * that go the other way — because the floor thinks in "move this there", not in
 * three separate transfer screens.
 */
function MoveDialog({ item, initialFrom, onCancel, onConfirm }) {
  const stocked = STOCK_STATES.filter((s) => stockIn(item, s.id) > 0);
  const [from, setFrom] = useState(
    stocked.some((s) => s.id === initialFrom) ? initialFrom : stocked[0]?.id || "made"
  );
  const [to, setTo] = useState(from === "floor" ? "freezer" : from === "made" ? "freezer" : "floor");
  const [amount, setAmount] = useState(stockIn(item, from));

  const available = stockIn(item, from);
  const invalid = amount <= 0 || amount > available;

  const pickFrom = (id) => {
    setFrom(id);
    setAmount(stockIn(item, id));
    if (to === id) setTo(id === "floor" ? "freezer" : "floor");
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={`Move ${item.product}`}
      icon={ArrowRightCircle}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="success" icon={ArrowRightCircle}
            disabled={invalid}
            onClick={() => onConfirm(item.product, from, to, amount)}
          >
            Move {amount || 0} {item.unit}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="From" hint={`${available} ${item.unit} available`}>
          <Segmented
            size="sm" value={from}
            onChange={pickFrom}
            options={STOCK_STATES.map((s) => ({
              value: s.id,
              label: s.short,
              icon: STATE_ICON[s.id],
              disabled: stockIn(item, s.id) <= 0,
            }))}
          />
        </Field>

        <Field
          label="To" hint={
            to === "floor"
              ? "Becomes sellable — Clover's floor count goes up."
              : "Location only. Clover's sellable total doesn't change."
          }
        >
          <Segmented
            size="sm" value={to}
            onChange={setTo}
            options={STOCK_STATES.map((s) => ({
              value: s.id,
              label: s.short,
              icon: STATE_ICON[s.id],
              disabled: s.id === from,
            }))}
          />
        </Field>

        <Field
          label={`Amount (${item.unit})`}
          error={invalid ? `Enter between 1 and ${available}.` : null}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number" size="lg" autoFocus
              value={amount}
              min={0}
              max={available}
              invalid={invalid}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="tnum flex-1"
            />
            <Button variant="secondary" onClick={() => setAmount(available)} className="shrink-0">
              All
            </Button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ Product card -- */
// ProductDialog moved out to app/components/ItemModal.jsx — standalone so the
// production board (and anywhere else a product name shows up) can open the
// same detail view instead of this screen owning the only copy.

function AddProductDialog({ existing, unit, onCancel, onAdd }) {
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState("");
  const [touched, setTouched] = useState(false);
  const duplicate = existing.some((p) => p.toLowerCase() === name.trim().toLowerCase());
  const valid = name.trim().length > 0 && !duplicate;
  const type = productType(name);

  // Follows the family as you type, until you disagree with it once.
  const suggested = defaultThreshold(name);
  const effective = touched && threshold !== "" ? Number(threshold) : suggested;

  return (
    <Modal
      open
      onClose={onCancel}
      title="Add a product" icon={Plus}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary" icon={Plus}
            disabled={!valid}
            onClick={() =>
              onAdd({
                product: name.trim(),
                type,
                made: 0,
                freezer: 0,
                floor: 0,
                threshold: effective || suggested,
                max: capacityFor(effective || suggested),
                unit,
              })
            }
          >
            Add product
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Product name" error={duplicate ? "That product already exists." : null}
          hint={duplicate ? null : "Appears on the schedule and the production board."}
        >
          <Input
            autoFocus
            value={name}
            invalid={duplicate}
            placeholder="e.g. Bratwurst - Cheddar Ranch" onChange={(e) => setName(e.target.value)}
          />
        </Field>

        {name.trim() && (
          <p className="text-xs text-ink-3">
            Filed under <span className="font-medium text-ink-2">{type}</span> — from the name.
          </p>
        )}

        <Field
          label={`Low-stock threshold (${unit})`}
          hint={`Flags the product once floor stock drops below this. ${DEFAULT_THRESHOLD} is the house minimum.`}
        >
          <Input
            type="number" value={threshold}
            placeholder={String(DEFAULT_THRESHOLD)}
            onChange={(e) => setThreshold(e.target.value)}
            className="tnum"
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Screen -- */

const EMPTY_FILTERS = { type: "all", state: "all", focus: null, tightCover: false };

/** The four orders the family dropdown's pinned button cycles through. */
const FAMILY_SORTS = [
  { label: "A\u2013Z", icon: ArrowDownAZ, compare: (a, b) => a.type.localeCompare(b.type) },
  { label: "Z\u2013A", icon: ArrowUpAZ, compare: (a, b) => b.type.localeCompare(a.type) },
  { label: "Most flagged first", icon: ArrowDownWideNarrow, compare: (a, b) => b.need - a.need },
  { label: "Fewest flagged first", icon: ArrowUpWideNarrow, compare: (a, b) => a.need - b.need },
];

export default function InventoryScreen({
  inventory,
  velocity = {},
  status,
  syncedAt,
  canManage,
  onRefresh,
  onMove,
  onAddProduct,
  onUpdateProduct,
  onRemoveProduct,
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [moving, setMoving] = useState(null);
  const [detail, setDetail] = useState(null);
  const [adding, setAdding] = useState(false);
  const [familySort, setFamilySort] = useState(0);

  const unit = inventory[0]?.unit || "lb";
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const rate = (item) => velocity[item.product];

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FOCUS.map((f) => [f.id, inventory.filter(f.match).length])
      ),
    [inventory]
  );

  /** The single product closest to running dry — the headline cover figure. */
  const tightest = useMemo(() => {
    let worst = null;
    for (const item of inventory) {
      const days = daysOfCover(item, velocity[item.product]);
      if (days == null) continue;
      if (!worst || days < worst.days) worst = { item, days };
    }
    return worst;
  }, [inventory, velocity]);

  const hasVelocity = Object.keys(velocity).length > 0;

  const activeFocus = FOCUS.find((f) => f.id === filters.focus) || null;

  // Held by name, not by object: the row it came from is replaced on every
  // edit, and a captured copy would keep showing stale counts.
  const detailItem = detail ? inventory.find((i) => i.product === detail) : null;

  /** Products needing attention, by family — i.e. which station to staff. */
  const families = useMemo(() => {
    const tally = {};
    for (const item of inventory) {
      const family = item.type || productType(item.product);
      const status = stockStatus(item);
      tally[family] = tally[family] || { total: 0, need: 0 };
      tally[family].total += 1;
      if (status !== "ok") tally[family].need += 1;
    }
    return PRODUCT_TYPES.filter((t) => tally[t]).map((t) => ({ type: t, ...tally[t] }));
  }, [inventory]);


  const visible = useMemo(() => {
    return inventory.filter((item) => {
      if (!item.product.toLowerCase().includes(query.toLowerCase())) return false;
      if (filters.type !== "all" && (item.type || productType(item.product)) !== filters.type)
        return false;
      if (filters.state !== "all" && stockIn(item, filters.state) <= 0) return false;

      if (filters.focus) {
        const focus = FOCUS.find((f) => f.id === filters.focus);
        if (focus && !focus.match(item)) return false;
      }

      if (filters.tightCover) {
        const days = daysOfCover(item, velocity[item.product]);
        if (days == null || days >= COVER_WARN_DAYS) return false;
      }

      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, query, filters, velocity]);

  /* The list sections by family rather than running flat, and the family
   * filter above narrows which sections are on screen instead of being the
   * only way to see one family at a time. PRODUCT_TYPES fixes the order, so
   * the case reads the same way every visit; a family the catalogue has
   * invented since then still gets a heading, appended alphabetically, so
   * nothing can quietly fall out of the list. A single remaining family is
   * still given its heading — a list that stops sectioning itself once it is
   * short reads as broken rather than tidy. */
  const groups = useMemo(() => {
    const byFamily = new Map();
    for (const item of visible) {
      const family = item.type || productType(item.product);
      const list = byFamily.get(family);
      if (list) list.push(item);
      else byFamily.set(family, [item]);
    }
    const known = PRODUCT_TYPES.filter((t) => byFamily.has(t));
    const extra = [...byFamily.keys()]
      .filter((t) => !PRODUCT_TYPES.includes(t))
      .sort((a, b) => a.localeCompare(b));
    return [...known, ...extra].map((type) => ({ type, items: byFamily.get(type) }));
  }, [visible]);

  const activeCount =
    (filters.type !== "all" ? 1 : 0) +
    (filters.state !== "all" ? 1 : 0) +
    (filters.focus ? 1 : 0) +
    (filters.tightCover ? 1 : 0);

  const clearAll = () => {
    setQuery("");
    setFilters(EMPTY_FILTERS);
  };

  return (
    <div>
      <StatGrid>
        {FOCUS.map((f) => (
          <StatCard
            key={f.id}
            icon={f.icon}
            label={f.label}
            value={counts[f.id]}
            tone={counts[f.id] ? f.tone : "neutral"}
            hint={
              f.id === "putOut" && counts.low
                ? `${counts.putOut} of the ${counts.low} low`
                : f.hint
            }
            active={filters.focus === f.id}
            onClick={() => set({ focus: filters.focus === f.id ? null : f.id })}
          />
        ))}
      </StatGrid>

      {/* Search sits beside the title; it is the one control that belongs
          up there because it acts on the whole page, not just the list. */}
      <Slot name="page-actions">
        <SearchInput
          pill
          value={query}
          onChange={setQuery}
          placeholder="Search products…"
          className="w-40 sm:w-56 lg:w-64"
        />
      </Slot>

      {/* Under the title: which product runs dry first, once Clover has given
          us a sales pace. Page-level context, not a way to narrow the list. */}
      <Slot name="page-subtitle">
        {tightest && (
          <span>
            <span className="font-medium text-ink">{tightest.item.product}</span> runs out first —{" "}
            <span className={cx("font-medium tnum", COVER_TONE[coverTone(tightest.days)])}>
              {tightest.days} days
            </span>{" "}
            on the floor at the last four weeks&rsquo; pace.
          </span>
        )}
      </Slot>

      {/* One sticky toolbar, the same one Tasks and Team use: the filters that
       *  narrow the list and what they did to it on the left, the page's own
       *  actions on the right. It stays put while the case scrolls under it
       *  and fades its own trailing edge, so a half-scrolled row doesn't cut
       *  off on a hard line. StickyFadeHeader's defaults already match this
       *  spot in the layout, so there is nothing to override here. */}
      <StickyFadeHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Dropdown
                value={filters.type}
                on={filters.type !== "all"}
                onChange={(v) => set({ type: v })}
                aria-label="Family"
                pinned={
                  <Tooltip label={`Sorted ${FAMILY_SORTS[familySort].label.toLowerCase()} — tap to cycle`}>
                    <button
                      type="button"
                      aria-label={`Sort families: ${FAMILY_SORTS[familySort].label}`}
                      onClick={() => setFamilySort((i) => (i + 1) % FAMILY_SORTS.length)}
                      className="w-full flex items-center justify-center h-[var(--row-h)] rounded-md text-ink-3 hover:text-ink-2 hover:bg-faint transition-colors duration-100"
                    >
                      {React.createElement(FAMILY_SORTS[familySort].icon, { size: 16 })}
                    </button>
                  </Tooltip>
                }
                options={[
                  { value: "all", label: "All families" },
                  ...families
                    .slice()
                    .sort(FAMILY_SORTS[familySort].compare)
                    .map((f) => ({
                      value: f.type,
                      label: f.need ? `${f.type} (${f.need})` : f.type,
                    })),
                ]}
              />

              <Dropdown
                value={filters.state}
                on={filters.state !== "all"}
                onChange={(v) => set({ state: v })}
                aria-label="Stock location"
                options={[
                  { value: "all", label: "All locations" },
                  ...STOCK_STATES.map((st) => ({ value: st.id, label: st.short })),
                ]}
              />

              {/* The hover explains WHEN this turns on, not what it computes —
                  that's the thing a greyed-out control actually leaves you
                  wondering. */}
              <Tooltip
                label={
                  hasVelocity
                    ? `Shows items with less than ${COVER_WARN_DAYS} days of cover — updates nightly from Clover sales`
                    : "Turns on once Clover has about 4 weeks of sales history"
                }
              >
                <Dropdown
                  icon={Timer}
                  value={filters.tightCover ? "tight" : "any"}
                  on={filters.tightCover}
                  disabled={!hasVelocity}
                  onChange={(v) => set({ tightCover: v === "tight" })}
                  aria-label="Cover"
                  options={[
                    { value: "any", label: "Any cover" },
                    { value: "tight", label: `Under ${COVER_WARN_DAYS}d cover` },
                  ]}
                />
              </Tooltip>
            </div>

            <span className="text-xs text-ink-3 truncate">
              {visible.length === inventory.length
                ? `${inventory.length} products`
                : `${visible.length} of ${inventory.length} products`}
              {activeFocus && <> · {activeFocus.label.toLowerCase()}</>}
              {(activeCount > 0 || query) && (
                <>
                  {" · "}
                  <button
                    type="button" onClick={clearAll}
                    className="font-medium text-ink-2 hover:text-ink hover:underline"
                  >
                    Clear all
                  </button>
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <SourceBadge status={status} syncedAt={syncedAt} onRefresh={onRefresh} />
            {canManage && (
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add product
              </Button>
            )}
          </div>
        </div>
      </StickyFadeHeader>

      <div className="space-y-5">
        {status === "loading" ? (
          <SkeletonRows rows={4} />
        ) : visible.length === 0 ? (
          <div className="border-b border-line">
            <EmptyState
              icon={Package}
              title={query || activeCount ? "No matching products" : "No products yet"}
              description={
                query || activeCount
                  ? "Try a wider weight range, another family, or clear the filters."
                  : "Products sync in from Clover, or add one by hand."
              }
              action={
                query || activeCount ? <Button onClick={clearAll}>Clear filters</Button> : null
              }
            />
          </div>
        ) : (
          groups.map(({ type, items }) => {
            const Icon = FAMILY_ICON[type] || Package;
            return (
              <div key={type}>
                <SectionHeading icon={Icon} label={type} count={items.length} />

                {/* Nested under its heading rather than flush with it — with
                 *  no box or divider around the list, the indent is what
                 *  reads as "these belong to that heading". */}
                <ul className="pl-6">
                  {items.map((item) => {
                    const state = stockStatus(item);
                    const low = state !== "ok";
                    const back = behindStock(item);
                    const floor = stockIn(item, "floor");
                    const made = stockIn(item, "made");
                    const refill = refillQty(item);
                    const cover = daysOfCover(item, rate(item));
                    const hasStock = totalStock(item) > 0;
                    /* What this row can actually put out, in one figure: the
                     * amount that fills the case, capped by what is really
                     * standing behind it. Promising a refill the freezer
                     * cannot cover is the same fetch-what-isn't-there
                     * instruction as asking for it with nothing in back. */
                    const putOut = low && back > 0 ? Math.min(refill, back) : 0;
                    return (
                      <li
                        key={item.product}
                        className="group flex items-center gap-3 py-3 px-1 rounded-md transition-colors hover:bg-faint"
                      >
                        {/* The whole content area is the trigger, so the tap
                            target matches what the row looks like; Move stays
                            a sibling rather than a nested control. */}
                        <button
                          type="button"
                          onClick={() => setDetail(item.product)}
                          className="min-w-0 text-left flex-1 rounded-md"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{item.product}</p>
                            {/* Only the states that need doing carry a marker.
                                The family chip that used to sit here is gone —
                                the section heading above already said it, and
                                "In stock" was a badge for the absence of a
                                problem. */}
                            {state === "out" ? (
                              <Badge tone="danger" icon={PackageX}>
                                Out
                              </Badge>
                            ) : state === "low" ? (
                              <Badge tone="warn" icon={AlertTriangle}>
                                Low
                              </Badge>
                            ) : null}
                          </div>

                          {/* One number leads the row.
                              Four values at one size, in one run-on line, made
                              the reader read all four to find the one that
                              says whether to act. The floor count is that one
                              — it is the only sellable weight and the only
                              figure the row's button changes — so it sits a
                              step up in size and weight, first on the line
                              where it aligns down the column, and everything
                              else drops to quiet reference beside it. */}
                          <div className="mt-1 flex items-center flex-wrap gap-x-3 gap-y-1 tnum">
                            <span
                              title={`${floor} ${item.unit} out front and sellable`}
                              className="inline-flex items-baseline gap-1"
                            >
                              <Store size={11} className="self-center text-icon-2" />
                              {/* Only the stock figure carries the alarm — the
                                  range it is measured against is never the
                                  problem. */}
                              <span className={cx("text-sm font-semibold", FLOOR_TONE[state])}>
                                {floor}
                              </span>
                              <span className="text-xs text-ink-3">{item.unit} on floor</span>
                            </span>

                            {/* One shape in every state, so there is nothing to
                                decode: the same two bounds, in the same order,
                                whether stock is fine or on the floor at zero. */}
                            <span
                              className="text-xs text-ink-4"
                              title={`Flagged low under ${item.threshold} ${item.unit}; a full case is ${item.max} ${item.unit}`}
                            >
                              target {item.threshold}&ndash;{item.max}
                            </span>

                            {cover != null && (
                              <span
                                className={cx(
                                  "inline-flex items-center gap-1 text-xs",
                                  {
                                    danger: "text-danger",
                                    warn: "text-warn",
                                    ok: "text-ink-4",
                                    muted: "text-ink-4",
                                  }[coverTone(cover)]
                                )}
                              >
                                <Timer size={11} /> {cover}d cover
                              </span>
                            )}

                            {/* Made and freezer differ only in whether someone
                                has put the stock away — neither is sellable —
                                so they read as one number, and only split when
                                the made pile is non-empty and that put-away
                                work actually exists.

                                With nothing behind the floor there is no
                                quantity worth printing: a row at 0 back is not
                                a fetch that hasn't been done, it is a batch
                                that hasn't been made, and it should say so
                                rather than leave "0 lb back" to be read as an
                                amount someone could go and carry. */}
                            {back > 0 ? (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-ink-4"
                                title="Held back: made plus freezer. Neither is sellable until it is out front."
                              >
                                <Snowflake size={11} className="text-cold" />
                                {back} {item.unit} back
                                {made > 0 && <span>({made} not put away)</span>}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-ink-4"
                                title="Nothing made and nothing in the freezer — the case can only be filled by a batch."
                              >
                                <Snowflake size={11} />
                                nothing in back{low && " \u2014 needs a batch"}
                              </span>
                            )}
                          </div>
                        </button>

                        {/* `always`: this is the floor terminal — a gloved
                         *  hand on a wall tablet gets no hover, so a row's
                         *  actions are part of the row, not a reveal.
                         *
                         *  Putting stock out is the whole job of this screen,
                         *  so on a row that needs it the action is spelled
                         *  out and carries its own quantity instead of being
                         *  an icon plus a number parked in the meta line.
                         *  It opens the same Move dialog from the same side —
                         *  the amount is still confirmable there, because the
                         *  case is not always worth filling to the top.
                         *  It stays a plain control, not a second filled
                         *  accent: on a list this long that colour would be
                         *  the loudest thing on the screen. */}
                        {putOut > 0 ? (
                          <RowActions always>
                            <Button
                              aria-label={`Put out ${putOut} ${item.unit} of ${item.product}`}
                              icon={ArrowRightCircle}
                              onClick={() =>
                                setMoving({
                                  item,
                                  from: stockIn(item, "made") > 0 ? "made" : "freezer",
                                })
                              }
                            >
                              Put out {putOut} {item.unit}
                            </Button>
                          </RowActions>
                        ) : hasStock ? (
                          <RowActions always>
                            <IconButton
                              label={`Move ${item.product}`}
                              icon={ArrowRightCircle}
                              onClick={() =>
                                setMoving({
                                  item,
                                  from: stockIn(item, "made") > 0 ? "made" : "freezer",
                                })
                              }
                            />
                          </RowActions>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </div>

      {detailItem && (
        <ItemModal
          item={detailItem}
          perDay={rate(detailItem)}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onSave={(product, patch) => {
            onUpdateProduct(product, patch);
            setDetail(null);
          }}
          onRemove={(product) => {
            onRemoveProduct(product);
            setDetail(null);
          }}
          onMove={(item) => {
            setDetail(null);
            setMoving({ item, from: stockIn(item, "made") > 0 ? "made" : "freezer" });
          }}
        />
      )}

      {moving && (
        <MoveDialog
          item={moving.item}
          initialFrom={moving.from}
          onCancel={() => setMoving(null)}
          onConfirm={(product, from, to, amount) => {
            onMove(product, from, to, amount);
            setMoving(null);
          }}
        />
      )}

      {adding && (
        <AddProductDialog
          existing={inventory.map((i) => i.product)}
          unit={unit}
          onCancel={() => setAdding(false)}
          onAdd={(item) => {
            onAddProduct(item);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
