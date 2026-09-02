"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Flame,
  KeyRound,
  LayoutGrid,
  Lock,
  Package,
  PackageCheck,
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
  CardHeader,
  EmptyState,
  Field,
  IconButton,
  Input,
  MetaRow,
  Modal,
  PinInput,
  Segmented,
  StatCard,
  StatGrid,
  cx,
} from "../components/ui";
import {
  STAGES,
  STAGE_ICON,
  STATIONS,
  isManager,
  nextStageIndex,
  weekOf,
  weighsInAt,
  yieldPct,
} from "../lib/domain";
import { useStaff } from "../lib/staff";

/* --------------------------------------------------------------- Overview -- */

function StageColumn({ stage, batches }) {
  const Icon = STAGE_ICON[stage];
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

/* -------------------------------------------------------------- Day strip -- */

export function DayStrip({ days, selected, onSelect }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
      {days.map((d) => {
        const active = d.key === selected;
        return (
          <button
            key={d.key}
            disabled={!d.isProductionDay}
            onClick={() => onSelect(d.key)}
            className={cx(
              "shrink-0 flex flex-col items-center justify-center w-14 py-2 rounded-md border",
              "transition-colors duration-100",
              active
                ? "bg-ink border-ink text-white"
                : d.isProductionDay
                  ? "bg-surface border-line-strong text-ink hover:bg-sunken"
                  : "bg-sunken border-line text-ink-4 cursor-not-allowed"
            )}
          >
            <span className={cx("text-xs ", active ? "text-white/70" : "text-ink-3")}>
              {d.weekday}
            </span>
            <span className="text-sm font-semibold tnum leading-tight">{d.dayNum}</span>
            {d.isToday ? (
              <span className={cx("text-xs font-medium", active ? "text-white/80" : "text-ok")}>today</span>
            ) : !d.isProductionDay ? (
              <Lock size={9} className="mt-0.5" />
            ) : (
              <span className="text-xs">&nbsp;</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ Station queue */

function TaskQueue({ tasks, onComplete }) {
  if (tasks.length === 0) return null;
  return (
    <Card className="mb-4 border-warn-line bg-warn-soft">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
        <ClipboardList size={14} className="text-warn shrink-0" />
        <span className="text-xs font-semibold text-warn">
          Planned for today
        </span>
      </div>
      <div className="px-3 pb-3 space-y-1.5">
        {tasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 pl-3 pr-2 py-2 rounded-md bg-surface border border-warn-line/60"
          >
            <span className="flex-1 min-w-0 text-sm text-ink truncate">
              {t.text}
              <span className="text-ink-3 tnum"> · {t.qty} {t.unit}</span>
            </span>
            <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => onComplete(t.id)}>
              Done
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Manager-only "queue a new batch for today" form — lives right under the
 *  station's Planned-for-today queue so today's board can spawn batches the
 *  same way a future day's plan does, without leaving Board. */
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
      <div className="flex gap-2">
        <Input
          list="product-catalogue" value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Product" className="flex-1 min-w-0"
        />
        <Input
          type="number" value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="lb" className="w-20 shrink-0 tnum"
        />
        <Button icon={Plus} onClick={submit} disabled={!product.trim() || !Number(qty)}>
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
  const stage = STAGES[batch.stage];
  const willWeighIn = weighsInAt(batch) === stage;
  const willFinalize = stage === "Packaging";
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
      <Button
        block
        size="lg" variant="primary" icon={willWeighIn || willFinalize ? Scale : ArrowRight}
        onClick={() => onStart(batch)}
        className="mt-auto"
      >
        {willWeighIn ? "Enter box weight" : willFinalize ? "Enter final weight" : "Move forward"}
      </Button>
    </Card>
  );
}

/* ------------------------------------------------------------ Move dialog -- */

function MoveDialog({ batch, onCancel, onCommit }) {
  const { findByPin } = useStaff();
  const stage = batch ? STAGES[batch.stage] : null;
  const willWeighIn = batch ? weighsInAt(batch) === stage : false;
  const willFinalize = stage === "Packaging";
  const needsWeight = willWeighIn || willFinalize;

  const [step, setStep] = useState(needsWeight ? "weight" : "confirm");
  const [weight, setWeight] = useState(() => {
    if (!batch) return 0;
    if (willFinalize && batch.boxWeight) return Math.round(batch.boxWeight * 0.82);
    return batch.estWeight;
  });
  const [destination, setDestination] = useState("made");
  const [pin, setPin] = useState("");

  const staff = findByPin(pin);
  const pinRejected = pin.length === 4 && !staff;
  if (!batch) return null;

  const reference = batch.boxWeight || batch.estWeight;
  const preview = willFinalize ? yieldPct(reference, weight) : null;
  const nextLabel = willFinalize ? "Shelf-Ready" : STAGES[nextStageIndex(batch)];

  const commit = () => {
    if (!staff) return;
    onCommit({
      batch,
      weight,
      destination: willFinalize ? destination : null,
      staff,
      willWeighIn,
      willFinalize,
    });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={batch.product}
      icon={STAGE_ICON[stage]}
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
              disabled={!staff}
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

          <Field
            label="Your PIN" error={pinRejected ? "That PIN isn't recognised." : null}
            hint={staff ? null : "Confirms who handled this batch."}
          >
            <PinInput
              autoFocus
              value={pin}
              invalid={pinRejected}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && commit()}
            />
            {staff && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-ok">
                <UserCheck size={13} /> {staff.name}
              </p>
            )}
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------- Future planning */

function StationPlan({ station, tasks, products, onAdd, onRemove, prefill, onPrefillUsed }) {
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("");
  const Icon = STAGE_ICON[station];

  // A low-stock quick-add drops its values straight into this form.
  React.useEffect(() => {
    if (prefill) {
      setProduct(prefill.product);
      setQty(String(prefill.qty));
      onPrefillUsed();
    }
  }, [prefill, onPrefillUsed]);

  const submit = () => {
    const p = product.trim();
    const q = Number(qty) || 0;
    if (!p || q <= 0) return;
    onAdd(station, p, q);
    setProduct("");
    setQty("");
  };

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={station}
        icon={Icon}
        subtitle={station === "Smokehouse" ? "Batches that need smoking" : "Batches that skip the smokehouse"}
        actions={<Badge tone={tasks.length ? "info" : "neutral"}>{tasks.length}</Badge>}
      />

      <div className="flex-1 px-4 py-3 space-y-1.5 min-h-24">
        {tasks.length === 0 && (
          <p className="py-4 text-xs text-ink-4">Nothing planned yet.</p>
        )}
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2.5 pl-2.5 pr-1 py-2 rounded-md bg-canvas">
            <ClipboardList size={13} className="text-ink-3 shrink-0" />
            <span className="flex-1 min-w-0 text-sm text-ink truncate">{t.text}</span>
            <span className="text-xs text-ink-3 tnum shrink-0">
              {t.qty} {t.unit}
            </span>
            <IconButton label={`Remove ${t.text}`} icon={X} size={13} onClick={() => onRemove(station, t.id)} className="w-7 h-7" />
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-line space-y-2">
        <div className="flex gap-2">
          <Input
            list="product-catalogue" value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="Product" className="flex-1 min-w-0"
          />
          <Input
            type="number" value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="lb" className="w-20 shrink-0 tnum"
          />
        </div>
        <Button block variant="primary" icon={Plus} onClick={submit} disabled={!product.trim() || !Number(qty)}>
          Add to {station}
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

/** What a manager sees on any day other than today — planning, not live
 *  batches. Today stays the live board (stages, weigh-in, finalize); picking
 *  another day swaps in this view instead of pretending a future day has
 *  batches already moving through the shop. */
export function PlanningPane({ day, schedule, inventory, onAdd, onRemove }) {
  const [prefill, setPrefill] = useState(null);
  const plan = schedule[day.key] || {};
  const lowStock = inventory.filter((i) => i.floor < i.threshold);
  const products = inventory.map((i) => i.product);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <CalendarDays size={15} className="text-ink-3" />
        <span className="font-medium text-ink">{day.label}</span>
        <Badge tone="neutral">Planned</Badge>
      </div>

      {!day.isProductionDay ? (
        <Card>
          <EmptyState icon={Lock} title="No production on weekends" description="Pick a weekday to plan." />
        </Card>
      ) : (
        <>
          {lowStock.length > 0 && (
            <Card className="border-warn-line bg-warn-soft">
              <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
                <AlertTriangle size={14} className="text-warn shrink-0" />
                <span className="text-xs font-semibold text-warn">
                  Low on the floor — schedule a run
                </span>
              </div>
              <div className="px-3 pb-3 pt-2 space-y-1.5">
                {lowStock.map((item) => {
                  const deficit = Math.max(Math.ceil(item.threshold - item.floor), 10);
                  return (
                    <div
                      key={item.product}
                      className="flex items-center justify-between gap-3 flex-wrap pl-3 pr-2 py-2 rounded-md bg-surface border border-warn-line/60"
                    >
                      <span className="text-sm text-ink min-w-0 truncate">
                        {item.product}
                        <span className="text-danger tnum">
                          {" "}
                          — {item.floor}/{item.threshold} {item.unit}
                        </span>
                      </span>
                      <div className="flex gap-1.5 shrink-0">
                        {STATIONS.map((s) => (
                          <Button
                            key={s}
                            size="sm" icon={Plus}
                            onClick={() => setPrefill({ station: s, product: item.product, qty: deficit })}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {STATIONS.map((s) => (
              <StationPlan
                key={s}
                station={s}
                tasks={plan[s] || []}
                products={products}
                prefill={prefill?.station === s ? prefill : null}
                onPrefillUsed={() => setPrefill(null)}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Screen -- */

export default function BoardScreen({
  batches,
  schedule,
  inventory,
  today,
  user,
  onWeighIn,
  onFinalize,
  onAdvance,
  onAddTask,
  onRemoveTask,
}) {
  const canSeeAll = isManager(user);
  // Same permission as canSeeAll — named separately where it gates planning
  // (day strip, queueing new batches) so the intent at each call site reads
  // clearly.
  const canPlan = canSeeAll;
  const [view, setView] = useState(canSeeAll ? "all" : user.station || STATIONS[0]);
  const [moving, setMoving] = useState(null);

  const days = useMemo(() => weekOf(today), [today]);
  const [selectedDay, setSelectedDay] = useState(today);
  const isToday = selectedDay === today;
  const dayInfo = days.find((d) => d.key === selectedDay) || days[0];

  const stats = useMemo(() => {
    const at = (s) => batches.filter((b) => STAGES[b.stage] === s).length;
    const done = batches.filter((b) => STAGES[b.stage] === "Shelf-Ready");
    const yields = done
      .map((b) => yieldPct(b.boxWeight || b.estWeight, b.finalWeight))
      .filter((v) => v != null);
    return {
      smokehouse: at("Smokehouse"),
      packaging: at("Packaging"),
      complete: done.length,
      avgYield: yields.length ? (yields.reduce((a, b) => a + b, 0) / yields.length).toFixed(1) : "—",
    };
  }, [batches]);

  const options = [
    ...(canSeeAll ? [{ value: "all", label: "All stations", icon: LayoutGrid }] : []),
    ...STATIONS.map((s) => ({ value: s, label: s, icon: STAGE_ICON[s] })),
  ];

  const commit = (payload) => {
    const { batch, weight, destination, staff, willWeighIn, willFinalize } = payload;
    if (willFinalize) onFinalize(batch.id, weight, destination, staff);
    else if (willWeighIn) onWeighIn(batch.id, weight, staff);
    else onAdvance(batch.id, staff);
    setMoving(null);
  };

  const stationBatches = batches.filter((b) => STAGES[b.stage] === view);
  const queue = (schedule[today] && schedule[today][view]) || [];
  const products = inventory.map((i) => i.product);
  const onCompleteTask = (station, id) => onRemoveTask(today, station, id);

  return (
    <div className="space-y-5">
      {canPlan && <DayStrip days={days} selected={selectedDay} onSelect={setSelectedDay} />}

      {isToday ? (
        <>
          <StatGrid>
            <StatCard icon={Flame} label="In smokehouse" value={stats.smokehouse} hint="batches" />
            <StatCard icon={Package} label="In packaging" value={stats.packaging} hint="batches" />
            <StatCard icon={CheckCircle2} label="Completed" value={stats.complete} tone="ok" hint="this shift" />
            <StatCard icon={Scale} label="Avg yield" value={stats.avgYield} unit="%" tone="primary" hint="completed batches" />
          </StatGrid>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Segmented options={options} value={view} onChange={setView} scroll />
            {!canSeeAll && (
              <span className="text-xs text-ink-3">
                Signed in at <span className="font-medium text-ink-2">{user.station || view}</span>
              </span>
            )}
          </div>

          {view === "all" ? (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory no-scrollbar sm:grid sm:grid-cols-3 sm:mx-0 sm:px-0 sm:overflow-visible">
              {STAGES.map((stage) => (
                <StageColumn
                  key={stage}
                  stage={stage}
                  batches={batches.filter((b) => STAGES[b.stage] === stage)}
                />
              ))}
            </div>
          ) : (
            <div>
              <TaskQueue tasks={queue} onComplete={(id) => onCompleteTask(view, id)} />

              {canPlan && (
                <QuickAddToStation
                  station={view}
                  products={products}
                  onAdd={(station, product, qty) => onAddTask(today, station, product, qty)}
                />
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
                    icon={STAGE_ICON[view]}
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
        </>
      ) : (
        <PlanningPane
          day={dayInfo}
          schedule={schedule}
          inventory={inventory}
          onAdd={(station, product, qty) => onAddTask(selectedDay, station, product, qty)}
          onRemove={(station, id) => onRemoveTask(selectedDay, station, id)}
        />
      )}

      {moving && <MoveDialog key={moving.id} batch={moving} onCancel={() => setMoving(null)} onCommit={commit} />}
    </div>
  );
}
