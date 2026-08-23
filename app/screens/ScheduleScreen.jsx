"use client";

import React, { useState } from "react";
import { AlertTriangle, CalendarDays, ClipboardList, Lock, Plus, X } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  IconButton,
  Input,
  cx,
} from "../components/ui";
import { STAGE_ICON, STATIONS, weekOf } from "../lib/domain";

function DayStrip({ days, selected, onSelect }) {
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
              "shrink-0 flex flex-col items-center justify-center w-14 py-2 rounded-lg border",
              "transition-colors duration-100",
              active
                ? "bg-primary border-primary text-white"
                : d.isProductionDay
                  ? "bg-surface border-line-strong text-ink hover:bg-sunken"
                  : "bg-sunken border-line text-ink-4 cursor-not-allowed"
            )}
          >
            <span className={cx("text-[10px] uppercase tracking-wide", active ? "text-white/70" : "text-ink-3")}>
              {d.weekday}
            </span>
            <span className="text-base font-semibold tnum leading-tight">{d.dayNum}</span>
            {d.isToday ? (
              <span className={cx("text-[9px] font-medium", active ? "text-white/80" : "text-ok")}>today</span>
            ) : !d.isProductionDay ? (
              <Lock size={9} className="mt-0.5" />
            ) : (
              <span className="text-[9px]">&nbsp;</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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

      <div className="flex-1 px-4 sm:px-5 py-3 space-y-1.5 min-h-24">
        {tasks.length === 0 && (
          <p className="py-4 text-center text-xs text-ink-4">Nothing planned yet.</p>
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

      <div className="px-4 sm:px-5 py-3 border-t border-line space-y-2">
        <div className="flex gap-2">
          <Input
            list="product-catalogue"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="Product"
            className="flex-1 min-w-0"
          />
          <Input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="lb"
            className="w-20 shrink-0 tnum"
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

export default function ScheduleScreen({ schedule, inventory, today, onAdd, onRemove }) {
  const days = weekOf(today);
  const [selected, setSelected] = useState(() => {
    const t = days.find((d) => d.key === today);
    return t?.isProductionDay ? today : days.find((d) => d.isProductionDay)?.key || days[0].key;
  });
  const [prefill, setPrefill] = useState(null);

  const day = days.find((d) => d.key === selected);
  const plan = schedule[selected] || {};
  const lowStock = inventory.filter((i) => i.floor < i.threshold);
  const products = inventory.map((i) => i.product);

  return (
    <div className="space-y-5">
      <DayStrip days={days} selected={selected} onSelect={setSelected} />

      <div className="flex items-center gap-2 text-sm">
        <CalendarDays size={15} className="text-ink-3" />
        <span className="font-medium text-ink">{day.label}</span>
        {day.isToday && <Badge tone="ok">Today — creates live batches</Badge>}
        {!day.isToday && <Badge tone="neutral">Planned</Badge>}
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
                <span className="text-xs font-semibold uppercase tracking-wide text-warn">
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
                            size="sm"
                            icon={Plus}
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
                onAdd={(station, product, qty) => onAdd(selected, station, product, qty)}
                onRemove={(station, id) => onRemove(selected, station, id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
