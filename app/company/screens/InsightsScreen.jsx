"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Filter, Rows3, Send, Sparkles, X } from "lucide-react";

import { Button, Dropdown, IconButton, Input, Modal, Segmented, Slot, cx } from "../../components/ui";
import { formatDay, isOverTarget, LOW_YIELD_PCT, shiftDate, STAGE_TARGET_MINUTES, todayKey, yieldPct } from "../../lib/domain";
import { answerInsightQuestion, isFlaggedBatch, windowStats } from "../lib/insights";

/**
 * The console's landing screen: one page, no cards, read top to bottom.
 *
 *   Title + subtitle + ticker — the scope, the period, and the standing
 *   numbers. These follow the product filter, so they always describe what
 *   is actually on screen; there is no second set of numbers anywhere.
 *   The strip — a bar per day (or per week) across the last five weeks.
 *   The long view — now vs. a year ago, month by month, and the last
 *   window's batches, for whatever the filter says.
 *
 * The product filter is what used to be a second "By product" screen with
 * its own ledger: "which items" and "which days" are two readings of the
 * same closed batches, so they are one page with a filter rather than two
 * screens behind a switch.
 *
 * A picked day and the current filter both build the same card shape
 * (`context.type` "day" / "product"), which is what lets one Q&A answer for
 * both — and lets `SelectionAsk` answer for anything highlighted anywhere.
 *
 * `insights` and `history` arrive pre-filtered by CompanyConsole to the
 * locations the user can see; each history item carries
 * `locationId`/`locationName` so multi-location days can show identity dots.
 */

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TONE_ICON = { warn: AlertTriangle, danger: AlertTriangle, ok: CheckCircle2, neutral: Sparkles };
const TONE_TEXT = { warn: "text-warn", danger: "text-danger", ok: "text-ok", neutral: "text-ink-2" };

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

/**
 * A day's card. Module scope, not a memo body, because the selection popup
 * has to be able to build one for ANY day the user highlights, not only the
 * day that happens to be picked.
 */
function makeDayCard(cell, companyAvg) {
  if (!cell || cell.batches.length === 0) return null;
  const { key, batches, avgY, flaggedCount } = cell;
  return {
    id: `day-${key}`,
    tone: toneFor(flaggedCount, avgY, companyAvg),
    title: `${batches.length} batch${batches.length === 1 ? "" : "es"} closed`,
    detail: `${avgY}% average yield${flaggedCount ? `, ${flaggedCount} flagged` : ""}.`,
    context: { type: "day", key, batches, avgY, flaggedCount, companyAvg },
  };
}

/**
 * The card for what the page is currently showing: the selected products
 * over the selected range. Built from rows rather than re-filtering, because
 * the screen has already resolved yield and flags once for everything.
 *
 * `noun` is the word the Q&A drops into sentences ("the latest 28 NOUN
 * batches average…"), so it has to sit in front of "batches" and read — that
 * is why a two-product pick becomes "filtered" rather than "2 products".
 */
function makeRunCard({ rows, products = [], companyAvg, scopeLabel, from, to }) {
  if (!rows.length) return null;

  const yields = rows.map((r) => r.y);
  const avgY = round1(yields.reduce((a, b) => a + b, 0) / yields.length);
  const low = round1(Math.min(...yields));
  const high = round1(Math.max(...yields));
  const flaggedCount = rows.filter((r) => r.flagged).length;

  const single = products.length === 1 ? products[0] : null;
  /* Same rule as the chart: one product is amber when it has flagged
   * batches, but EVERY product always has some, so an aggregate is only
   * amber when its own average fell under the line. */
  const tone = single ? toneFor(flaggedCount, avgY, companyAvg) : avgY < LOW_YIELD_PCT ? "warn" : "neutral";
  const title = single ?? (products.length ? `${products.length} products` : "Every product");
  const noun = single ?? (products.length ? "filtered" : scopeLabel || "closed");

  /* The Q&A's "trend" and "a year ago" answers read these two windows. */
  const stations = [...new Set(rows.flatMap((r) => Object.keys(r.minutes || {})))];
  const back = (k) => shiftDate(k, -365);
  const inWin = (list, a, b) => list.filter((r) => r.closedOn >= a && r.closedOn <= b);
  const hist = {
    stations,
    months: [],
    recent: { from, to, ...windowStats(rows) },
    yearAgo: { from: back(from), to: back(to), ...windowStats(inWin(rows, back(from), back(to))) },
  };

  return {
    id: `run-${products.join("|") || "all"}-${from}-${to}`,
    tone,
    title,
    detail: `${rows.length} batch${rows.length === 1 ? "" : "es"} closed, ${formatDay(rows[0].closedOn)} to ${formatDay(
      rows[rows.length - 1].closedOn
    )} · ${avgY}% average yield, ${low}%–${high}% range${flaggedCount ? ` · ${flaggedCount} flagged` : ""}.`,
    context: {
      type: "product",
      product: noun,
      rows,
      recentRows: rows,
      history: hist,
      avgY,
      flaggedCount,
      companyAvg,
      stats: { product: title, batches: rows.length, avgYield: avgY, flagged: flaggedCount, low, high },
    },
  };
}

/* ------------------------------------------------------------- Screen -- */

export default function InsightsScreen({ scopeLabel, insights, history, targets = {}, isAdmin = false }) {
  /* Which products the page is about. Empty means every product. */
  const [productFilter, setProductFilter] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [listOpen, setListOpen] = useState(false);

  const multi = insights.byLocation.length > 1;
  const companyAvg = insights.company.avgYield;

  /* ---- Every closed batch we can see, oldest first, with yield and flag
   * resolved once. Everything on the page is a window onto this. */
  const rows = useMemo(
    () =>
      history
        .filter((h) => h.closedOn)
        .map((h) => ({ ...h, y: yieldPct(h.boxWeight, h.finalWeight), flagged: isFlaggedBatch(h, targets) }))
        .filter((h) => h.y != null)
        .sort((a, b) => (a.closedOn < b.closedOn ? -1 : a.closedOn > b.closedOn ? 1 : 0)),
    [history, targets]
  );

  const firstKey = rows.length ? rows[0].closedOn : todayKey();
  const lastKey = todayKey();

  const [range, setRange] = useState(() => {
    const to = todayKey();
    return { from: shiftDate(to, -34), to };
  });
  /* A range that predates the record, or a record that has grown past it,
   * is a range nobody chose. Clamp rather than silently draw empty space. */
  const from = clampKey(range.from, firstKey, lastKey);
  const to = clampKey(range.to, from, lastKey);
  const spanDays = daysBetween(from, to) + 1;
  const grain = grainFor(spanDays);

  const filtered = useMemo(
    () => (productFilter.length ? rows.filter((r) => productFilter.includes(r.product)) : rows),
    [rows, productFilter]
  );

  /* ---- The chart's buckets, and the same buckets one year earlier, which
   * is what makes "compared with a year ago" follow the scrubber instead of
   * being frozen at ninety days. */
  const inWindow = (list, a, b) => list.filter((r) => r.closedOn >= a && r.closedOn <= b);

  const buckets = useMemo(() => {
    const byBucket = new Map();
    for (const r of inWindow(filtered, from, to)) {
      const k = grain === "month" ? monthKey(r.closedOn) : grain === "week" ? startOfWeek(r.closedOn) : r.closedOn;
      (byBucket.get(k) || byBucket.set(k, []).get(k)).push(r);
    }
    return bucketsFor(from, to, grain).map((b) => ({ ...b, rows: byBucket.get(b.key) || [], ...windowStats(byBucket.get(b.key) || []) }));
  }, [filtered, from, to, grain]);

  /* The scrubber's context track: the whole record at week resolution, and
   * unfiltered — it is a map of where the data is, not a second chart. */
  const weeks = useMemo(() => {
    const byWeek = new Map();
    for (const r of filtered) {
      const k = startOfWeek(r.closedOn);
      (byWeek.get(k) || byWeek.set(k, []).get(k)).push(r);
    }
    return bucketsFor(firstKey, lastKey, "week").map((b) => ({ ...b, ...windowStats(byWeek.get(b.key) || []) }));
  }, [filtered, firstKey, lastKey]);

  const stations = useMemo(() => [...new Set(filtered.flatMap((r) => Object.keys(r.minutes || {})))], [filtered]);

  /* ---- The standing numbers, and the card everything asks questions of:
   * the selected products over the selected range, nothing else. */
  const windowRows = useMemo(() => inWindow(filtered, from, to), [filtered, from, to]);
  const runCard = useMemo(
    () => makeRunCard({ rows: windowRows, products: productFilter, companyAvg, scopeLabel, from, to }),
    [windowRows, productFilter, companyAvg, scopeLabel, from, to]
  );

  const yearAgo = useMemo(() => {
    const a = shiftDate(from, -365);
    const b = shiftDate(to, -365);
    return { from: a, to: b, ...windowStats(inWindow(filtered, a, b)) };
  }, [filtered, from, to]);

  /* Shifted back 365 days, a window longer than a year still contains part
   * of itself. */
  const overlaps = spanDays > 365;

  const comparison = useMemo(
    () => ({ stations, recent: { from, to, ...windowStats(windowRows) }, yearAgo }),
    [stations, from, to, windowRows, yearAgo]
  );

  /* ---- A picked day, which only exists at day granularity. */
  const selectedCell = useMemo(() => {
    if (!selectedDay) return null;
    const b = buckets.find((x) => x.key === selectedDay);
    return b ? { key: b.key, batches: b.rows, avgY: b.avgYield, flaggedCount: b.flagged } : null;
  }, [selectedDay, buckets]);
  const dayCard = useMemo(() => makeDayCard(selectedCell, companyAvg), [selectedCell, companyAvg]);

  /* ---- Picking a bar. At day granularity it opens that day; at week or
   * month it zooms the range into that bucket, which is the only reading a
   * bar of many days can support. */
  const pickBucket = (b) => {
    if (grain === "day") {
      setSelectedDay((cur) => (cur === b.key ? null : b.key));
      return;
    }
    setSelectedDay(null);
    setRange({ from: clampKey(b.from, firstKey, lastKey), to: clampKey(b.to, firstKey, lastKey) });
  };

  const changeRange = (next) => {
    setSelectedDay(null);
    setRange(next);
  };

  /* Narrowing the products changes what every bar means. */
  const changeFilter = (next) => {
    setProductFilter(next);
    setSelectedDay(null);
  };

  const productOptions = useMemo(
    () => (insights.byProduct || []).map((p) => ({ value: p.product, label: `${p.product} · ${p.avgYield}%` })),
    [insights.byProduct]
  );

  const filterLabel =
    productFilter.length === 1 ? productFilter[0] : productFilter.length ? `${productFilter.length} products` : null;

  /* A shop that has closed nothing lately is the loudest thing the chart can
   * say, and an empty tail of bars says it only by omission. */
  const quietSince = useMemo(() => {
    if (grain !== "day") return null;
    const withData = buckets.filter((b) => b.avgYield != null);
    if (!withData.length) return null;
    const last = withData[withData.length - 1];
    return daysBetween(last.key, to) > 3 ? last.key : null;
  }, [buckets, grain, to]);

  /* What the selection popup asks about: `data-ask` on an ancestor of the
   * highlighted text names the subject. */
  const cardForAsk = (ask) => {
    if (!ask) return null;
    const [kind, value] = [ask.slice(0, ask.indexOf(":")), ask.slice(ask.indexOf(":") + 1)];
    if (kind === "day") return makeDayCard(selectedCell?.key === value ? selectedCell : null, companyAvg);
    if (kind === "product")
      return makeRunCard({
        rows: inWindow(rows.filter((r) => r.product === value), from, to),
        products: [value],
        companyAvg,
        scopeLabel,
        from,
        to,
      });
    /* Anything else highlighted is about what the page is about. */
    return runCard;
  };

  const askKey = productFilter.length === 1 ? `product:${productFilter[0]}` : "run:";

  return (
    <div data-ask-root="">
      {/* Subtitle and ticker are the ONE place the standing numbers live,
        * and they follow BOTH the product filter and the range, so they
        * always describe what is actually on screen. */}
      <Slot name="page-subtitle">
        {[scopeLabel, filterLabel, "closed batches"].filter(Boolean).join(" · ")}
      </Slot>
      <Slot name="page-actions">
        <div className="flex items-center gap-3">
          <HeadlineTicker
            batches={runCard?.context.rows.length ?? 0}
            avg={runCard?.context.avgY ?? null}
            flagged={runCard?.context.flaggedCount ?? 0}
            range={runCard ? [runCard.context.stats.low, runCard.context.stats.high] : null}
          />
          {isAdmin && productOptions.length > 1 && (
            <Dropdown
              multiple
              icon={Filter}
              value={productFilter}
              onChange={changeFilter}
              options={productOptions}
              placeholder="All products"
              menuClassName="!max-w-sm"
              summary={(n) => `${n} products`}
              aria-label="Filter by product"
            />
          )}
          {/* Every closed batch in the window, in time order. A person opens
            * this rarely — the chart is the reading surface — so it is an
            * icon in the header rather than a section at the foot of the
            * page, where it was the last thing on screen and the least
            * looked at. */}
          {runCard && (
            <IconButton
              label="All closed batches"
              icon={Rows3}
              onClick={() => setListOpen(true)}
              className="border border-line"
            />
          )}
        </div>
      </Slot>

      <Modal
        open={listOpen && !!runCard}
        onClose={() => setListOpen(false)}
        size="xl"
        icon={Rows3}
        title={`${runCard?.context.rows.length ?? 0} closed ${filterLabel ? `${filterLabel} ` : ""}batches`}
      >
        {runCard && <BatchTable rows={runCard.context.rows} multi={multi} targets={targets} cap={null} />}
      </Modal>

      <TimeScrubber from={from} to={to} firstKey={firstKey} lastKey={lastKey} weeks={weeks} onChange={changeRange} />

      <div className="mt-5">
        <RunChart
          buckets={buckets}
          grain={grain}
          stations={stations}
          targets={targets}
          selected={selectedDay}
          onPick={pickBucket}
          quietSince={quietSince}
        />
      </div>

      {selectedCell && dayCard ? (
        <div className="mt-6 pt-5 border-t border-line" data-ask={`day:${selectedCell.key}`}>
          <InsightHeadline
            card={{ ...dayCard, title: formatDay(selectedCell.key) }}
            onClear={() => setSelectedDay(null)}
          />
          <ul className={cx("mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1.5 max-w-4xl", ICON_INDENT)}>
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
        </div>
      ) : (
        <div data-ask={askKey}>
          <Section
            title="Compared with a year ago"
            hint={
              overlaps
                ? null
                : `The same ${spanDays} days one year earlier — ${formatDay(yearAgo.from)} to ${formatDay(yearAgo.to)}, ${yearAgo.from.slice(0, 4)}`
            }
          >
            {/* A window longer than a year, shifted back a year, overlaps
              * itself — the comparison would be partly against the very
              * batches it is comparing. Say so rather than print a number
              * that looks like an answer. */}
            {overlaps ? (
              <p className="text-xs text-ink-4">
                A {spanDays}-day window overlaps itself when shifted back a year. Narrow the period to a year or less to
                compare it with the same stretch last year.
              </p>
            ) : (
              <YearOverYear history={comparison} />
            )}
          </Section>
        </div>
      )}

      {/* Highlight anything on the page and ask about exactly that. */}
      <SelectionAsk cardFor={cardForAsk} />
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
function HeadlineTicker({ batches, avg, flagged, range }) {
  if (!batches) return null;
  return (
    <div className="flex items-center gap-2.5 text-xs font-normal leading-none">
      <span className="text-ink-4 tnum">{avg != null ? `Yield ${avg}%` : "No yield yet"}</span>
      {/* The spread used to be a column in the By-product ledger. It is the
        * one thing the average hides — two products can share an average and
        * run nothing alike — so it rides with the average, not elsewhere. */}
      {range && range[0] !== range[1] && (
        <>
          <Rule />
          <span className="text-ink-4 tnum">
            {range[0]}&ndash;{range[1]}%
          </span>
        </>
      )}
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

/* -------------------------------------------------------------- Time -- */

/**
 * The page has ONE time model. It used to have three — a fixed five-week
 * strip, a fixed thirteen-month chart, and a fixed ninety-day comparison —
 * which meant three windows on one page, three different averages, and no
 * way to ask about any other stretch. Now a range drives everything: the
 * chart, its granularity, the year-ago comparison, the standing numbers.
 */
const PRESETS = [
  { value: 35, label: "5 weeks" },
  { value: 91, label: "3 months" },
  { value: 365, label: "1 year" },
  { value: 0, label: "All" },
];

/* Granularity follows the range, because the bar is the unit you can read.
 * Ninety days of daily bars is a picket fence; five weeks of monthly bars is
 * two bars. Nobody should have to choose this by hand. */
const grainFor = (n) => (n <= 70 ? "day" : n <= 400 ? "week" : "month");
const GRAIN_NOUN = { day: "day", week: "week", month: "month" };

/** Bars carry their printed value only while there is room for the text. */
const VALUE_LABEL_MAX = 16;

const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 864e5);
const startOfWeek = (key) => shiftDate(key, -new Date(`${key}T00:00:00`).getDay());
const monthKey = (key) => key.slice(0, 7);
const clampKey = (key, lo, hi) => (key < lo ? lo : key > hi ? hi : key);

/** The bucket edges covering [from, to] at one granularity, oldest first. */
function bucketsFor(from, to, grain) {
  const out = [];
  if (grain === "day") {
    for (let k = from; k <= to; k = shiftDate(k, 1)) out.push({ key: k, from: k, to: k });
    return out;
  }
  if (grain === "week") {
    for (let k = startOfWeek(from); k <= to; k = shiftDate(k, 7)) out.push({ key: k, from: k, to: shiftDate(k, 6) });
    return out;
  }
  const d = new Date(`${monthKey(from)}-01T00:00:00`);
  const last = monthKey(to);
  while (d.toISOString().slice(0, 7) <= last) {
    const key = d.toISOString().slice(0, 7);
    const next = new Date(d);
    next.setMonth(next.getMonth() + 1);
    out.push({ key, from: `${key}-01`, to: shiftDate(next.toISOString().slice(0, 10), -1) });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/**
 * The axis stamp for a bucket. A ruler marks its units, not every tick: days
 * stamp the 1st and each week start, weeks stamp month turns, months stamp
 * the year on the first bar and each January.
 */
function stampFor(b, i, grain, buckets) {
  const d = new Date(`${(grain === "month" ? `${b.key}-01` : b.key)}T00:00:00`);
  const prev = i > 0 ? new Date(`${(grain === "month" ? `${buckets[i - 1].key}-01` : buckets[i - 1].key)}T00:00:00`) : null;
  const newMonth = !prev || prev.getMonth() !== d.getMonth();
  if (grain === "day") {
    if (d.getDate() === 1) return MONTH_LABELS[d.getMonth()];
    return i % 7 === 0 ? `${d.getDate()}` : "";
  }
  if (grain === "week") return newMonth ? MONTH_LABELS[d.getMonth()] : "";
  return `${MONTH_LABELS[d.getMonth()]}${i === 0 || d.getMonth() === 0 ? ` ’${String(d.getFullYear()).slice(2)}` : ""}`;
}

/**
 * Presets plus a drag-anywhere scrubber over the whole history. The presets
 * answer "the usual question" in one tap; the scrubber answers every other
 * one. The track draws the entire record at week resolution so the selected
 * window is always shown in the context of what else there is — including
 * the stretches with nothing in them.
 */
function TimeScrubber({ from, to, firstKey, lastKey, weeks, onChange }) {
  const [dragging, setDragging] = useState(null);

  const total = Math.max(1, daysBetween(firstKey, lastKey));
  const busiest = Math.max(1, ...weeks.map((w) => w.batches));
  const pct = (key) => (daysBetween(firstKey, key) / total) * 100;
  const left = Math.max(0, pct(from));
  const right = Math.min(100, pct(to));

  /* The track rect is read ONCE per gesture, inside the handler — a drag
   * cannot resize the window it is being measured against, and reading a ref
   * while rendering is a bug the linter is right about. */
  const begin = (mode) => (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(mode);
    const rect = e.currentTarget.closest("[data-scrub-track]")?.getBoundingClientRect();
    if (!rect) return;
    const keyAt = (clientX) => shiftDate(firstKey, Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * total));
    const grabbed = keyAt(e.clientX);
    const span = daysBetween(from, to);
    const move = (ev) => {
      const k = keyAt(ev.clientX);
      if (mode === "from") onChange({ from: clampKey(k, firstKey, shiftDate(to, -1)), to });
      else if (mode === "to") onChange({ from, to: clampKey(k, shiftDate(from, 1), lastKey) });
      else {
        const shift = daysBetween(grabbed, k);
        const nextFrom = clampKey(shiftDate(from, shift), firstKey, shiftDate(lastKey, -span));
        onChange({ from: nextFrom, to: shiftDate(nextFrom, span) });
      }
    };
    const end = () => {
      setDragging(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  /* A click on bare track re-centres the window rather than resizing it:
   * the length you picked is a choice, and a click should not undo it. */
  const jump = (e) => {
    if (dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const span = daysBetween(from, to);
    const centre = shiftDate(firstKey, Math.round(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * total));
    const nextFrom = clampKey(shiftDate(centre, -Math.round(span / 2)), firstKey, shiftDate(lastKey, -span));
    onChange({ from: nextFrom, to: shiftDate(nextFrom, span) });
  };

  const preset = (days) => {
    if (!days) return onChange({ from: firstKey, to: lastKey });
    onChange({ from: clampKey(shiftDate(lastKey, -(days - 1)), firstKey, lastKey), to: lastKey });
  };

  const span = daysBetween(from, to) + 1;
  const activePreset = PRESETS.find((p) => (p.value ? p.value === span : from === firstKey && to === lastKey));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        {/* The range lives here, not in the subtitle: the subtitle says what
          * the page is about, the scrubber says when. */}
        <p className="text-xs font-semibold text-ink uppercase tracking-wide tnum">
          {formatDay(from)} &ndash; {formatDay(to)}
          <span className="ml-2 font-normal normal-case tracking-normal text-ink-4">
            {span} day{span === 1 ? "" : "s"}
          </span>
        </p>
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => preset(p.value)}
              aria-pressed={activePreset?.label === p.label}
              className={cx(
                "h-7 px-2.5 rounded-md text-xs font-medium transition-colors duration-100",
                activePreset?.label === p.label ? "bg-hover text-ink" : "text-ink-2 hover:bg-faint hover:text-ink"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div
        data-scrub-track=""
        onPointerDown={jump}
        className={cx("relative h-8 select-none", dragging ? "cursor-grabbing" : "cursor-pointer")}
      >
        {/* The whole record at week resolution, drawn by HOW MUCH CLOSED,
          * not by yield. A scrubber is a map you navigate — you drag to
          * where the work is — and yield here would be a second, smaller
          * copy of the chart above saying the same thing worse. */}
        <div className="absolute inset-0 flex items-end gap-px" aria-hidden="true">
          {weeks.map((w) => (
            <span
              key={w.key}
              className={cx("flex-1 min-w-px rounded-[1px]", w.batches ? "bg-line-strong" : "bg-line-soft")}
              style={{ height: w.batches ? `${Math.max(10, Math.min(100, (w.batches / busiest) * 100))}%` : 2 }}
            />
          ))}
        </div>

        {/* The window. Drag the middle to move it, the edges to resize. */}
        <div
          aria-label={`Selected period, ${formatDay(from)} to ${formatDay(to)}`}
          onPointerDown={begin("pan")}
          className="absolute inset-y-0 rounded-sm border border-ink-3 bg-ink/[0.06] cursor-grab active:cursor-grabbing"
          style={{ left: `${left}%`, width: `${Math.max(1.5, right - left)}%` }}
        >
          <span
            onPointerDown={begin("from")}
            className="absolute -left-1 inset-y-0 w-2 cursor-ew-resize"
            aria-hidden="true"
          />
          <span
            onPointerDown={begin("to")}
            className="absolute -right-1 inset-y-0 w-2 cursor-ew-resize"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex items-baseline justify-between mt-1 text-[10px] text-ink-4 tnum">
        <span>{formatDay(firstKey)}</span>
        <span>Drag the window, or an edge to resize</span>
        <span>{formatDay(lastKey)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Chart -- */

const BAR_H = 64;

/**
 * The one chart. It was two — a five-week day strip and a thirteen-month
 * yield/minutes chart — which drew the same mark twice at two frozen scales.
 * Now the scrubber sets the window and the granularity follows, so this is
 * the same chart whether you are looking at a fortnight or five years.
 *
 * One series at a time: yield, or average minutes at a station. Colour only
 * marks what crossed the line — a bucket under LOW_YIELD_PCT, or over the
 * station's target — and the threshold itself is drawn, so "over" is
 * something you see rather than infer. The axis is anchored to that
 * threshold and never hugged to the data: a floor pinned to the minimum
 * stretches a three-point spread across the full height and makes a flat
 * year look volatile.
 */
function RunChart({ buckets, grain, stations, targets, selected, onPick, quietSince }) {
  const [which, setWhich] = useState("yield");
  const series = [{ value: "yield", label: "Yield" }, ...stations.map((s) => ({ value: s, label: s }))];
  const isYield = which === "yield" || !stations.includes(which);
  const station = isYield ? null : which;
  const line = isYield ? LOW_YIELD_PCT : targets[station] ?? STAGE_TARGET_MINUTES[station];

  const points = buckets.map((b) => {
    const v = isYield ? b.avgYield : b.minutes?.[station] ?? null;
    return {
      ...b,
      v,
      /* Same rule as everywhere else: a single day or a single batch is
       * amber when it itself failed; a WEEK or a MONTH almost always holds
       * one flagged batch, so it is amber only when its own average crossed
       * the line. Applying the narrow rule wide paints everything amber. */
      over: v != null && (isYield ? v < LOW_YIELD_PCT : isOverTarget(station, v, targets)),
    };
  });

  const values = points.map((p) => p.v).filter((v) => v != null);
  const lo = values.length ? (isYield ? Math.min(line, ...values) - 2 : Math.min(line, ...values) * 0.92) : line - 2;
  const hi = values.length ? (isYield ? Math.max(line, ...values) + 2 : Math.max(line, ...values) * 1.04) : line + 2;
  const scale = (v) => Math.max(0.04, Math.min(1, (v - lo) / (hi - lo)));
  const labelled = points.length <= VALUE_LABEL_MAX;
  const clickable = grain !== "day" || !!onPick;

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3">
          <Segmented size="sm" value={which} onChange={setWhich} options={series} />
        </div>
      )}

      <div className="relative" style={{ height: BAR_H }}>
        <div
          className="absolute left-0 right-0 z-10 border-t border-dashed border-line-strong pointer-events-none"
          style={{ bottom: `${Math.round(scale(line) * 100)}%` }}
          aria-hidden="true"
        />
        <div
          className="flex items-end gap-1 h-full"
          role="img"
          aria-label={`${isYield ? "Yield" : `${station} minutes`} per ${GRAIN_NOUN[grain]}: ${points
            .map((p) => `${p.key} ${p.v ?? "none"}`)
            .join(", ")}`}
        >
          {points.map((p) => {
            const isSel = selected === p.key;
            const label = `${formatDay(p.from)}${p.from !== p.to ? ` – ${formatDay(p.to)}` : ""}${
              p.v == null ? ", nothing closed" : `, ${p.v}${isYield ? "%" : " min"} over ${p.batches} batch${p.batches === 1 ? "" : "es"}`
            }`;
            return (
              <button
                key={p.key}
                type="button"
                title={label}
                aria-label={label}
                disabled={p.v == null || !clickable}
                onClick={() => onPick?.(p)}
                className="group relative flex-1 min-w-0 flex items-end justify-center h-full"
              >
                <span
                  className={cx(
                    "w-full rounded-[2px] transition-colors",
                    p.v == null && "bg-line-soft",
                    p.v != null && (p.over ? "bg-warn/70" : isYield ? "bg-ok/60" : "bg-ink-3"),
                    p.v != null && clickable && "group-hover:bg-ink-3",
                    isSel && "!bg-ink"
                  )}
                  style={{ height: p.v == null ? 2 : `${Math.round(scale(p.v) * 100)}%` }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-1 mt-1.5">
        {points.map((p, i) => (
          <div key={p.key} className="flex-1 min-w-0 text-center leading-tight">
            {labelled && (
              <p className={cx("text-[11px] tnum truncate", p.v == null ? "text-ink-4" : p.over ? "text-warn font-medium" : "text-ink-2")}>
                {p.v == null ? "–" : isYield ? `${p.v}%` : Math.round(p.v)}
              </p>
            )}
            {/* The stamp may be wider than one bar column — an axis label
              * belongs to a POSITION, not to a bar, so it is allowed to
              * spill either side rather than truncate to "N…". */}
            <p className="relative text-[10px] text-ink-4 tnum whitespace-nowrap overflow-visible">
              {stampFor(p, i, grain, points)}
            </p>
          </div>
        ))}
      </div>

      <p className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 text-xs text-ink-4">
        <span>
          One bar per {GRAIN_NOUN[grain]}, {isYield ? "taller" : "shorter"} is better; the dashed line is{" "}
          {isYield ? `${LOW_YIELD_PCT}%` : `the ${line}-minute target`}.
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-[2px] bg-warn/70" /> over the line
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-[2px] bg-line-soft" /> nothing closed
        </span>
        {quietSince && <span className="text-ink-2">Nothing has closed since {formatDay(quietSince)}.</span>}
      </p>
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

/** Rows the batch list shows before it asks; the rest sit behind "Show all". */
const RECENT_ROWS = 8;

/**
 * Every batch in the current filter, newest first — the numbers behind the
 * charts. `cap` null shows the lot (it lives in a scrolling modal now, so
 * there is nothing to protect the page from).
 */
function BatchTable({ rows, multi, targets = {}, cap = RECENT_ROWS }) {
  const [showAll, setShowAll] = useState(false);
  if (!rows.length) return <p className="text-xs text-ink-4">No closed batches.</p>;
  const newestFirst = [...rows].reverse();
  const shown = cap == null || showAll ? newestFirst : newestFirst.slice(0, cap);
  return (
    <div>
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-surface">
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
                {/* Amber marks the column that actually failed. A batch can
                  * be flagged for slow time at 88% yield, and colouring the
                  * yield for it points at the wrong number. */}
                <td className={cx("py-1.5 pr-3 text-right tnum font-medium", r.y < LOW_YIELD_PCT ? "text-warn" : "text-ink")}>{r.y}%</td>
                <td className="py-1.5 pr-3 text-right tnum text-ink-3">
                  {r.boxWeight} &rarr; {r.finalWeight} lb
                </td>
                <td className="py-1.5 text-right tnum text-ink-3">
                  {stations.length
                    ? stations.map(([st, m], i) => (
                        <span key={st}>
                          {i > 0 && " · "}
                          <span className={cx(isOverTarget(st, m, targets) && "text-warn font-medium")}>
                            {st} {m}
                          </span>
                        </span>
                      ))
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {cap != null && newestFirst.length > cap && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs text-ink-3 hover:text-ink">
          {showAll ? "Show fewer" : `Show all ${newestFirst.length}`}
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------- Shared pieces -- */

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

/* ------------------------------------------------------- Ask by selection -- */

/** Shorter than this is a stray double-click, not a question. */
const MIN_SELECTION = 3;
/** Panel width, and the gap it keeps from the selection and the viewport. */
const ASK_W = 320;
const ASK_GAP = 6;

/**
 * Highlight anything on the dashboard and ask about exactly that.
 *
 * Two steps on purpose. A panel that opens on every highlight fights the
 * user — you cannot select a number to copy it, or drag through a sentence
 * to re-read it, without a dialog landing on the page. So a selection only
 * ever raises a small chip; the panel opens when the chip is clicked, and
 * nothing at all happens if it is ignored. The chip is also the whole of the
 * feature's discoverability, which is why it carries a word and not just an
 * icon.
 *
 * What the selection is *about* comes from the nearest `data-ask` ancestor,
 * so a highlight inside the strip's day detail asks about that day and one
 * inside the product detail asks about that product. Both the chip and the
 * panel portal to the body: they are positioned in viewport coordinates and
 * would otherwise be clipped by the console's scroller.
 */
function SelectionAsk({ cardFor }) {
  const [sel, setSel] = useState(null);
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState([]);
  const [question, setQuestion] = useState("");
  const hostRef = useRef(null);

  const dismiss = useCallback(() => {
    setSel(null);
    setOpen(false);
    setThread([]);
    setQuestion("");
  }, []);

  useEffect(() => {
    /* Read the selection on the tick AFTER the gesture: mouseup fires before
     * the browser has collapsed or extended the range. */
    const read = () => {
      window.setTimeout(() => {
        if (hostRef.current?.contains(document.activeElement)) return;
        const s = window.getSelection();
        if (!s || s.isCollapsed || s.rangeCount === 0) return dismiss();
        const text = s.toString().trim();
        /* Punctuation and lone units are not questions. */
        if (text.length < MIN_SELECTION || !/[a-z0-9]/i.test(text)) return dismiss();
        const node = s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentElement;
        if (!node?.closest?.("[data-ask-root]")) return dismiss();
        const rect = s.getRangeAt(0).getBoundingClientRect();
        if (!rect.width && !rect.height) return dismiss();
        setOpen(false);
        setThread([]);
        setQuestion("");
        setSel({ text, rect, ask: node.closest("[data-ask]")?.dataset.ask || null });
      }, 0);
    };
    const onDown = (e) => {
      if (hostRef.current?.contains(e.target)) return;
      dismiss();
    };
    const onKey = (e) => e.key === "Escape" && dismiss();
    document.addEventListener("mouseup", read);
    document.addEventListener("keyup", read);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mouseup", read);
      document.removeEventListener("keyup", read);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [dismiss]);

  if (!sel || typeof document === "undefined") return null;

  const card = cardFor(sel.ask);
  if (!card) return null;

  const quick = QUICK_QUESTIONS[card.context?.type] || [];

  const ask = (raw) => {
    const q = (raw ?? question).trim();
    if (!q) return;
    setThread((t) => (t.length && t[t.length - 1].q === q ? t : [...t, { q, a: answerInsightQuestion(card, q) }]));
    setQuestion("");
  };

  /* The chip hangs off the END of the selection, where the cursor just
   * let go; the panel lines up with its START, so it reads as belonging to
   * the highlighted phrase rather than floating left of it. Flipped above
   * when there is no room below, and never off either edge. */
  const width = open ? ASK_W : 96;
  const anchor = open ? sel.rect.left : sel.rect.right - width;
  const left = Math.min(Math.max(anchor, 12), window.innerWidth - width - 12);
  const flip = sel.rect.bottom + (open ? 200 : 40) > window.innerHeight;
  const place = flip
    ? { bottom: window.innerHeight - sel.rect.top + ASK_GAP }
    : { top: sel.rect.bottom + ASK_GAP };

  return createPortal(
    <div ref={hostRef} className="fixed z-50" style={{ left, ...place }}>
      {open ? (
        <div
          role="dialog"
          aria-label={`Ask about "${sel.text}"`}
          className="rounded-lg border border-line-strong bg-surface shadow-lg p-3"
          style={{ width: ASK_W }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-ink-3 leading-snug min-w-0">
              Ask about{" "}
              <span className="text-ink font-medium">
                &ldquo;{sel.text.length > 44 ? `${sel.text.slice(0, 44)}…` : sel.text}&rdquo;
              </span>
              {/* Only when the highlight isn't already the subject's own name —
                * "Ask about 'Applewood Bacon' in Applewood Bacon" says it twice. */}
              {!card.title.toLowerCase().includes(sel.text.toLowerCase()) && (
                <span className="block mt-0.5 text-ink-4 truncate">in {card.title}</span>
              )}
            </p>
            <button type="button" onClick={dismiss} aria-label="Close" className="shrink-0 text-ink-4 hover:text-ink">
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
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
          </div>

          {thread.length > 0 && (
            <div className="mt-2.5 space-y-2 max-h-52 overflow-y-auto" role="log" aria-live="polite" aria-label="Answers">
              {thread.map((t, i) => (
                <div key={i} className="text-xs rounded-md bg-sunken px-2.5 py-2">
                  <p className="font-medium text-ink-2">&ldquo;{t.q}&rdquo;</p>
                  <p className="mt-0.5 text-ink-3 leading-relaxed">{t.a}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-1.5">
            <Input
              autoFocus
              value={question}
              placeholder="Ask about this…"
              aria-label={`Ask about "${sel.text}"`}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              className="flex-1"
            />
            <Button size="sm" icon={Send} onClick={() => ask()} aria-label="Send question">
              Ask
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Ask about "${sel.text}"`}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-line-strong bg-surface shadow-sm text-xs font-medium text-ink-2 hover:text-ink hover:border-ink-3 transition-colors"
        >
          <Sparkles size={12} className="text-ink-4" />
          Ask
        </button>
      )}
    </div>,
    document.body
  );
}
