"use client";

import React, { useState } from "react";
import { AlertTriangle, ArrowRightCircle, Flame, PackageX, Timer, Trash2 } from "lucide-react";

import { Badge, Button, Field, Input, Modal, ProgressBar, Segmented, cx } from "./ui";
import {
  PRODUCT_TYPES,
  STAGES,
  STATE_ICON,
  STOCK_STATES,
  behindStock,
  canPutOut,
  coverTone,
  daysOfCover,
  floorDeficit,
  formatDay,
  potentialCover,
  productType,
  refillQty,
  stockIn,
  stockStatus,
  totalStock,
  yieldPct,
} from "../lib/domain";

/** Traffic light on the floor count: nothing / below par / at or over par. */
const FLOOR_TONE = { out: "text-danger", low: "text-warn", ok: "text-ok" };

/**
 * Everything known about one inventory item, and the few things worth
 * changing — standalone so any screen that knows a product name (Inventory's
 * own list, the production board, wherever else a batch or a schedule entry
 * points at a product) can open the same detail view for it.
 *
 * The name is shown but not editable: it is the key that ties this record to
 * Clover's catalogue, to sales velocity, and to any batch that finished into
 * it. Renaming here would quietly orphan all three, so a rename belongs in
 * Clover, where the name actually originates.
 *
 * Callers own the data and the side effects — this component only renders
 * `item` (a normalized inventory record, see `normalizeItem` in
 * `lib/domain.js`) and calls back:
 *   - onClose()                         — dismiss with no changes
 *   - onSave(product, patch)            — commit edited threshold/max/type/unit
 *   - onRemove(product)                 — delete (only offered at zero stock)
 *   - onMove(item)                      — hand off to the caller's move flow
 *   - onPutOut(product)                 — one-tap: made + freezer -> floor
 * `canManage` hides every editing affordance (and the whole "manage" section
 * degrades to a read-only summary) for roles that shouldn't see it.
 *
 * `activeBatches`, `scheduledToday` and `recentBatches` are optional context
 * a caller can pre-compute from its own state (batches, schedule, history —
 * none of which this component knows the shape of beyond what's documented
 * at each prop below) and hand in pre-filtered to this product. Any screen
 * that can't supply one just omits it; the section it would have fed simply
 * doesn't render.
 */
export default function ItemModal({
  item,
  perDay,
  canManage,
  activeBatches = [],
  scheduledToday = [],
  recentBatches = [],
  onClose,
  onSave,
  onMove,
  onRemove,
  onPutOut,
}) {
  const family = item.type || productType(item.product);
  const [threshold, setThreshold] = useState(String(item.threshold));
  const [max, setMax] = useState(String(item.max));
  const [type, setType] = useState(family);
  const [unit, setUnit] = useState(item.unit);

  const status = stockStatus(item);
  const cover = daysOfCover(item, perDay);
  const potential = potentialCover(item, perDay);
  const short = floorDeficit(item);
  const total = totalStock(item);
  const refill = refillQty(item);
  // Shared by the progress bar's minimum marker and its label, so the two
  // can't end up at slightly different positions.
  const minPct = Math.min(100, (item.threshold / item.max) * 100);
  const nextThreshold = Number(threshold);
  const nextMax = Number(max);

  const minInvalid = !Number.isFinite(nextThreshold) || nextThreshold <= 0;
  // A max at or below the min would make "full" and "too low" the same number.
  const maxInvalid = !Number.isFinite(nextMax) || nextMax <= nextThreshold;
  const invalid = minInvalid || maxInvalid;
  const dirty =
    !invalid &&
    (nextThreshold !== item.threshold ||
      nextMax !== item.max ||
      type !== family ||
      unit !== item.unit);

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={item.product}
      icon={STATE_ICON.floor}
      footer={
        <>
          {canManage && total === 0 && (
            <Button
              variant="ghost"
              icon={Trash2}
              className="mr-auto text-danger"
              onClick={() => onRemove(item.product)}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {canManage && (
            <Button
              variant="primary"
              disabled={!dirty}
              onClick={() =>
                onSave(item.product, {
                  threshold: nextThreshold,
                  max: nextMax,
                  type,
                  unit: unit.trim() || "lb",
                })
              }
            >
              Save changes
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          {status === "out" ? (
            <Badge tone="danger" icon={PackageX}>
              Out of stock
            </Badge>
          ) : status === "low" ? (
            <Badge tone="warn" icon={AlertTriangle}>
              Low stock
            </Badge>
          ) : (
            <Badge tone="ok">In stock</Badge>
          )}
          {canPutOut(item) && (
            <Badge tone="info" icon={ArrowRightCircle}>
              Can be covered from the back
            </Badge>
          )}
          {short > 0 && (
            <span className="text-xs text-ink-3 tnum">
              <span className="text-danger font-medium">
                {short} {item.unit} under the minimum
              </span>
              {refill > 0 && <> · bring {refill} {item.unit} to fill the case</>}
            </span>
          )}
        </div>

        {/* Floor stock against the target range — the two numbers below
            (threshold-max) read as a fraction anywhere else in the app, but
            here there's room to actually show the gap. */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>Floor vs. target</span>
            <span className="tnum">
              {stockIn(item, "floor")} / {item.max} {item.unit}
            </span>
          </div>
          {/* The minimum as a point on the same track, not a second number
              to cross-reference — where the floor sits relative to it is the
              whole question "low stock" is answering, and the value labeled
              right above it means neither the point nor the number needs the
              other read first. `minPct` is shared by both so they can never
              drift apart. The label sits in the top padding of the outer
              `relative` box, not the inner one around the bar+dot — that
              inner box stays exactly bar-height, so `top-1/2` on the dot
              still centers on the bar the same way it did with no label. */}
          <div className="relative pt-5">
            <span
              className="absolute top-0 -translate-x-1/2 text-xs font-medium text-ink-3 tnum whitespace-nowrap"
              style={{ left: `${minPct}%` }}
            >
              {item.threshold} {item.unit}
            </span>
            <div className="relative">
              <ProgressBar
                value={(stockIn(item, "floor") / item.max) * 100}
                tone={status === "out" ? "danger" : status === "low" ? "warn" : "ok"}
              />
              <div
                title={`Minimum: ${item.threshold} ${item.unit}`}
                className="absolute top-1/2 w-1.5 h-1.5 rounded-full bg-ink ring-2 ring-surface"
                style={{ left: `${minPct}%`, transform: "translate(-50%, -50%)" }}
              />
            </div>
          </div>
        </div>

        {/* Where the stock physically is, in the order it moves. */}
        <div className="rounded-md border border-line overflow-hidden">
          {STOCK_STATES.map((state) => {
            const Icon = STATE_ICON[state.id];
            const qty = stockIn(item, state.id);
            return (
              <div
                key={state.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-line last:border-0"
              >
                <span className="inline-flex items-center gap-2 text-sm text-ink-2">
                  <Icon size={13} className={cx("shrink-0", state.id === "freezer" && "text-cold")} />
                  {state.label}
                  <span className="text-xs text-ink-4">{state.hint}</span>
                </span>
                <span
                  className={cx(
                    "text-sm font-medium tnum",
                    state.id === "floor" ? FLOOR_TONE[status] : qty > 0 ? "text-ink" : "text-ink-4"
                  )}
                >
                  {qty} {item.unit}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-sunken">
            <span className="text-sm font-medium text-ink">Total</span>
            <span className="text-sm font-semibold text-ink tnum">
              {total} {item.unit}
            </span>
          </div>
        </div>

        {/* What's already moving toward this item but isn't in made/freezer/
            floor yet — a batch still in the smokehouse, or a quantity on
            today's schedule that hasn't started. Neither shows up anywhere
            else once a batch or a schedule entry exists for this product. */}
        {(activeBatches.length > 0 || scheduledToday.length > 0) && (
          <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-md bg-canvas border border-line">
            <Flame size={15} className="shrink-0 mt-px text-warn" />
            <div className="text-xs text-ink-2 leading-relaxed space-y-1">
              {activeBatches.length > 0 && (
                <p>
                  <span className="font-medium">
                    {activeBatches.length} batch{activeBatches.length > 1 ? "es" : ""}
                  </span>{" "}
                  in production — {activeBatches
                    .map((b) => `${b.boxWeight || b.estWeight} lb in ${STAGES[b.stage]}`)
                    .join(", ")}
                </p>
              )}
              {scheduledToday.length > 0 && (
                <p>
                  Scheduled today: {scheduledToday
                    .map((t) => `${t.qty} ${t.unit} (${t.station})`)
                    .join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* The last few closed batches for this product — enough to eyeball
            whether the most recent run was normal, without a trip to
            Insights. */}
        {recentBatches.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-ink-3">Recent batches</p>
            <ul className="space-y-1">
              {recentBatches.map((b) => {
                const pct = yieldPct(b.boxWeight, b.finalWeight);
                return (
                  <li key={b.id} className="flex items-center justify-between text-xs text-ink-2">
                    <span className="text-ink-3">{formatDay(b.closedOn)}</span>
                    <span className="tnum">
                      {b.finalWeight} {item.unit}
                      {pct != null && <span className="text-ink-3"> · {pct}% yield</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {cover != null ? (
          <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-md bg-canvas border border-line">
            <Timer
              size={15}
              className={cx(
                "shrink-0 mt-px",
                { danger: "text-danger", warn: "text-warn", ok: "text-ok", muted: "text-ink-3" }[
                  coverTone(cover)
                ]
              )}
            />
            <div className="text-xs text-ink-2 leading-relaxed">
              <span className="font-medium">{cover} days</span> of cover on the floor at the last 4
              weeks&rsquo; pace ({perDay} {item.unit}/day)
              {potential != null && potential !== cover && (
                <> · {potential} days once everything behind it is put out</>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-4">
            No sales pace for this product yet, so there is no days-of-cover figure.
          </p>
        )}

        {canManage ? (
          <div className="space-y-4 pt-1 border-t border-line">
            <div className="grid grid-cols-2 gap-3 pt-4">
              <Field
                label={`Minimum (${unit})`}
                error={minInvalid ? "Above zero." : null}
                hint={minInvalid ? null : "Flagged low below this."}
              >
                <Input
                  type="number"
                  value={threshold}
                  invalid={minInvalid}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="tnum"
                />
              </Field>

              <Field
                label={`Full case (${unit})`}
                error={maxInvalid ? "Must exceed the minimum." : null}
                hint={maxInvalid ? null : "What a stocker fills to."}
              >
                <Input
                  type="number"
                  value={max}
                  invalid={maxInvalid}
                  onChange={(e) => setMax(e.target.value)}
                  className="tnum"
                />
              </Field>
            </div>

            <Field label="Family" hint="Guessed from the name — correct it if the guess is wrong.">
              <Segmented
                size="sm"
                scroll
                value={type}
                onChange={setType}
                options={PRODUCT_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </Field>

            <Field label="Unit" hint="Whatever this product is counted in.">
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="max-w-24" />
            </Field>
          </div>
        ) : (
          <p className="text-xs text-ink-4 border-t border-line pt-4">
            Minimum {item.threshold} {item.unit} · full case {item.max} {item.unit} · {family}. Ask a
            manager to change these.
          </p>
        )}

        {/* The one-tap shortcut for the common case — everything behind the
            floor moves there in a single step, instead of the from/to/amount
            picker `onMove` opens for anything less mechanical. */}
        {canPutOut(item) && onPutOut && (
          <Button
            block
            variant="success"
            icon={ArrowRightCircle}
            onClick={() => onPutOut(item.product)}
          >
            Put out {behindStock(item)} {item.unit}
          </Button>
        )}

        {total > 0 && (
          <Button
            block
            variant="secondary"
            icon={ArrowRightCircle}
            onClick={() => onMove(item)}
          >
            Move stock
          </Button>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- Roadmap --
 * From the "item modal" brainstorm (2026-08-31/09-01) — narrowed to three
 * tiers. Everything above this line is the "Now" tier, built and wired in.
 * "Next" and "Later" are sketched here, in this file, so whoever picks one
 * up next finds the shape already thought through instead of starting from
 * a blank brainstorm. Nothing below this comment is live code.
 *
 * NEXT — small, real value, needs a bit more than pure UI:
 *
 * 1. One-tap "put away" (made -> freezer) — the mirror of the "Put out"
 *    button above, backed by `putAway` (sketched, commented out, right next
 *    to `putOnFloor` in lib/domain.js). Would read:
 *
 *      {stockIn(item, "made") > 0 && onPutAway && (
 *        <Button block variant="secondary" icon={Snowflake}
 *          onClick={() => onPutAway(item.product)}>
 *          Put away {stockIn(item, "made")} {item.unit}
 *        </Button>
 *      )}
 *
 * 2. Days-of-cover framing next to the raw lb minimum — so tuning the
 *    threshold means something in real terms, not just a number picked by
 *    feel:
 *
 *      {perDay > 0 && (
 *        <p className="text-xs text-ink-4">
 *          At the current pace, {COVER_WARN_DAYS} days of cover would be
 *          about {Math.round(perDay * COVER_WARN_DAYS)} {unit}.
 *        </p>
 *      )}
 *
 * 3. Family comparison line — the Inventory screen's `families` tally
 *    (see InventoryScreen.jsx) already computes "N of M {family} products
 *    need attention"; passing the one entry for this item's family down as
 *    a `familyStats={{ type, need, total }}` prop would let this modal show
 *    it without recomputing anything:
 *
 *      {familyStats && (
 *        <p className="text-xs text-ink-4">
 *          {familyStats.need} of {familyStats.total} {familyStats.type}{" "}
 *          products need attention.
 *        </p>
 *      )}
 *
 * LATER — real ideas, but each needs new persisted state or a data-model
 * change before it's just a UI job. Parked, not planned:
 *
 * 4. Freeform product notes — a `note` field on the inventory item itself
 *    (`item.note`), edited here the same way threshold/max are, shown to
 *    everyone but only editable by `canManage`.
 *
 * 5. Change audit trail — "who moved stock / edited this last, and when".
 *    Batches already track `lastActionBy` (see BoardScreen.jsx) as a
 *    precedent; inventory items don't track anything like it today, so this
 *    means adding `lastChangedBy`/`lastChangedAt` wherever `onSave` and
 *    `onMove`/`onPutOut` write back to the item.
 *
 * 6. Linked to-do tasks — To-Do tasks (see TodoScreen.jsx / SEED.todos in
 *    lib/domain.js) reference a product only by accident, in free-text
 *    titles. A real link needs a `relatedProduct` field on new tasks going
 *    forward; a fuzzy title-includes-product-name match would work without
 *    a schema change but would misfire on partial name overlaps.
 *
 * 7. Day-of-week / seasonal targets — today threshold/max are one flat
 *    number per product, forever. A weekend-vs-weekday (or promo-window)
 *    override is a real data-model change: which target applies "today"
 *    stops being a pure function of the item and starts depending on the
 *    calendar.
 * ------------------------------------------------------------------------- */
