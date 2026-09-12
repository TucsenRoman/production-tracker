"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Flame,
  LayoutGrid,
  PackageCheck,
  Play,
  Plus,
  Scale,
  Snowflake,
  Store,
  UserCheck,
  X,
  Zap,
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
  ScreenToolbar,
  Segmented,
  Slot,
  Tooltip,
  cx,
  scrollAppToToolbar,
} from "../../components/ui";
import { formatDay, weighsInAt, yieldPct, yieldTone } from "../../lib/domain";
import { useStations } from "../../lib/stations";

/**
 * Hairline column rule for the yield ticker. Declared at module scope so
 * React does not remount it every render. `h-2` centres on the text, so
 * nothing else in the row may carry a vertical nudge or the rule centres
 * against the taller flex line instead.
 */
const Rule = () => (
  <span className="w-[0.5px] h-2 self-center rounded-full bg-line" aria-hidden="true" />
);

function YieldTicker({ stats }) {
  const delta = stats.yieldDelta;
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;

  return (
    /* Ticker rules: one row, one size, one weight; only colour and the
     * direction glyph vary. `tnum` keeps the digits from changing width as
     * the yield moves. */
    <Tooltip label={
          stats.yieldPrevDay
            ? `Change against ${formatDay(stats.yieldPrevDay)}, the last recorded yield.`
            : undefined
        }>
      <div className="flex items-center gap-2.5 text-xs font-normal leading-none" >
        <span className="inline-flex items-baseline gap-1.5">
          <span className="text-ink-4">Yield today {stats.avgYield}%</span>
        </span>

        {delta != null && (
          <>
            <Rule />
            <span
              className={cx(
                "inline-flex items-center gap-1 tnum",
                /* Lightened off the full token so the delta is not the heaviest
                   ink in the header. Both directions get the same alpha so a
                   fall never lands heavier than a rise. */
                up ? "text-ok/70" : down ? "text-danger/70" : "text-ink-4",
              )}
            >
              {(up || down) && (
                <DeltaTriangle size={4} down={down} />
              )}

              {delta.toFixed(1)}pts
            </span>
            <span>
              {stats.yieldDeltaPct != null && (
                <span className="text-ink-4">
                  {stats.yieldDeltaPct > 0 ? "+" : ""}{stats.yieldDeltaPct.toFixed(1)}%
                </span>
              )}
            </span>
          </>
        )}
      </div>
    </Tooltip>
  );
}

/**
 * Direction glyph: a narrow 4:5 triangle filling its viewBox edge to edge.
 * Lucide's `Triangle` has so much internal padding that at ticker sizes it
 * reads as a blob. Down is the same path rotated, never a second shape, so
 * both directions carry identical visual weight.
 */
function DeltaTriangle({ size = 6, down = false, className }) {
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 8 10"
      fill="currentColor"
      aria-hidden="true"
      className={cx("shrink-0", down && "rotate-180", className)}
    >
      <path d="M4 0 8 10 0 10Z" />
    </svg>
  );
}

/* The level is deliberately flat `text-ink-4`: on this row the level is
 * context and the change is the news. `stats.yieldTone` is still computed if
 * a bad shift should ever tint the level here. */

/* --------------------------------------------------------------- Overview -- */

function StageColumn({ stage, batches }) {
  const { iconFor } = useStations();
  const Icon = iconFor(stage);
  return (
    <div className="shrink-0 snap-start w-[78vw] max-w-[280px] sm:w-auto sm:max-w-none">
      <div className="flex items-center gap-2 px-1 pb-2.5">
        <Icon size={14} className="text-ink-3 shrink-0" />
        <span className="text-xs font-medium text-ink-3">{stage}</span>
        <span className="ml-auto text-xs font-medium tnum px-1.5 rounded-full bg-sunken text-ink-3">
          {batches.length}
        </span>
      </div>

      <div className="space-y-2 min-h-20">
        {batches.length === 0 && (
          <div className="rounded-md border border-dashed border-line py-6 text-xs text-ink-4">
            Nothing here
          </div>
        )}
        {batches.map((b) => (
          <Card key={b.id} className="px-3.5 py-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-mono text-ink-4">{b.id}</span>
              {b.needsSmoke && <Flame size={12} className="text-warn shrink-0" />}
            </div>
            <p className="text-sm font-medium leading-snug text-ink">{b.product}</p>
            <p className="mt-1 text-xs text-ink-3 tnum">
              {b.boxWeight ? `${b.boxWeight} lb boxed` : `~${b.estWeight} lb est.`}
            </p>

            <div className="mt-2.5">
              {stage !== "Shelf-Ready" ? (
                <span className="inline-flex items-center gap-1 text-xs text-ink-4">
                  <Clock size={11} /> Waiting on {stage}
                </span>
              ) : b.destination === "floor" ? (
                <Badge tone="ok" icon={Store}>
                  {b.finalWeight} lb on floor
                </Badge>
              ) : b.destination === "freezer" ? (
                <Badge tone="cold" icon={Snowflake}>
                  {b.finalWeight} lb in freezer
                </Badge>
              ) : (
                <Badge tone="info" icon={PackageCheck}>
                  {b.finalWeight} lb made
                </Badge>
              )}
            </div>

            {b.lastActionBy && (
              <p className="mt-2 flex items-center gap-1 text-xs text-ink-4">
                <UserCheck size={10} /> {b.lastActionBy}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Station queue */

/**
 * Today's plan, and the control that turns it into work. "Start" spawns the
 * live batch at this station and stamps the batch id back onto the plan line,
 * so an entry cannot be started twice and planned pounds are never double
 * counted against a running batch. Dropping a line is a quiet secondary
 * control; plans change.
 */
function PlannedToday({ tasks, batches, showStation = false, onStart, onRemove }) {
  if (tasks.length === 0) return null;
  const live = new Set(batches.map((b) => b.id));
  return (
    <Card className="mb-4 border-warn-line bg-warn-soft">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
        <ClipboardList size={14} className="text-warn shrink-0" />
        <span className="text-xs font-semibold text-warn">Planned for today</span>
      </div>
      <div className="px-3 pb-3 space-y-1.5">
        {tasks.map((t) => {
          /* Started means "this line has a batch and that batch still
           * exists". Checking the batch rather than trusting the stamp keeps
           * the row honest if the batch was closed out and cleared. */
          const started = Boolean(t.batchId) && live.has(t.batchId);
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 pl-3 pr-2 py-2 rounded-md bg-surface border border-warn-line/60"
            >
              <span className="flex-1 min-w-0 text-sm text-ink truncate">
                {t.text}
                <span className="text-ink-3 tnum"> · {t.qty} {t.unit}</span>
                {showStation && <span className="text-ink-4"> · {t.station}</span>}
              </span>
              {started ? (
                <Badge tone="ok" icon={CheckCircle2}>Running</Badge>
              ) : (
                <>
                  <IconButton
                    label={`Drop ${t.text} from today's plan`}
                    icon={X}
                    size={13}
                    onClick={() => onRemove(t.station, t.id)}
                    className="w-7 h-7"
                  />
                  <Button
                    size="sm"
                    variant="success"
                    icon={Play}
                    onClick={() => onStart(t.station, t.id)}
                  >
                    Start
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Queue a new batch for today at this station. Planning days ahead is the
 *  console's job; today is the floor's. */
function QuickAddToStation({ station, products, onAdd }) {
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("");

  const submit = () => {
    const p = product.trim();
    const q = Number(qty) || 0;
    if (!p || q <= 0) return;
    onAdd(station, p, q);
    setProduct("");
    setQty("");
  };

  return (
    <Card className="mb-4 px-3.5 py-3">
      {/* `flex-wrap`, and the button may not shrink. A button cannot shrink
        * below its label, so on a portrait tablet an unwrapped row inflates
        * the whole scroll container, which breaks the toolbar's overflow
        * measurement downstream. Wrapping keeps the full station label. */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          list="product-catalogue" value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Product" className="flex-1 min-w-32"
        />
        <Input
          type="number" value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          /* `basis-20`, not `w-20`: every Input carries `w-full` from
             INPUT_BASE and stylesheet order lets it win over `w-20`. Flex
             basis beats width outright. */
          placeholder="lb" className="basis-20 grow-0 shrink-0 tnum"
        />
        <Button
          icon={Plus}
          onClick={submit}
          disabled={!product.trim() || !Number(qty)}
          className="shrink-0"
        >
          Queue for {station}
        </Button>
      </div>
      <datalist id="product-catalogue">
        {products.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </Card>
  );
}

function BatchCard({ batch, onStart }) {
  const { isFinalStage, finalStage } = useStations();
  const stage = batch.stage;
  const willWeighIn = weighsInAt(batch) === stage;
  const willFinalize = isFinalStage(stage);
  /* A batch on the shelf is finished and gets no button. `isFinalStage`
   * compares against the last PRODUCTION station, so Shelf-Ready would
   * otherwise fall through to "Move forward", which `nextStage` clamps into
   * a no-op. */
  const done = stage === finalStage;
  return (
    <Card className="p-4 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-mono text-ink-4">{batch.id}</span>
        {batch.needsSmoke && <Flame size={14} className="text-warn shrink-0" />}
      </div>
      <p className="text-base font-semibold leading-snug text-ink">{batch.product}</p>
      <p className="mt-1 mb-3.5 text-sm text-ink-3 tnum">
        {batch.boxWeight ? `${batch.boxWeight} lb boxed in` : `~${batch.estWeight} lb estimated`}
      </p>
      {done ? (
        <p className="mt-auto text-sm text-ink-3">
          {batch.destination === "floor"
            ? `${batch.finalWeight} lb on the floor`
            : batch.destination === "freezer"
              ? `${batch.finalWeight} lb in the freezer`
              : `${batch.finalWeight} lb on the made pile`}
        </p>
      ) : (
        <Button
          block
          size="lg" variant="primary" icon={willWeighIn || willFinalize ? Scale : ArrowRight}
          onClick={() => onStart(batch)}
          className="mt-auto"
        >
          {willWeighIn ? "Enter box weight" : willFinalize ? "Enter final weight" : "Move forward"}
        </Button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ Move dialog -- */

/**
 * Moving a batch forward asks for a weight and a confirmation, nothing else.
 * No PIN here: every commit path lands in ProductionTracker's handlers, which
 * already call `approve(...)`, the one gate the Permissions screen configures.
 */
function MoveDialog({ batch, onCancel, onCommit }) {
  const { iconFor, isFinalStage, nextStage } = useStations();
  const stage = batch ? batch.stage : null;
  const willWeighIn = batch ? weighsInAt(batch) === stage : false;
  const willFinalize = isFinalStage(stage);
  const needsWeight = willWeighIn || willFinalize;

  const [step, setStep] = useState(needsWeight ? "weight" : "confirm");
  const [weight, setWeight] = useState(() => {
    if (!batch) return 0;
    if (willFinalize && batch.boxWeight) return Math.round(batch.boxWeight * 0.82);
    return batch.estWeight;
  });
  const [destination, setDestination] = useState("made");
  if (!batch) return null;

  const reference = batch.boxWeight || batch.estWeight;
  const preview = willFinalize ? yieldPct(reference, weight) : null;
  const nextLabel = willFinalize ? "Shelf-Ready" : nextStage(batch);

  const commit = () => {
    onCommit({
      batch,
      weight,
      destination: willFinalize ? destination : null,
      willWeighIn,
      willFinalize,
    });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={batch.product}
      icon={iconFor(stage)}
      footer={
        <>
          <Button variant="ghost" onClick={step === "confirm" && needsWeight ? () => setStep("weight") : onCancel}>
            {step === "confirm" && needsWeight ? "Back" : "Cancel"}
          </Button>
          {step === "weight" ? (
            <Button variant="primary" iconRight={ArrowRight} onClick={() => setStep("confirm")}>
              Continue
            </Button>
          ) : (
            <Button
              variant="success" icon={willFinalize ? Zap : CheckCircle2}
              onClick={commit}
            >
              {willFinalize ? "Confirm & sync" : "Confirm"}
            </Button>
          )}
        </>
      }
    >
      {/* Step indicator */}
      {needsWeight && (
        <ol className="flex items-center gap-2 mb-4 text-xs font-medium">
          {["Weight", "Confirm"].map((s, i) => {
            const idx = i === 0 ? "weight" : "confirm";
            const done = idx === "weight" && step === "confirm";
            const active = step === idx;
            return (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={cx(
                    "flex items-center justify-center w-5 h-5 rounded-full text-xs",
                    done ? "bg-ok text-white" : active ? "bg-ink text-white" : "bg-inset text-ink-4"
                  )}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className={active || done ? "text-ink-2" : "text-ink-4"}>{s}</span>
                {i === 0 && <span className="text-line-strong">—</span>}
              </li>
            );
          })}
        </ol>
      )}

      {step === "weight" && (
        <Field
          label={willFinalize ? "Final packed weight (lb)" : "Box weight in (lb)"}
          hint={
            willFinalize
              ? `Reference: ${reference} lb ${batch.boxWeight ? "boxed" : "estimated"}`
              : "Weigh the full box before it goes in."
          }
        >
          <Input
            type="number" size="lg" autoFocus
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value) || 0)}
            className="tnum"
          />
        </Field>
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          {needsWeight && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-sunken">
              <span className="text-xs text-ink-2">
                {willFinalize ? "Final weight" : "Box weight"}
              </span>
              <span className="text-sm font-semibold text-ink tnum">{weight} lb</span>
            </div>
          )}

          {preview != null && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-inset">
              <span className="text-xs text-ink-2">Yield against {reference} lb</span>
              <span className="text-sm font-semibold text-ink tnum">{preview}%</span>
            </div>
          )}

          {willFinalize ? (
            <Field
              label="Send to" hint={
                destination === "floor"
                  ? `Syncs ${weight} lb to Clover immediately.`
                  : destination === "freezer"
                    ? "Put away in the freezer — not sellable yet."
                    : "Stays on the made pile until someone puts it away."
              }
            >
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={destination === "made" ? "primary" : "secondary"}
                  icon={PackageCheck}
                  onClick={() => setDestination("made")}
                >
                  Made
                </Button>
                <Button
                  variant={destination === "freezer" ? "primary" : "secondary"}
                  icon={Snowflake}
                  onClick={() => setDestination("freezer")}
                >
                  Freezer
                </Button>
                <Button
                  variant={destination === "floor" ? "primary" : "secondary"}
                  icon={Store}
                  onClick={() => setDestination("floor")}
                >
                  Floor
                </Button>
              </div>
            </Field>
          ) : (
            <p className="text-sm text-ink-2">
              Moving to <span className="font-medium text-ink">{nextLabel}</span>.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ----------------------------------------------------------------- Screen -- */

export default function BatchesScreen({
  batches,
  schedule,
  inventory,
  /* Closed batches from previous days; only the yield ticker uses it. */
  history = [],
  today,
  onWeighIn,
  onFinalize,
  onAdvance,
  onQueueForToday,
  onStartPlanned,
  onRemovePlanned,
}) {
  /* No `user` and no role gates: the tablet is a place, not a person. The one
   * real gate is `approve()` (app/lib/approval.jsx). */
  const { stations, stages, iconFor, finalStage } = useStations();
  const [view, setView] = useState("all");

  // Station tabs filter one persistent scroll container, so a shorter station
  // would otherwise leave scrollTop clamped at an arbitrary offset.
  const changeView = (v) => {
    setView(v);
    scrollAppToToolbar();
  };
  const [moving, setMoving] = useState(null);

  const stats = useMemo(() => {
    const at = (s) => batches.filter((b) => b.stage === s).length;
    const done = batches.filter((b) => b.stage === finalStage);
    const yields = done
      .map((b) => yieldPct(b.boxWeight || b.estWeight, b.finalWeight))
      .filter((v) => v != null);
    /* null, not zero: the ticker renders nothing until a batch has closed. */
    const avg = yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : null;

    /* Benchmark is the previous close: the average yield of the last
     * production day that actually closed batches. Grouped by `closedOn`
     * rather than "yesterday" by date arithmetic, so a day with no runs does
     * not make the next one look catastrophic. */
    const byDay = new Map();
    for (const h of history) {
      if (!h.closedOn || h.closedOn >= today) continue;
      const y = yieldPct(h.boxWeight, h.finalWeight);
      if (y == null) continue;
      if (!byDay.has(h.closedOn)) byDay.set(h.closedOn, []);
      byDay.get(h.closedOn).push(y);
    }
    const prevDay = [...byDay.keys()].sort().pop() || null;
    const prevYields = prevDay ? byDay.get(prevDay) : [];
    const prior = prevYields.length
      ? prevYields.reduce((a, b) => a + b, 0) / prevYields.length
      : null;

    return {
      byStation: Object.fromEntries(stations.map((s) => [s, at(s)])),
      complete: done.length,
      avgYield: avg == null ? null : avg.toFixed(1),
      yieldTone: yieldTone(avg),
      /* Two different quantities: `yieldDelta` is the change in PERCENTAGE
       * POINTS (82 from 80 is +2.0); `yieldDeltaPct` is the RELATIVE change
       * (+2.5%). Both null when there is nothing to compare against. */
      yieldDelta: avg == null || prior == null ? null : +(avg - prior).toFixed(1),
      yieldDeltaPct:
        avg == null || prior == null || prior === 0
          ? null
          : +(((avg - prior) / prior) * 100).toFixed(1),
      /* The date behind the benchmark, so the readout can name it. */
      yieldPrevDay: prevDay,
    };
  }, [batches, finalStage, stations, history, today]);

  /* Today's plan, flattened out of `schedule[day][station]` with the station
   * carried onto each entry so the overview rows are startable. */
  const plannedToday = useMemo(() => {
    const day = schedule[today] || {};
    return stations.flatMap((station) =>
      (day[station] || []).map((t) => ({ ...t, station })),
    );
  }, [schedule, today, stations]);

  const options = [
    /* "All stations" carries no badge: it is the overview, not a queue. */
    { value: "all", label: "All stations", icon: LayoutGrid },
    ...stations.map((s) => ({
      value: s,
      label: s,
      icon: iconFor(s),
      count: stats.byStation[s],
    })),
    /* The VALUE is the real stage name, because that is what `batch.stage`
     * holds and what the filter below matches on. Only the LABEL says
     * "Completed". */
    { value: finalStage, label: "Completed", icon: iconFor(finalStage), count: stats.complete },
  ];

  /* Shelf-Ready is an outcome, not a post: nothing is planned INTO it and
   * nothing is queued there, so the completed view is the station view minus
   * both of those controls. */
  const isCompletedView = view === finalStage;

  /* The handlers take the approver from `approve()`, not from here. */
  const commit = (payload) => {
    const { batch, weight, destination, willWeighIn, willFinalize } = payload;
    if (willFinalize) onFinalize(batch.id, weight, destination);
    else if (willWeighIn) onWeighIn(batch.id, weight);
    else onAdvance(batch.id);
    setMoving(null);
  };

  const stationBatches = batches.filter((b) => b.stage === view);
  const products = inventory.map((i) => i.product);

  return (
    /* Unspaced outer box, sticky toolbar, then a spaced content box.
     * StickyFadeHeader already carries a 44px skirt for its mask, so a
     * `space-y` on the shared parent would double the gap. */
    <div>
      {/* Planning future days is the console's job; nothing sits above the ticker. */}

      {/* Avg yield beside the screen title. Posted through the page-actions
        *  slot because the header belongs to AppShell. */}
      <Slot name="page-actions">
        {stats.avgYield != null && <YieldTicker stats={stats} />}
      </Slot>

      {/* The tabs rail must get the FULL row: boxed to its own content width
        * it can end up a few px too narrow to arm ScrollArea's scroller (arming
        * reserves 14px of badge room and subtracts it on the next measure), and
        * unarmed means the chips spill and the mask clips them. ScreenToolbar's
        * `flex-1 min-w-0` on the tabs slot keeps that from coming back. */}
      <ScreenToolbar
        tabs={<Segmented fade scroll options={options} value={view} onChange={changeView} />}
      />

      <div className="space-y-5">
      {view === "all" ? (
        <>
          {/* Shown on the overview too, so a run the office booked for today
            *  is visible without knowing which station to open. */}
          <PlannedToday
            tasks={plannedToday}
            batches={batches}
            showStation
            onStart={onStartPlanned}
            onRemove={onRemovePlanned}
          />

          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory no-scrollbar sm:grid sm:grid-cols-3 sm:mx-0 sm:px-0 sm:overflow-visible">
            {stages.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                batches={batches.filter((b) => b.stage === stage)}
              />
            ))}
          </div>
        </>
      ) : (
        <div>
          {!isCompletedView && (
            <>
              <PlannedToday
                tasks={plannedToday.filter((t) => t.station === view)}
                batches={batches}
                onStart={onStartPlanned}
                onRemove={onRemovePlanned}
              />

              <QuickAddToStation
                station={view}
                products={products}
                onAdd={onQueueForToday}
              />
            </>
          )}

          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-ink">{view}</span>
            <Badge tone={stationBatches.length ? "info" : "neutral"}>
              {stationBatches.length} waiting
            </Badge>
          </div>

          {stationBatches.length === 0 ? (
            <Card>
              <EmptyState
                icon={iconFor(view)}
                title={`Nothing waiting at ${view}`}
                description="Batches appear here as soon as the previous station confirms them."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stationBatches.map((b) => (
                <BatchCard key={b.id} batch={b} onStart={setMoving} />
              ))}
            </div>
          )}
        </div>
      )}

      {moving && <MoveDialog key={moving.id} batch={moving} onCancel={() => setMoving(null)} onCommit={commit} />}
      </div>
    </div>
  );
}
