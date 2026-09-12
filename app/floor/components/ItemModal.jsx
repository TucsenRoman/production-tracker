"use client";

import React, { useState } from "react";
import { AlertTriangle, ArrowRightCircle, Flame, PackageX, Timer, Trash2 } from "lucide-react";

import { Badge, Button, Field, Input, Modal, ProgressBar, Segmented, cx } from "../../components/ui";
import {
  PRODUCT_TYPES,
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
} from "../../lib/domain";

/** Traffic light on the floor count: nothing / below par / at or over par. */
const FLOOR_TONE = { out: "text-danger", low: "text-warn", ok: "text-ok" };

/**
 * Detail view for one inventory item, standalone so any screen that knows a
 * product name can open it.
 *
 * The name is shown but not editable: it is the key that ties this record to
 * Clover's catalogue, sales velocity, and finished batches. A rename belongs
 * in Clover.
 *
 * Callers own the data and side effects; this renders a normalized `item`
 * (see `normalizeItem` in `lib/domain.js`) and calls back:
 *   - onClose()               — dismiss with no changes
 *   - onSave(product, patch)  — commit edited threshold/max/type/unit
 *   - onRemove(product)       — delete (only offered at zero stock)
 *   - onMove(item)            — hand off to the caller's move flow
 *   - onPutOut(product)       — one-tap: made + freezer -> floor
 * Nothing here is gated; the stock move asks `approve()` in the caller.
 *
 * `activeBatches`, `scheduledToday` and `recentBatches` are optional context,
 * pre-filtered to this product. Omitted, their sections don't render.
 */
export default function ItemModal({
  item,
  perDay,
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
  // Shared by the progress bar's minimum marker and its label so they can't drift.
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
          {total === 0 && (
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

        {/* Floor stock against the target range. */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>Floor vs. target</span>
            <span className="tnum">
              {stockIn(item, "floor")} / {item.max} {item.unit}
            </span>
          </div>
          {/* The minimum as a point on the same track. The label sits in the
              top padding of the outer box, not the inner one around bar+dot,
              so that inner box stays bar-height and `top-1/2` on the dot
              still centers on the bar. */}
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

        {/* Stock already moving toward this item but not in made/freezer/floor
            yet: a batch in production, or a quantity on today's schedule. */}
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
                    .map((b) => `${b.boxWeight || b.estWeight} lb in ${b.stage}`)
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

        {/* The last few closed batches for this product. */}
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

        {/* One-tap shortcut: everything behind the floor moves there in one
            step, instead of the from/to/amount picker `onMove` opens. */}
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
