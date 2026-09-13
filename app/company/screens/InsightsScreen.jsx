"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageCircle, Send, Sparkles } from "lucide-react";

import { Button, Input, Segmented, Slot, cx } from "../../components/ui";
import { formatDay, isOverTarget, LOW_YIELD_PCT, shiftDate, STAGE_TARGET_MINUTES, todayKey, yieldPct } from "../../lib/domain";
import { answerInsightQuestion, HISTORY_WINDOW_DAYS, isFlaggedBatch, productHistory } from "../lib/insights";

/**
 * The console's landing screen, in three layers:
 *
 *   1. Header — scope, the four headline numbers, and (admins) a switch
 *      between the two ways of cutting the same closed-batch history.
 *   2. Calendar view — five weeks of days beside one panel: a picked day, or
 *      the rolled-up insight cards when nothing is picked.
 *   3. Products view (admin) — the per-product table beside a wide history
 *      panel: now vs. a year ago, month by month, and the last window's
 *      batches, with the same question chips underneath.
 *
 * A picked day and a picked product are both synthesized into the same card
 * shape as the rolled-up insights (`context.type` "day" / "product"), so one
 * Q&A component (`InsightQA`) answers for all three.
 *
 * `insights` and `history` arrive pre-filtered by CompanyConsole to the
 * locations the user can see; each history item carries
 * `locationId`/`locationName` so multi-location days can show identity dots.
 */

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const GRID_DAYS = 35; // five Sun–Sat weeks, always a full 5x7 block regardless of how the data falls

const TONE_ICON = { warn: AlertTriangle, danger: AlertTriangle, ok: CheckCircle2, neutral: Sparkles };
const TONE_TEXT = { warn: "text-warn", danger: "text-danger", ok: "text-ok", neutral: "text-ink-2" };

/* Per-entity identity palette (see globals.css): "which location", never a status. */
const SERIES_DOT = ["bg-identity-1", "bg-identity-2", "bg-identity-3", "bg-identity-4"];

/* Two cuts of the same closed-batch history; the labels say what the cut
 * is, not what the widget looks like. */
const VIEWS = [
  { value: "calendar", label: "By day" },
  { value: "products", label: "By product" },
];

/**
 * One-tap questions per `context.type`. Each `text` contains the exact
 * keyword `answerInsightQuestion` matches, so every chip yields a real
 * answer. Locations get no "trend" chip: that branch only ever says "not
 * enough data yet". A product's own batches over time are exactly the series
 * a trend and a year-over-year can be read from, so it gets both.
 */
const QUICK_QUESTIONS = {
  location: [
    { label: "Why?", text: "Why is this happening?" },
    { label: "How does it compare?", text: "How does it compare to other locations?" },
  ],
  station: [
    { label: "Why?", text: "Why is this happening?" },
    { label: "How does it compare?", text: "How does it compare across locations?" },
  ],
  overall: [{ label: "Why?", text: "Why is this happening?" }],
  day: [
    { label: "Why?", text: "Why is this happening?" },
    { label: "How does it compare?", text: "How does it compare to the average?" },
  ],
  product: [
    { label: "Why?", text: "Why is this happening?" },
    { label: "Trend?", text: "What is the trend?" },
    { label: "A year ago?", text: "Where was this a year ago?" },
    { label: "How does it compare?", text: "How does it compare to the average?" },
  ],
};

/**
 * The screen's one sequential encoding: yield in a single hue, mixed against
 * the `--color-ok` token so it tracks theme changes. Flagged status and
 * location identity use separate channels (corner icon, corner dots) so
 * magnitude, status and identity never compete for the same pixel.
 */
function yieldStyle(y) {
  if (y == null) return undefined;
  const t = Math.max(0, Math.min(1, (y - 55) / 40));
  const pct = Math.round(8 + t * 57);
  return { backgroundColor: `color-mix(in srgb, var(--color-ok) ${pct}%, var(--color-surface))` };
}

const round1 = (n) => Math.round(n * 10) / 10;

/* Tone for a synthesized card: flagged beats everything, a clear beat of
 * the company average is good news, else neutral. */
const toneFor = (flaggedCount, avgY, companyAvg) =>
  flaggedCount > 0 ? "warn" : avgY != null && companyAvg != null && avgY - companyAvg >= 3 ? "ok" : "neutral";

/* ------------------------------------------------------------- Screen -- */

export default function InsightsScreen({ scopeLabel, insights, history, targets = {}, isAdmin = false }) {
  const [view, setView] = useState("calendar");
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [insightIndex, setInsightIndex] = useState(0);

  const multi = insights.byLocation.length > 1;
  const companyAvg = insights.company.avgYield;

  const headline = useMemo(() => {
    const best = history.reduce((acc, h) => {
      const y = yieldPct(h.boxWeight, h.finalWeight);
      return y != null && (!acc || y > acc.y) ? { y, product: h.product } : acc;
    }, null);
    return { batches: insights.company.batches, avg: companyAvg, flagged: insights.company.flagged, best };
  }, [history, insights, companyAvg]);

  /* ---- Calendar: five full weeks ending this Saturday. */
  const days = useMemo(() => {
    const today = todayKey();
    const dow = new Date(`${today}T00:00:00`).getDay();
    const endKey = shiftDate(today, 6 - dow);
    const startKey = shiftDate(endKey, -(GRID_DAYS - 1));

    const byDate = new Map();
    for (const h of history) {
      const y = yieldPct(h.boxWeight, h.finalWeight);
      if (y == null || !h.closedOn) continue;
      const point = { ...h, y, flagged: isFlaggedBatch(h, targets) };
      const list = byDate.get(h.closedOn);
      if (list) list.push(point);
      else byDate.set(h.closedOn, [point]);
    }

    // Stable location -> colour assignment, in first-appearance order, so a
    // location keeps the same dot colour on every day it shows up.
    const seenLocations = [];
    for (const list of byDate.values()) {
      for (const b of list) {
        if (b.locationId && !seenLocations.includes(b.locationId)) seenLocations.push(b.locationId);
      }
    }

    return Array.from({ length: GRID_DAYS }, (_, i) => {
      const key = shiftDate(startKey, i);
      const batches = byDate.get(key) || [];
      const avgY = batches.length ? Math.round((batches.reduce((a, b) => a + b.y, 0) / batches.length) * 10) / 10 : null;
      const flaggedCount = batches.filter((b) => b.flagged).length;
      const locationIds = [...new Set(batches.map((b) => b.locationId).filter(Boolean))];
      return {
        key,
        batches,
        avgY,
        flaggedCount,
        flagged: flaggedCount > 0,
        // Location dots only mean something with more than one location in view.
        dots: multi ? locationIds.map((id) => SERIES_DOT[seenLocations.indexOf(id) % SERIES_DOT.length]) : [],
        isToday: key === today,
        isFuture: key > today,
      };
    });
  }, [history, multi, targets]);

  const selectedCell = selectedDay ? days.find((d) => d.key === selectedDay) : null;

  const dayCard = useMemo(() => {
    if (!selectedCell || selectedCell.batches.length === 0) return null;
    const { key, batches, avgY, flaggedCount } = selectedCell;
    return {
      id: `day-${key}`,
      tone: toneFor(flaggedCount, avgY, companyAvg),
      title: `${batches.length} batch${batches.length === 1 ? "" : "es"} closed`,
      detail: `${avgY}% average yield${flaggedCount ? `, ${flaggedCount} flagged` : ""}.`,
      context: { type: "day", key, batches, avgY, flaggedCount, companyAvg },
    };
  }, [selectedCell, companyAvg]);

  /* ---- Products: one product's closed batches in date order. Built from
   * `history` rather than `insights.byProduct` because the rows need the
   * per-batch fields (weights, minutes, location) the rollup throws away. */
  const productCard = useMemo(() => {
    if (!selectedProduct) return null;
    const rows = history
      .filter((h) => h.product === selectedProduct && h.closedOn)
      .map((h) => ({ ...h, y: yieldPct(h.boxWeight, h.finalWeight), flagged: isFlaggedBatch(h, targets) }))
      .filter((h) => h.y != null)
      .sort((a, b) => (a.closedOn < b.closedOn ? -1 : a.closedOn > b.closedOn ? 1 : 0));
    if (!rows.length) return null;
    const stats = insights.byProduct?.find((p) => p.product === selectedProduct) || null;
    const flaggedCount = rows.filter((r) => r.flagged).length;
    const avgY = stats?.avgYield ?? null;
    /* The long run (months, now-vs-a-year-ago) and the short one (the last
     * window's batches) come from the same rows. */
    const productHist = productHistory(rows);
    const recentRows = rows.filter((r) => r.closedOn >= productHist.recent.from);
    return {
      id: `product-${selectedProduct}`,
      tone: toneFor(flaggedCount, avgY, companyAvg),
      title: `${rows.length} batch${rows.length === 1 ? "" : "es"} of ${selectedProduct} closed`,
      detail: `${avgY}% average yield, ${stats ? `${stats.low}%–${stats.high}% range, ` : ""}${formatDay(rows[0].closedOn)} to ${formatDay(
        rows[rows.length - 1].closedOn
      )}${flaggedCount ? `, ${flaggedCount} flagged` : ""}.`,
      context: { type: "product", product: selectedProduct, rows, recentRows, history: productHist, avgY, flaggedCount, companyAvg, stats },
    };
  }, [selectedProduct, history, targets, insights.byProduct, companyAvg]);

  const showProducts = isAdmin && view === "products";

  /* The shell draws the "Insights" title; the screen only fills its
   * subtitle and actions slots, the same as every other console screen. */
  const span = history.length
    ? `${formatDay(history.reduce((a, h) => (h.closedOn && h.closedOn < a ? h.closedOn : a), todayKey()))} to today`
    : null;

  return (
    <div>
      <Slot name="page-subtitle">
        {[scopeLabel, span && `closed batches, ${span}`].filter(Boolean).join(" · ")}
      </Slot>
      {isAdmin && (
        <Slot name="page-actions">
          <Segmented size="sm" value={view} onChange={setView} options={VIEWS} />
        </Slot>
      )}

      {showProducts ? (
        <ProductsView
          byProduct={insights.byProduct}
          selected={selectedProduct}
          onSelect={(name) => setSelectedProduct((cur) => (cur === name ? null : name))}
          card={productCard}
          multi={multi}
          targets={targets}
        />
      ) : (
        <>
          <HeadlineStats {...headline} />
          <CalendarView
          days={days}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          selectedCell={selectedCell}
          dayCard={dayCard}
          cards={insights.cards}
          insightIndex={insightIndex}
          onPickInsight={setInsightIndex}
          byLocation={insights.byLocation}
          multi={multi}
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Header -- */

/** The four numbers behind everything else on the screen, as tiles. */
function HeadlineStats({ batches, avg, flagged, best }) {
  const tiles = [
    { label: "Batches closed", value: batches },
    { label: "Average yield", value: avg != null ? `${avg}%` : "—" },
    { label: "Flagged", value: flagged, tone: flagged ? "text-warn" : undefined },
    { label: "Best batch", value: best ? `${best.y}%` : "—", sub: best?.product, tone: best ? "text-ok" : undefined },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {tiles.map((t) => (
        <StatTile key={t.label} label={t.label} value={t.value} sub={t.sub} tone={t.tone} />
      ))}
    </div>
  );
}

/** One boxed number with a label, reused for the headline row and the
 * now-vs-a-year-ago comparison so both read as the same kind of thing. */
function StatTile({ label, value, sub, tone }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3.5 py-3 min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-ink-4 truncate">{label}</p>
      <p className={cx("mt-1 text-xl font-semibold tnum leading-none", tone || "text-ink")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-3 truncate">{sub}</p>}
    </div>
  );
}

/* ---------------------------------------------------- Calendar view -- */

function CalendarView({ days, selectedDay, onSelectDay, selectedCell, dayCard, cards, insightIndex, onPickInsight, byLocation, multi }) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAY_LABELS.map((d, i) => (
            <div key={i} className="text-center text-xs text-ink-4">
              {d}
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1.5">
              {week.map((day) => {
                const hasData = day.batches.length > 0;
                const dayNum = new Date(`${day.key}T00:00:00`).getDate();
                const selected = selectedDay === day.key;
                return (
                  <button
                    key={day.key}
                    type="button"
                    disabled={!hasData}
                    onClick={() => onSelectDay(selected ? null : day.key)}
                    style={yieldStyle(day.avgY)}
                    className={cx(
                      "relative aspect-square rounded-md border text-left p-1.5 transition-colors",
                      hasData ? "border-line-strong cursor-pointer hover:border-ink-3" : "border-line-soft",
                      !hasData && !day.isFuture && "bg-sunken",
                      day.isFuture && "opacity-40",
                      selected && "ring-2 ring-ink-3 ring-offset-1"
                    )}
                  >
                    <span className={cx("text-[11px] tnum", hasData ? "text-ink-2" : "text-ink-4")}>{dayNum}</span>
                    {day.isToday && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-ink-3" />}
                    {hasData && (
                      <span className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-ink tnum">{day.avgY}%</span>
                        {day.flagged && <AlertTriangle size={11} className="text-warn shrink-0" />}
                      </span>
                    )}
                    {day.dots.length > 0 && (
                      <span className="absolute top-1.5 left-1.5 flex gap-0.5">
                        {day.dots.map((c, i) => (
                          <span key={i} className={cx("w-1.5 h-1.5 rounded-full", c)} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="flex items-center gap-0.5">
              {[15, 35, 55, 75].map((pct) => (
                <span
                  key={pct}
                  className="w-3 h-3 rounded-sm border border-line"
                  style={{ backgroundColor: `color-mix(in srgb, var(--color-ok) ${pct}%, var(--color-surface))` }}
                />
              ))}
            </span>
            Lower &rarr; higher yield
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle size={11} className="text-warn" /> Flagged
          </span>
          {multi &&
            byLocation.map((l, i) => (
              <span key={l.locationId} className="flex items-center gap-1.5">
                <span className={cx("w-2 h-2 rounded-full", SERIES_DOT[i % SERIES_DOT.length])} /> {l.name}
              </span>
            ))}
        </div>
      </div>

      <Panel>
        {selectedCell ? (
          <>
            <PanelHeader title={formatDay(selectedCell.key)} onClear={() => onSelectDay(null)} />
            {dayCard ? (
              <InsightDetail key={dayCard.id} card={dayCard}>
                <ul className="space-y-2">
                  {selectedCell.batches.map((b) => (
                    <li key={b.id} className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-ink-2 truncate">
                        {b.product}
                        {b.locationName && <span className="text-ink-4"> · {b.locationName}</span>}
                      </span>
                      <span className={cx("text-xs font-medium tnum shrink-0", b.flagged ? "text-warn" : "text-ink-3")}>{b.y}%</span>
                    </li>
                  ))}
                </ul>
              </InsightDetail>
            ) : (
              <p className="text-xs text-ink-4">No batches closed this day.</p>
            )}
          </>
        ) : (
          <InsightCards cards={cards} index={insightIndex} onPick={onPickInsight} />
        )}
      </Panel>
    </div>
  );
}

/**
 * The rolled-up cards, all listed: the picked one opens into its full
 * detail and Q&A, the rest stay as one-line rows so nothing is hidden
 * behind a pager.
 */
function InsightCards({ cards, index, onPick }) {
  if (!cards.length) {
    return <p className="text-xs text-ink-4">Insights show up once locations start closing batches on the floor.</p>;
  }
  const active = Math.min(index, cards.length - 1);
  return (
    <div>
      <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-3">
        {cards.length === 1 ? "Insight" : `${cards.length} insights`}
      </p>
      <ul className="space-y-1">
        {cards.map((c, i) => {
          const Icon = TONE_ICON[c.tone];
          if (i === active) {
            return (
              <li key={c.id} className="py-1.5">
                <InsightDetail card={c} />
              </li>
            );
          }
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(i)}
                className="w-full flex items-start gap-2.5 -mx-2 px-2 py-1.5 rounded-md text-left hover:bg-sunken transition-colors"
              >
                <span className={cx("shrink-0 mt-0.5", TONE_TEXT[c.tone])}>
                  <Icon size={14} />
                </span>
                <span className="text-xs text-ink-2 leading-snug">{c.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------- Products view -- */

function ProductsView({ byProduct, selected, onSelect, card, multi, targets }) {
  if (!byProduct?.length) {
    return <p className="text-sm text-ink-4">Yield by product shows up once batches start closing on the floor.</p>;
  }
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="w-full lg:w-[22rem] shrink-0 lg:sticky lg:top-6">
        <ProductYieldTable byProduct={byProduct} selected={selected} onSelect={onSelect} />
      </div>

      <div className="flex-1 min-w-0 w-full rounded-md border border-line bg-surface p-5">
        {card ? (
          <ProductDetail key={card.id} card={card} multi={multi} targets={targets} onClear={() => onSelect(selected)} />
        ) : selected ? (
          <p className="text-xs text-ink-4">No closed batches of {selected} yet.</p>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-ink-2">Pick a product on the left.</p>
            <p className="mt-1 text-xs text-ink-4">You&rsquo;ll get how it compares to a year ago and its month-by-month run.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Yield rolled up by product — "which item" rather than "which shop" or
 * "which shift". Worst average first, since that is where a manager would
 * look. Plain numbers, no fills: the only colour on the row is the warn on
 * an average under the low-yield line or a flagged count, so a warm cell
 * means "look here" and nothing else.
 */
function ProductYieldTable({ byProduct, selected, onSelect }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-ink">Yield by product</p>
        <p className="mt-0.5 text-xs text-ink-3">Lowest average first.</p>
      </div>
      <table className="w-full text-sm border-collapse table-fixed">
        <colgroup>
          <col />
          <col className="w-16" />
          <col className="w-14" />
        </colgroup>
        <thead>
          <tr className="text-left text-xs text-ink-4 border-b border-line">
            <th className="font-medium pb-2 pr-2">Product</th>
            <th className="font-medium pb-2 pr-2 text-right">Avg yield</th>
            <th className="font-medium pb-2 text-right">Flagged</th>
          </tr>
        </thead>
        <tbody>
          {byProduct.map((p) => {
            const isSelected = selected === p.product;
            return (
              <tr
                key={p.product}
                onClick={() => onSelect(p.product)}
                aria-selected={isSelected}
                className={cx(
                  "border-b border-line-soft last:border-0 cursor-pointer transition-colors hover:bg-sunken",
                  isSelected && "bg-sunken"
                )}
              >
                <td className="py-2 pr-2">
                  {/* A real button so the row is reachable by keyboard; the
                    * row's own onClick covers the mouse on the other cells. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(p.product);
                    }}
                    className={cx("block w-full truncate text-left hover:text-ink text-ink", isSelected && "font-medium")}
                    title={p.product}
                  >
                    {p.product}
                  </button>
                </td>
                <td className={cx("py-2 pr-2 text-right tnum font-medium", p.avgYield < LOW_YIELD_PCT ? "text-warn" : "text-ink")}>
                  {p.avgYield}%
                </td>
                <td className="py-2 text-right tnum">
                  {p.flagged > 0 ? <span className="font-medium text-warn">{p.flagged}</span> : <span className="text-ink-4">&ndash;</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One product, one thing at a time. The headline states the case and the
 * question chips sit right under it (they are questions about that
 * sentence). Below: the year-over-year numbers as one plain row, then a
 * single chart with a switch for which series it shows — yield, or minutes
 * at one station — with the value printed under every bar, so nothing has
 * to be read off a colour. The batch list is there but folded, since the
 * chart already says what the last three months looked like.
 */
function ProductDetail({ card, multi, targets, onClear }) {
  const { product, history, recentRows } = card.context;
  return (
    <div>
      <PanelHeader title={product} onClear={onClear} />
      <InsightHeadline card={card} />
      <div className="mt-3 pl-[26px]">
        <InsightQA card={card} />
      </div>

      <Section title="Compared with a year ago" hint={`The last ${HISTORY_WINDOW_DAYS} days against the same ${HISTORY_WINDOW_DAYS} days last year`}>
        <YearOverYear history={history} />
      </Section>

      <Section title="Month by month">
        <MonthChart history={history} targets={targets} />
      </Section>

      <Section title={`Batches in the last ${HISTORY_WINDOW_DAYS} days`} folded count={recentRows.length}>
        <RecentBatches rows={recentRows} multi={multi} />
      </Section>
    </div>
  );
}

/** A titled block; `folded` starts collapsed behind its title. */
function Section({ title, hint, folded = false, count, children }) {
  const [open, setOpen] = useState(!folded);
  return (
    <div className="mt-6 pt-5 border-t border-line">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ink uppercase tracking-wide">
            {title}
            {count != null && <span className="ml-1.5 font-normal text-ink-4 normal-case tracking-normal">({count})</span>}
          </p>
          {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
        </div>
        {folded && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-ink-3 hover:text-ink shrink-0" aria-expanded={open}>
            {open ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

/**
 * The year-over-year numbers as one row of plain figures — now, then, and
 * the change — no boxes inside the box. Change is the only coloured thing.
 */
function YearOverYear({ history }) {
  const { stations, recent, yearAgo } = history;
  const hasYearAgo = yearAgo.batches > 0;
  if (!hasYearAgo && !recent.batches) return <p className="text-xs text-ink-4">Nothing closed in either window yet.</p>;

  const rows = [
    {
      key: "yield",
      label: "Average yield",
      now: recent.avgYield != null ? `${recent.avgYield}%` : "—",
      then: hasYearAgo && yearAgo.avgYield != null ? `${yearAgo.avgYield}%` : null,
      delta: hasYearAgo && recent.avgYield != null ? round1(recent.avgYield - yearAgo.avgYield) : null,
      unit: "pt",
      goodWhen: "up",
    },
    { key: "batches", label: "Batches closed", now: recent.batches, then: hasYearAgo ? yearAgo.batches : null },
    ...stations.map((s) => ({
      key: s,
      label: `${s}, average minutes`,
      now: recent.minutes[s] != null ? `${recent.minutes[s]} min` : "—",
      then: yearAgo.minutes[s] != null ? `${yearAgo.minutes[s]} min` : null,
      delta: recent.minutes[s] != null && yearAgo.minutes[s] != null ? recent.minutes[s] - yearAgo.minutes[s] : null,
      unit: "min",
      goodWhen: "down",
    })),
  ];

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 gap-y-1.5 items-baseline text-sm">
        <span />
        <span className="text-[11px] text-ink-4 text-right">Now</span>
        <span className="text-[11px] text-ink-4 text-right">Year ago</span>
        <span className="text-[11px] text-ink-4 text-right">Change</span>
        {rows.map((r) => (
          <React.Fragment key={r.key}>
            <span className="text-ink-2 truncate">{r.label}</span>
            <span className="text-right tnum font-semibold text-ink">{r.now}</span>
            <span className="text-right tnum text-ink-3">{r.then ?? "—"}</span>
            <span className="text-right tnum">{r.delta != null ? <Delta delta={r.delta} unit={r.unit} goodWhen={r.goodWhen} /> : <span className="text-ink-4">—</span>}</span>
          </React.Fragment>
        ))}
      </div>
      {!hasYearAgo && <p className="mt-2 text-xs text-ink-4">Nothing on record from a year ago yet.</p>}
    </div>
  );
}

/** A signed change, coloured by whether it went the good way. */
function Delta({ delta, unit, goodWhen }) {
  const flat = Math.abs(delta) < (unit === "pt" ? 1 : 3);
  const good = goodWhen === "up" ? delta > 0 : delta < 0;
  return (
    <span className={cx("font-semibold", flat ? "text-ink-4" : good ? "text-ok" : "text-warn")}>
      {delta > 0 ? "+" : ""}
      {delta}
      {unit === "pt" ? " pt" : ` ${unit}`}
    </span>
  );
}

/**
 * One chart, one series at a time: yield, or average minutes at a station.
 * Every bar carries its value underneath, in one flat colour — ok for
 * yield, ink for minutes — with warn reserved for the bars that actually
 * crossed the line (a month averaging under LOW_YIELD_PCT, or over the
 * station's target). Height still tracks the value, and for minutes a
 * dotted rule marks the target so "over" is a thing you can see, not infer.
 */
function MonthChart({ history, targets }) {
  const { months, stations } = history;
  const series = [
    { value: "yield", label: "Yield" },
    ...stations.map((s) => ({ value: s, label: s })),
  ];
  const [which, setWhich] = useState("yield");
  const isYield = which === "yield";
  const target = isYield ? null : targets[which] ?? STAGE_TARGET_MINUTES[which];

  const points = months.map((m) => {
    const v = isYield ? m.avgYield : m.minutes[which];
    return {
      ...m,
      v: v ?? null,
      over: v != null && (isYield ? v < LOW_YIELD_PCT : isOverTarget(which, v, targets)),
    };
  });
  const values = points.map((p) => p.v).filter((v) => v != null);
  /* Axis floor/ceiling hug the data (values are printed, so height only has
   * to make the differences visible, not be true to zero). For minutes the
   * target is always inside the range so the rule can show. */
  const lo = isYield ? Math.min(...values) - 4 : Math.min(target, ...values) * 0.92;
  const hi = isYield ? Math.max(...values) + 2 : Math.max(target, ...values) * 1.04;
  const scale = (v) => Math.max(0.06, Math.min(1, (v - lo) / (hi - lo)));

  return (
    <div>
      {series.length > 1 && (
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <Segmented size="sm" value={which} onChange={setWhich} options={series} />
          <p className="text-xs text-ink-3">
            {isYield
              ? `Average yield per month. Amber: under ${LOW_YIELD_PCT}%.`
              : `Average minutes per month. Dotted line: the ${target}-minute target. Amber: far enough over it to be flagged.`}
          </p>
        </div>
      )}

      {/* Bars and labels are two rows with the same flex columns, so the
       * target rule can be positioned in the bar row alone. */}
      <div className="relative h-28">
        {target != null && (
          <div
            className="absolute left-0 right-0 z-10 border-t border-dotted border-ink pointer-events-none"
            style={{ bottom: `${Math.round(scale(target) * 100)}%` }}
            aria-hidden
          />
        )}
        <div
          className="flex items-end gap-1.5 h-full"
          role="img"
          aria-label={`${isYield ? "Yield" : `${which} minutes`} by month, oldest to newest: ${points.map((p) => `${p.label} ${p.v ?? "no batches"}`).join(", ")}`}
        >
          {points.map((p) =>
            p.v == null ? (
              <span key={p.key} className="flex-1 min-w-[6px] h-full rounded-sm border border-dashed border-line-strong bg-sunken" title={`${p.label} ${p.year} · no batches`} />
            ) : (
              <span
                key={p.key}
                className={cx("flex-1 min-w-[6px] rounded-sm", p.over ? "bg-warn" : isYield ? "bg-ok" : "bg-ink-3")}
                style={{ height: `${Math.round(scale(p.v) * 100)}%` }}
                title={`${p.label} ${p.year} · ${p.v}${isYield ? "%" : " min"}${isYield ? ` over ${p.batches} batch${p.batches === 1 ? "" : "es"}` : ""}`}
              />
            )
          )}
        </div>
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {points.map((p) => (
          <div key={p.key} className="flex-1 min-w-[6px] text-center leading-tight">
            <p className={cx("text-[11px] tnum", p.v == null ? "text-ink-4" : p.over ? "text-warn font-medium" : "text-ink-2")}>
              {p.v == null ? "–" : isYield ? `${round1(p.v)}%` : Math.round(p.v)}
            </p>
            <p className="text-[10px] text-ink-4">{p.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rows the batch list shows before it asks; the rest sit behind "Show all". */
const RECENT_ROWS = 8;

/** The last window's batches, newest first — the numbers behind the chart. */
function RecentBatches({ rows, multi }) {
  const [showAll, setShowAll] = useState(false);
  if (!rows.length) return <p className="text-xs text-ink-4">No batches closed in the last {HISTORY_WINDOW_DAYS} days.</p>;
  const newestFirst = [...rows].reverse();
  const shown = showAll ? newestFirst : newestFirst.slice(0, RECENT_ROWS);
  return (
    <div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-ink-4 border-b border-line">
            <th className="font-medium pb-1.5 pr-3">Closed</th>
            <th className="font-medium pb-1.5 pr-3 text-right">Yield</th>
            <th className="font-medium pb-1.5 pr-3 text-right">Box &rarr; final</th>
            <th className="font-medium pb-1.5 text-right">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const stations = Object.entries(r.minutes || {});
            return (
              <tr key={r.id} className="border-b border-line-soft last:border-0">
                <td className="py-1.5 pr-3 text-ink-2">
                  {formatDay(r.closedOn)}
                  {multi && r.locationName && <span className="text-ink-4"> · {r.locationName}</span>}
                </td>
                <td className={cx("py-1.5 pr-3 text-right tnum font-medium", r.flagged ? "text-warn" : "text-ink")}>{r.y}%</td>
                <td className="py-1.5 pr-3 text-right tnum text-ink-3">
                  {r.boxWeight} &rarr; {r.finalWeight} lb
                </td>
                <td className="py-1.5 text-right tnum text-ink-3">{stations.map(([s, m]) => `${s} ${m}`).join(" · ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {newestFirst.length > RECENT_ROWS && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs text-ink-3 hover:text-ink">
          {showAll ? "Show fewer" : `Show all ${newestFirst.length}`}
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------- Shared pieces -- */

/** The calendar's side panel: sticky on wide screens, full width below. */
function Panel({ children }) {
  return <div className="w-full lg:w-80 shrink-0 rounded-md border border-line bg-surface p-4 lg:sticky lg:top-6">{children}</div>;
}

function PanelHeader({ title, onClear }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <p className="text-sm font-semibold text-ink truncate">{title}</p>
      <button type="button" onClick={onClear} className="text-xs text-ink-3 hover:text-ink shrink-0">
        Clear
      </button>
    </div>
  );
}

/** A card's icon, title and one-line detail. */
function InsightHeadline({ card }) {
  const Icon = TONE_ICON[card.tone];
  return (
    <div className="flex items-start gap-2.5">
      <span className={cx("shrink-0 mt-0.5", TONE_TEXT[card.tone])}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{card.title}</p>
        <p className="mt-1 text-xs text-ink-3 leading-relaxed">{card.detail}</p>
      </div>
    </div>
  );
}

/**
 * Question chips, opt-in freeform, and the running thread of answers for
 * anything with a `context` bundle. Chips always visible; freeform is opt-in
 * via the last pill since it's the one path that can dead-end in a generic
 * fallback.
 */
function InsightQA({ card }) {
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState([]);
  const [customOpen, setCustomOpen] = useState(false);

  // De-duped against the last question only: re-tapping a chip means "show
  // me that again", not "add a duplicate line".
  const ask = (raw) => {
    const q = (raw ?? question).trim();
    if (!q) return;
    setThread((t) => (t.length && t[t.length - 1].q === q ? t : [...t, { q, a: answerInsightQuestion(card, q) }]));
    setQuestion("");
  };

  const quick = QUICK_QUESTIONS[card.context?.type] || [];

  return (
    <div>
      <div className="flex items-center flex-wrap gap-1.5">
        {quick.map((qq) => (
          <button
            key={qq.label}
            type="button"
            onClick={() => ask(qq.text)}
            aria-label={qq.text}
            className="inline-flex items-center h-6 px-2.5 rounded-full border border-line bg-surface text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink transition-colors"
          >
            {qq.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          aria-expanded={customOpen}
          aria-label="Ask your own question about this insight"
          className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-line bg-surface text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink transition-colors"
        >
          <MessageCircle size={11} /> Ask something else
        </button>
      </div>

      {customOpen && (
        <div className="mt-2 flex items-center gap-1.5">
          <Input
            autoFocus
            value={question}
            placeholder="Ask about this…"
            aria-label="Ask a question about this insight"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            className="flex-1"
          />
          <Button size="sm" icon={Send} onClick={() => ask()} aria-label="Send question">
            Ask
          </Button>
        </div>
      )}

      {thread.length > 0 && (
        <div className="mt-3 space-y-2" role="log" aria-live="polite" aria-label="Answers">
          {thread.map((t, i) => (
            <div key={i} className="text-xs rounded-md bg-sunken px-2.5 py-2">
              <p className="font-medium text-ink-2">&ldquo;{t.q}&rdquo;</p>
              <p className="mt-0.5 text-ink-3 leading-relaxed">{t.a}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The narrow-panel composition: headline, an optional block (a day's batch
 * list), then the Q&A indented under the icon.
 */
function InsightDetail({ card, children }) {
  return (
    <div>
      <InsightHeadline card={card} />
      <div className="pl-[26px] mt-3">
        {children && <div className="mb-3">{children}</div>}
        <InsightQA card={card} />
      </div>
    </div>
  );
}
