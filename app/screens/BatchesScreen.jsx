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
} from "../components/ui";
import { formatDay, weighsInAt, yieldPct, yieldTone } from "../lib/domain";
import { useStations } from "../lib/stations";

/**
 * Today's average yield, read the way a board reads a symbol.
 *
 * The reference the user pointed at gets one thing right that a plain
 * percentage cannot: a ticker shows a LEVEL and its CHANGE, and only the
 * change is coloured. The symbol and the price are plain; green and red
 * belong to the delta, with the triangle saying which way before you have
 * read the digits. That is why this is not simply the old number in a
 * louder colour — "85.0%" answers nothing on its own, where "85.0% ▲ 2.3"
 * says today is running better than the last ten batches did.
 *
 * So: label muted, level in near-black at tabular figures, and the whole
 * colour budget spent on the change. That also keeps it inside the app's
 * palette — colour stays under 1% of the screen and lands on the one thing
 * that is a judgment — instead of importing the board's dark panel, which
 * would be the only dark object on a paper-white page.
 *
 * `stats.yieldTone` still decides whether the LEVEL is worth alarm: a shift
 * running at 60% is bad news whether or not it is up on yesterday, so a
 * failing level tints the number itself and the delta keeps its own colour.
 */
/**
 * Hairline column rule, the way a board separates its columns.
 *
 * Declared at module scope, not inside YieldTicker: a component created
 * during render is a new type on every pass, so React remounts it each time
 * rather than updating it. Harmless for a static span, but it is the same
 * mistake the linter already flags on StageColumn, and it costs nothing to
 * not make it.
 *
 * `h-2` against a `text-xs` row, centred. It centres on the TEXT, which is
 * why nothing else in the row may carry a vertical nudge — a margin on the
 * triangle makes the flex line taller than the type, and the rule then
 * centres against that instead. That was what read as "not quite centred".
 */
const Rule = () => (
  <span className="w-[0.5px] h-2 self-center rounded-full bg-line" aria-hidden="true" />
);

function YieldTicker({ stats }) {
  const delta = stats.yieldDelta;
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;

  return (
    /* One row, one type size, one weight — everything is `text-sm` at the
     * normal weight now, so nothing is emphasised by being heavier. The only
     * things that vary are colour and the direction glyph, which is what
     * makes it read as an instrument rather than a heading with a number
     * after it: on a board you find the row by colour and arrow, never by
     * something being bigger or bolder.
     *
     * `tnum` stays on the figures. Tabular numerals are a numeral variant,
     * not a weight — without them the digits change width as the yield moves
     * and the row twitches every time a batch closes. */
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
                /* Lightened off the full token. `--color-ok` is #4a7b52, which
                   is the right green for a filled badge but the only strong
                   ink on a row that is otherwise text-ink-4 — it read as the
                   heaviest thing in the header rather than a quiet quote.
                   Both directions get the same alpha, so a fall never lands
                   heavier than a rise. */
                up ? "text-ok/70" : down ? "text-danger/70" : "text-ink-4",
              )}
            >
              {(up || down) && (
                <DeltaTriangle size={4} down={down} />
              )}

              {/* {delta > 0 ? "+" : ""} */}
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

/** `yieldTone` as type colour. A healthy level reads back a step from full
 *  ink — it is the quiet half of the row — and only a level that is itself a
 *  problem takes a colour of its own. */
/**
 * The direction glyph — a narrow isosceles triangle, which is the shape a
 * quote board actually prints.
 *
 * Lucide's `Triangle` is near-equilateral AND drawn with generous padding
 * inside its 24-unit box, so at ticker sizes almost none of the requested
 * pixels are ink and what survives reads as a squat blob rather than a
 * pointer. This is 4:5 — taller than it is wide — with the path filling the
 * viewBox edge to edge, so the point does the work and the requested size is
 * the size you actually get.
 *
 * Down is the same path rotated, never a second shape: the two directions
 * have to carry identical visual weight or a fall looks heavier than a rise.
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

/* `YIELD_INK` lived here — yieldTone mapped to a text colour, so a level bad
 * enough to matter tinted itself warn/danger. It is gone because the level is
 * now deliberately flat `text-ink-4`: on this row the level is context and
 * the change is the news. `stats.yieldTone` is still computed, so restoring
 * the tint is a one-line change if a bad shift should ever announce itself
 * here rather than only in the console's Insights. */

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
 * Today's plan, and the one control that turns it into work.
 *
 * This is the handshake between the two halves of the app. The console
 * schedules a batch for a future production day; that day arrives; the entry
 * is sitting here. Until now the only gesture on it was a green "Done" button
 * that deleted the line and created nothing — so a run booked in the office
 * on Monday simply evaporated on Tuesday, and the only way to actually make
 * it was to type the same product in again by hand, which left the plan and
 * the batch double-counted against the same target.
 *
 * "Start" is the promotion: it spawns the live batch at this station and
 * stamps the batch's id back onto the plan line, so a started entry can never
 * be started twice and every screen that counts planned pounds can tell the
 * difference between a run that is waiting and one that is already on the
 * floor. Dropping a line is still possible — plans change — but it is now a
 * quiet secondary control that reads as what it is, rather than wearing the
 * word "Done".
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

/** The "queue a new batch for today" form — lives right under the station's
 *  Planned-for-today queue, so a run the shop decides on at the bench starts
 *  without anyone walking to a laptop. Planning the days AHEAD is the
 *  console's job; this is today, which is the floor's. */
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
      {/* `flex-wrap`, and the button may not shrink.
        *
        * This row was the widest thing on the screen and the source of three
        * separate-looking bugs. "Queue for Smokehouse" is 192px of
        * un-shrinkable min-content: the product Input has `min-w-0` so it
        * gives way, but a button cannot shrink below its own label, so on a
        * portrait tablet the row forced the whole scroll container to 943px
        * inside a 751px box.
        *
        * Everything downstream of that followed: the content column scrolled
        * sideways, the toolbar's `max-w-full` resolved against the inflated
        * width so ScrollArea never saw an overflow to arm against, its chips
        * spilled and StickyFadeHeader's mask clipped them — and a batch card
        * disappearing when it advanced looked like "nothing happened",
        * because the column it left was off-screen.
        *
        * Wrapping is the fix rather than a shorter label: the button keeps
        * saying which station it queues to, and simply takes its own line
        * when the row cannot hold it. */}
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
             INPUT_BASE, and two width utilities in the same layer are settled
             by stylesheet order rather than by which one is written last here
             — `w-full` wins and the box takes the whole row, wrapping itself
             onto its own line. A flex item sized by its basis sidesteps the
             fight: basis beats width outright. */
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
  /* A batch on the shelf is finished. It used to get a "Move forward" button
   * anyway — `isFinalStage` compares against the last PRODUCTION station
   * (Packaging), so Shelf-Ready fell through to the generic label — and
   * pressing it did nothing at all, because `nextStage` clamps at the end of
   * the list. A button that cannot fail and cannot act is worse than no
   * button; the Completed tab is a record, not a queue. */
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
 * Moving a batch forward asks for a weight and a confirmation — and nothing
 * else. It used to demand a PIN of its own, checked against the floor's old
 * `useStaff()` roster, and that gate had quietly become unpassable: the crew
 * it listed are not in the system any more, so the only codes it accepted
 * belonged to people who no longer exist, while a floor manager's real
 * console-issued PIN was rejected outright.
 *
 * It was also the second gate on the same action. Every commit path below
 * lands in ProductionTracker's `handleAdvance` / `handleWeighIn` /
 * `handleFinalize`, each of which already calls `approve(...)` — the one
 * gate the Permissions screen actually configures, checked against the
 * console roster, and logged to the approval trail. Two prompts from two
 * rosters for one action was not twice the assurance; it was one real check
 * standing behind one broken one.
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
  /* Closed batches from previous days. Only the ticker uses it: a level with
   * nothing to move against is not a ticker, it is a number. */
  history = [],
  today,
  onWeighIn,
  onFinalize,
  onAdvance,
  onQueueForToday,
  onStartPlanned,
  onRemovePlanned,
}) {
  /* No `canSeeAll` / `canPlan` any more, and no `user` at all.
   *
   * They were `isManager(user)` against a terminal hardcoded to
   * `role: "manager"` — a question with one possible answer. Everything they
   * gated (the all-stations view, the station queue's controls, quick-add)
   * therefore always rendered, and everything the false branch described —
   * a crew member pinned to one station, the "Signed in at Packaging" line —
   * was unreachable code describing an app that no longer exists. The tablet
   * has no sign-in and nobody to be: it is a place, not a person. The one
   * real gate on this screen is `approve()`, which the Permissions screen
   * configures and which asks a named human for a PIN at the moment it
   * matters. See app/lib/approval.jsx. */
  const { stations, stages, iconFor, finalStage } = useStations();
  const [view, setView] = useState("all");

  // Station tabs are a filter over one persistent scroll container, so a
  // shorter station would otherwise leave scrollTop clamped at an arbitrary
  // offset. Land at the top of the station you picked. See scrollAppToTop.
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
    /* null, not an em dash. The ticker renders nothing at all when no batch
     * has closed yet — a share price with no trades does not print a zero. */
    const avg = yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : null;

    /* What today is measured against: the PREVIOUS CLOSE.
     *
     * That is how a real quote does it — the change on "SPX 5,921.54 ▲
     * +12.00" is the last trade minus the previous session's official
     * closing price, not the day's open and not a moving average. So the
     * benchmark here is the average yield of the last production day that
     * actually closed batches, and today's running average is the live
     * price moving against it.
     *
     * Grouped by `closedOn` and the most recent prior day taken, rather
     * than "yesterday" by date arithmetic: a shop that ran nothing on
     * Sunday has not therefore had a catastrophic Monday, and a market
     * closed for the weekend still quotes against Friday. */
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
      /* The change, in yield points. Null when there is nothing to compare
       * to — a first-ever shift gets a level and no arrow, rather than a
       * confident +0.0. */
      /* TWO different quantities, and a board prints both for a reason.
       *
       * `yieldDelta` is the change in PERCENTAGE POINTS (82 from 80 is +2.0).
       * `yieldPct` is the RELATIVE change (82 from 80 is +2.5%). On a metric
       * that is itself a percentage these are trivially confusable, and a
       * bare "+2.0" invites being read as "+2%". A real quote sidesteps it
       * the same way — "+1.42 (+0.62%)" — so this shows the points and the
       * percent together and labels the points. */
      yieldDelta: avg == null || prior == null ? null : +(avg - prior).toFixed(1),
      yieldDeltaPct:
        avg == null || prior == null || prior === 0
          ? null
          : +(((avg - prior) / prior) * 100).toFixed(1),
      /* The date behind the benchmark, so the readout can say what it closed
       * against instead of leaving people to invent a baseline. */
      yieldPrevDay: prevDay,
    };
  }, [batches, finalStage, stations, history, today]);

  /* Today's plan, flattened out of the nested `schedule[day][station]` map
   * with the station carried onto each entry — the overview shows every
   * station's plan at once, and a row that cannot say where it belongs is
   * not startable. */
  const plannedToday = useMemo(() => {
    const day = schedule[today] || {};
    return stations.flatMap((station) =>
      (day[station] || []).map((t) => ({ ...t, station })),
    );
  }, [schedule, today, stations]);

  const options = [
    /* "All stations" carries no badge, the same way Tasks' Completed tab
     *  doesn't: it is the overview, not a queue with a number demanding
     *  attention. */
    { value: "all", label: "All stations", icon: LayoutGrid },
    ...stations.map((s) => ({
      value: s,
      label: s,
      icon: iconFor(s),
      count: stats.byStation[s],
    })),
    /* Completed is a tab, not a tile. It was a StatCard reading "Completed /
     * 1 / this shift" that nobody could click; as a tab the number is the
     * same and it also takes you to the batches behind it — which is the
     * convention every other floor screen already follows (Tasks' tabs ARE
     * its tiles; Inventory's tiles ARE its filters).
     *
     * The VALUE is the real stage name, because that is what `batch.stage`
     * holds and what the filter below matches on. Only the LABEL says
     * "Completed" — "Shelf-Ready" is the model's word for the shelf, and
     * this tab is answering "what did we finish", which is the shift's
     * question rather than the schema's. */
    { value: finalStage, label: "Completed", icon: iconFor(finalStage), count: stats.complete },
  ];

  /* Shelf-Ready is an outcome, not a post: nothing is planned INTO it and
   * nothing is queued there, so the completed view is the station view minus
   * both of those controls. */
  const isCompletedView = view === finalStage;

  /* `staff` used to ride along here and was ignored by all three handlers —
   * they take the approver from `approve()` instead, which is the only name
   * with a record behind it. */
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
    /* Nested the way TasksScreen nests: an unspaced outer box, the sticky
     * toolbar, then a spaced content box. StickyFadeHeader already carries a
     * 44px skirt below itself — that is the room its mask fades content out
     * into — so a `space-y` on the shared parent stacks a second gap on top
     * of one that was already deliberate. */
    <div>
      {/* The week strip and its planning pane are gone — planning a future
        *  day is the console's job now.
        *
        *  The stat grid that used to sit here is gone too. Two of its four
        *  tiles printed the same numbers the toolbar badges below now carry,
        *  and none of the four could be clicked — on every other floor
        *  screen a tile that shows a count is also the control that filters
        *  to it. Completed became a tab; avg yield became the ticker in the
        *  page header. */}

      {/* Avg yield, up beside the screen title, read like a share price: the
        *  number is the thing, the label is small, and the colour is the
        *  judgment. `yieldTone` supplies that judgment on the same
        *  thresholds Insights flags against, so the floor gets its
        *  scoreboard at a glance without a tile and without a trip to the
        *  console. Posted through the page-actions slot because the header
        *  belongs to AppShell — see ui.jsx's Slot. */}
      <Slot name="page-actions">
        {stats.avgYield != null && <YieldTicker stats={stats} />}
      </Slot>

      {/* The shared toolbar. This screen passes `tabs` and nothing else, so
        * the rail gets the FULL row — which it must. Boxing it to its own
        * content width put 463px of chips in an 1100px column, leaving it
        * permanently 6px too narrow for itself: a width that can never arm
        * ScrollArea's scroller, since arming reserves 14px of badge room and
        * subtracts it again on the next measure, so a 6px overflow reads as
        * "fits". Unarmed means `overflow-x: visible`, so the chips spilled
        * out and the mask clipped the spill — "All stations" cut off,
        * unreachable, unclickable. ScreenToolbar's `flex-1 min-w-0` on the
        * tabs slot is what keeps that from coming back.
        *
        * `fade` rather than `scroll` for the reason Tasks uses it — scroll
        * mode arms itself when the row actually overflows, and forcing it on
        * leaves the rail a few px scrollable even with space to spare. */}
      <ScreenToolbar
        tabs={<Segmented fade scroll options={options} value={view} onChange={changeView} />}
      />

      <div className="space-y-5">
      {view === "all" ? (
        <>
          {/* Shown on the overview too, not just inside a station. A run the
            *  office booked for today has to be visible on the screen the
            *  floor actually stands in front of, or the handshake only works
            *  for somebody who already knew to go looking for it. */}
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
