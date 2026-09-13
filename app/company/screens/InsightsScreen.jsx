"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageCircle, Send, Sparkles } from "lucide-react";

import { Button, Input, Segmented, Slot, cx } from "../../components/ui";
import { formatDay, isOverTarget, LOW_YIELD_PCT, shiftDate, STAGE_TARGET_MINUTES, todayKey, yieldPct } from "../../lib/domain";
import { answerInsightQuestion, HISTORY_WINDOW_DAYS, isFlaggedBatch, productHistory } from "../lib/insights";

/**
 * The console's landing screen, in three layers:
 *
 *   1. Header — scope in the subtitle, the period's numbers as a ticker in
 *      the corner, and (admins) a switch between the two ways of cutting the
 *      same closed-batch history. The ticker is the same in both views, so
 *      switching the cut never moves it.
 *   2. Calendar view — five weeks of days beside one panel: a picked day, or
 *      the rolled-up insight cards when nothing is picked.
 *   3. Products view (admin) — one full-width ledger row per product (name,
 *      spread, average, flagged) with the picked product's history opening
 *      underneath it: now vs. a year ago, month by month, and the last
 *      window's batches, with the same question chips.
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

/* The Q&A sits under its card's icon rather than the card's left edge, so
 * the icon reads as a bullet for the whole block. 16px icon + 10px gap. */
const ICON_INDENT = "pl-[26px]";

/**
 * Hairline column rule for the header ticker, same as the floor's Batches
 * screen. Module scope so React does not remount it every render; `h-2`
 * centres on the text, so nothing else in that row may carry a vertical
 * nudge or the rule centres against the taller flex line instead.
 */
const Rule = () => <span className="w-[0.5px] h-2 self-center rounded-full bg-line" aria-hidden="true" />;

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
      /* The product's own name is the heading — the panel is already about
       * one product, so "N batches of X closed" would say it twice. The
       * count belongs in the sentence that qualifies the average. */
      title: selectedProduct,
      detail: `${rows.length} batch${rows.length === 1 ? "" : "es"} closed, ${formatDay(rows[0].closedOn)} to ${formatDay(
        rows[rows.length - 1].closedOn
      )} · ${avgY}% average yield${stats ? `, ${stats.low}%–${stats.high}% range` : ""}${flaggedCount ? ` · ${flaggedCount} flagged` : ""}.`,
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
      <Slot name="page-actions">
        <div className="flex items-center gap-3">
          <HeadlineTicker batches={insights.company.batches} avg={companyAvg} flagged={insights.company.flagged} />
          {isAdmin && <Segmented size="sm" value={view} onChange={setView} options={VIEWS} />}
        </div>
      </Slot>

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
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Header -- */

/**
 * The period's numbers beside the screen title, as a ticker rather than
 * tiles: they are the standing context for everything below, not findings
 * of their own, and two big boxes were claiming a whole band of the page to
 * say so. Ticker rules, same as the floor's Batches screen: one row, one
 * size, one weight — only colour varies, and `tnum` keeps the digits from
 * changing width as the numbers move.
 */
function HeadlineTicker({ batches, avg, flagged }) {
  if (!batches) return null;
  return (
    <div className="flex items-center gap-2.5 text-xs font-normal leading-none">
      <span className="text-ink-4 tnum">{avg != null ? `Yield ${avg}%` : "No yield yet"}</span>
      <Rule />
      <span className="text-ink-4 tnum">
        {batches} batch{batches === 1 ? "" : "es"}
      </span>
      <Rule />
      <span className={cx("tnum", flagged ? "text-warn/80" : "text-ink-4")}>
        {flagged ? `${flagged} flagged` : "none flagged"}
      </span>
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
                    aria-label={`${formatDay(day.key)}${hasData ? `, ${day.avgY}% average yield over ${day.batches.length} batches${day.flaggedCount ? `, ${day.flaggedCount} flagged` : ""}` : ", no batches closed"}`}
                    className={cx(
                      "aspect-square rounded-md border p-1.5 flex flex-col justify-between text-left transition-colors",
                      hasData ? "border-line-strong bg-surface cursor-pointer hover:border-ink-3" : "border-line-soft",
                      !hasData && !day.isFuture && "bg-sunken",
                      day.isFuture && "opacity-40",
                      selected && "ring-2 ring-ink-3 ring-offset-1"
                    )}
                  >
                    {/* Top row: which day it is. Bottom row: what happened. */}
                    <span className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1 min-w-0">
                        <span className={cx("text-[11px] tnum", hasData ? "text-ink-2" : "text-ink-4")}>{dayNum}</span>
                        {day.dots.map((c, i) => (
                          <span key={i} className={cx("w-1.5 h-1.5 rounded-full shrink-0", c)} />
                        ))}
                      </span>
                      {day.isToday && <span className="w-1.5 h-1.5 rounded-full bg-ink-3 shrink-0" />}
                    </span>
                    {hasData && (
                      <span className="flex items-end justify-between gap-1">
                        <span className="text-sm font-semibold text-ink tnum leading-none">{day.avgY}%</span>
                        {day.flagged && <AlertTriangle size={11} className="text-warn shrink-0" />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-ink-3">
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
    <div className="space-y-5">
      <ProductYieldTable byProduct={byProduct} selected={selected} onSelect={onSelect} />

      {/* The detail opens UNDER the ledger at full width rather than beside
        * it: the month chart and the batch table both want the room, and a
        * side panel meant half the screen sat empty until somebody clicked. */}
      {card ? (
        <div className="rounded-md border border-line bg-surface p-5">
          <ProductDetail key={card.id} card={card} multi={multi} targets={targets} onClear={() => onSelect(selected)} />
        </div>
      ) : selected ? (
        <p className="text-xs text-ink-4">No closed batches of {selected} yet.</p>
      ) : (
        <p className="text-xs text-ink-4">
          Pick a product for its month-by-month run and how it compares with a year ago.
        </p>
      )}
    </div>
  );
}

/**
 * Yield rolled up by product — "which item" rather than "which shop" or
 * "which shift". Worst average first, since that is where a manager would
 * look. One full-width row per product, the way Targets does it: the name,
 * the spread, the average, the flagged count. The only colour is the warn
 * on an average under the low-yield line or a flagged count, so anything
 * warm means "look here" and nothing else.
 */
function ProductYieldTable({ byProduct, selected, onSelect }) {
  /* Rows can only be compared against each other if their bars share a
   * scale, so the domain is measured once across every product — and always
   * contains the low-yield line, since a bar's job is to show which
   * products cross it. */
  const domain = useMemo(() => {
    const lo = Math.min(LOW_YIELD_PCT, ...byProduct.map((p) => p.low));
    const hi = Math.max(LOW_YIELD_PCT, ...byProduct.map((p) => p.high));
    return [Math.floor(lo - 2), Math.ceil(hi + 2)];
  }, [byProduct]);

  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <table className="w-full text-sm border-collapse">
        <colgroup>
          <col className="w-56" />
          <col />
          <col className="w-24" />
          <col className="w-20" />
          <col className="w-16" />
        </colgroup>
        <thead>
          <tr className="text-left text-xs text-ink-4 border-b border-line">
            <th className="font-medium pb-2 pr-3">Product</th>
            <th className="font-medium pb-2 pr-3">Spread</th>
            <th className="font-medium pb-2 pr-3 text-right hidden sm:table-cell">Range</th>
            <th className="font-medium pb-2 pr-3 text-right">Avg yield</th>
            <th className="font-medium pb-2 text-right">Flagged</th>
          </tr>
        </thead>
        <tbody>
          {byProduct.map((p, i) => {
            const isSelected = selected === p.product;
            return (
              <tr
                key={p.product}
                onClick={() => onSelect(p.product)}
                aria-selected={isSelected}
                className={cx(
                  "cursor-pointer transition-colors hover:bg-sunken",
                  /* Striped, not ruled: five columns of mostly numbers read
                   * straighter on a band than under a hairline. */
                  !isSelected && i % 2 === 1 && "bg-faint",
                  isSelected && "bg-sunken"
                )}
              >
                <td className="py-2 pr-3">
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
                <td className="py-2 pr-3">
                  <YieldRange low={p.low} high={p.high} avg={p.avgYield} domain={domain} />
                </td>
                <td className="py-2 pr-3 text-right tnum text-xs text-ink-4 hidden sm:table-cell">
                  {round1(p.low)}&ndash;{round1(p.high)}%
                </td>
                <td className={cx("py-2 pr-3 text-right tnum font-medium", p.avgYield < LOW_YIELD_PCT ? "text-warn" : "text-ink")}>
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
      <p className="mt-3 text-xs text-ink-4">
        Lowest average first. The bar is each product&rsquo;s low&ndash;high spread with its average marked; the dotted line is{" "}
        {LOW_YIELD_PCT}%.
      </p>
    </div>
  );
}

/**
 * One product's spread on the scale every other row shares: the low–high
 * span as a track segment, the average as a tick, and the low-yield line as
 * a dotted rule. It answers the question the average alone cannot — whether
 * a product is steadily mediocre or wildly inconsistent — so the span is
 * the quiet part and the average is the mark you read.
 */
function YieldRange({ low, high, avg, domain }) {
  const [lo, hi] = domain;
  const at = (v) => ((v - lo) / (hi - lo)) * 100;
  const under = avg < LOW_YIELD_PCT;
  const left = at(low);
  /* A product with one batch has low === high; without a floor its span
   * would be invisible and the row would look like it had no data. */
  const width = Math.max(1.5, at(high) - left);

  return (
    <span
      className="relative block h-4 w-full min-w-[4rem]"
      title={`${round1(low)}%–${round1(high)}%, ${avg}% average`}
      role="img"
      aria-label={`Spread ${round1(low)} to ${round1(high)} percent, average ${avg} percent`}
    >
      <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-sunken" />
      <span
        className={cx("absolute top-1/2 -translate-y-1/2 h-1 rounded-full", under ? "bg-warn/30" : "bg-ok/30")}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
      <span
        className="absolute inset-y-0.5 border-l border-dotted border-ink-4"
        style={{ left: `${at(LOW_YIELD_PCT)}%` }}
        aria-hidden
      />
      <span
        className={cx("absolute top-1/2 -translate-y-1/2 w-[3px] h-3 rounded-full", under ? "bg-warn" : "bg-ok")}
        style={{ left: `calc(${at(avg)}% - 1.5px)` }}
      />
    </span>
  );
}

/**
 * One product, one thing at a time. One title block — the product's name,
 * the sentence about it, and the way out — then the question chips right
 * under it (they are questions about that sentence). Below: the
 * year-over-year numbers as one plain row, then a single chart with a
 * switch for which series it shows — yield, or minutes at one station —
 * with the value printed under every bar, so nothing has to be read off a
 * colour. The batch list is there but folded, since the chart already says
 * what the last three months looked like.
 */
function ProductDetail({ card, multi, targets, onClear }) {
  const { history, recentRows } = card.context;
  return (
    <div>
      <InsightHeadline card={card} onClear={onClear} />
      <div className={cx("mt-3", ICON_INDENT)}>
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
      {/* Capped: the panel is full width now, and a four-column figure grid
        * stretched across it puts the change a foot away from its label. */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 gap-y-1.5 items-baseline text-sm max-w-xl">
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
        <div className="mb-3">
          <Segmented size="sm" value={which} onChange={setWhich} options={series} />
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
      {/* The key reads after the chart, where you look once you have a
        * question about it — not next to the control that changes it. */}
      <p className="mt-2 text-xs text-ink-4">
        {isYield
          ? `Amber: a month averaging under ${LOW_YIELD_PCT}%.`
          : `Dotted line: the ${target}-minute target. Amber: far enough over it to be flagged.`}
      </p>
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

/**
 * A card's icon, title and one-line detail — and, when the card is one the
 * user picked, the way back out. Taking `onClear` here is what lets a
 * picked product have a single heading instead of a panel header above a
 * card title that says the same thing.
 */
function InsightHeadline({ card, onClear }) {
  const Icon = TONE_ICON[card.tone];
  return (
    <div className="flex items-start gap-2.5">
      <span className={cx("shrink-0 mt-0.5", TONE_TEXT[card.tone])}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink truncate">{card.title}</p>
        <p className="mt-1 text-xs text-ink-3 leading-relaxed">{card.detail}</p>
      </div>
      {onClear && (
        <button type="button" onClick={onClear} className="text-xs text-ink-3 hover:text-ink shrink-0">
          Clear
        </button>
      )}
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
        <div className="mt-3 space-y-2 max-w-2xl" role="log" aria-live="polite" aria-label="Answers">
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
      <div className={cx(ICON_INDENT, "mt-3")}>
        {children && <div className="mb-3">{children}</div>}
        <InsightQA card={card} />
      </div>
    </div>
  );
}
