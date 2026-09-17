"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowUpDown, ChartNoAxesColumn, CheckCircle2, Filter, Rows3, Sparkles } from "lucide-react";

import { Dropdown, EmptyState, ScreenToolbar, SearchInput, Segmented, Tooltip, cx } from "../../components/ui";
import { formatDay, isOverTarget, LOW_YIELD_PCT, shiftDate, STAGE_TARGET_MINUTES, todayKey, yieldPct } from "../../lib/domain";
import { isFlaggedBatch, productStats, windowStats } from "../lib/insights";
import { useAssistant, useAssistantSource } from "../components/Assistant";

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
  /**
   * Which of the two readings of this window is on screen.
   *
   * The batch list used to be an `xl` Modal behind a toolbar icon. Two things
   * killed that: a dialog capped at 88dvh showing a list people scroll, and —
   * the real one — a modal is a detour. You could not change the window or
   * the product filter without closing it, and the assistant was behind the
   * backdrop, so the one place you most want to ask "why is this row amber"
   * was the one place you could not ask.
   *
   * As a tab it shares the scrubber, the filter, the ticker and the panel
   * with the chart, because it is the same period seen a different way.
   */
  const [view, setView] = useState("chart");
  /* Which locations the page is about. Empty means every one this person can
   * see — the history already arrives scoped to that, so this narrows within
   * their own view rather than granting anything. */
  const [locationFilter, setLocationFilter] = useState([]);
  /* The Batches tab's own narrowing. Separate from the page's filters on
   * purpose: these say which of THESE batches to look at, not which batches
   * the page is about, and they reset nothing when you leave the tab. */
  const [batchView, setBatchView] = useState("all");
  const [batchQuery, setBatchQuery] = useState("");
  const [batchSort, setBatchSort] = useState({ key: "closedOn", dir: "desc" });
  const sortBatches = (key) =>
    setBatchSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : /* A new column opens the way you would want to read it: dates and
           * minutes newest/worst first, a name alphabetically. */
          { key, dir: key === "product" ? "asc" : key === "y" ? "asc" : "desc" }
    );

  /* The chart's series lives here rather than inside the chart, because the
   * Ask panel can set it: "show me smokehouse times" has to be able to move
   * the same control the segmented buttons move. */
  const [series, setSeries] = useState("yield");

  const locationOptions = useMemo(
    () => (insights.byLocation || []).map((l) => ({ value: l.locationId, label: l.name })),
    [insights.byLocation]
  );
  const changeLocations = (next) => {
    setLocationFilter(next);
    setSelectedDay(null);
  };
  /* What the page is about, in the page's own words. The prop is the widest
   * truth (everything this person can see); a narrowing overrides it. */
  const scopeText =
    locationFilter.length === 1
      ? locationOptions.find((o) => o.value === locationFilter[0])?.label || scopeLabel
      : locationFilter.length
        ? `${locationFilter.length} locations`
        : scopeLabel;

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
    return { from: shiftDate(to, -(DEFAULT_SPAN - 1)), to };
  });
  /* A range that predates the record, or a record that has grown past it,
   * is a range nobody chose. Clamp rather than silently draw empty space. */
  const from = clampKey(range.from, firstKey, lastKey);
  const to = clampKey(range.to, from, lastKey);
  const spanDays = daysBetween(from, to) + 1;
  const grain = grainFor(spanDays);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!productFilter.length || productFilter.includes(r.product)) &&
          (!locationFilter.length || locationFilter.includes(r.locationId))
      ),
    [rows, productFilter, locationFilter]
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
  /* The chart's series list lives here rather than in the chart, because the
   * control that sets it is in the screen toolbar now. */
  const seriesLabel = stations.includes(series) ? `${series} minutes` : "Yield";
  const seriesOptions = useMemo(
    () => [{ value: "yield", label: "Yield" }, ...stations.map((st) => ({ value: st, label: st }))],
    [stations]
  );

  /* ---- The standing numbers, and the card everything asks questions of:
   * the selected products over the selected range, nothing else. */
  const windowRows = useMemo(() => inWindow(filtered, from, to), [filtered, from, to]);
  const runCard = useMemo(
    () => makeRunCard({ rows: windowRows, products: productFilter, companyAvg, scopeLabel: scopeText, from, to }),
    [windowRows, productFilter, companyAvg, scopeText, from, to]
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

  const filterLabel =
    productFilter.length === 1 ? productFilter[0] : productFilter.length ? `${productFilter.length} products` : null;

  /* ---- The period card. It carries the two rollups the page deliberately
   * does NOT print — the product ranking and the station timings — which is
   * what makes asking worth doing rather than a second way to read the
   * chart. Scoped to the window and the filter, so it changes as you scrub. */
  const periodCard = useMemo(() => {
    const stats = windowStats(windowRows);
    const byStation = stations.map((station) => {
      const runs = windowRows.filter((r) => r.minutes?.[station] != null);
      const overRuns = runs.filter((r) => isOverTarget(station, r.minutes[station], targets));
      return {
        station,
        target: targets[station] ?? STAGE_TARGET_MINUTES[station],
        runs: runs.length,
        overCount: overRuns.length,
        overPct: runs.length ? overRuns.length / runs.length : 0,
        avgMinutes: runs.length ? Math.round(runs.reduce((a, r) => a + r.minutes[station], 0) / runs.length) : null,
      };
    });
    return {
      id: `period-${from}-${to}-${productFilter.join("|")}`,
      tone: "neutral",
      title: "This period",
      detail: `${stats.batches} batches closed.`,
      context: {
        type: "period",
        from,
        to,
        spanLabel: formatSpan(from, to),
        /* The page withholds the year-ago comparison past a year because the
         * window overlaps itself; the block must not answer what the page
         * refuses to show. */
        overlaps,
        scopeLabel: [scopeText, filterLabel].filter(Boolean).join(" · "),
        stats,
        byProduct: productStats(windowRows, targets),
        byStation,
        yearAgo,
        rows: windowRows,
      },
    };
  }, [windowRows, stations, targets, from, to, productFilter, scopeText, filterLabel, yearAgo, overlaps]);

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

  /**
   * Chat drives the page.
   *
   * "Bring the flagged products up on screen" used to be answered with a
   * sentence about them while the page carried on showing everything — the
   * panel could describe the window but not move it, which is the difference
   * between a chatbot bolted to a dashboard and a dashboard you can talk to.
   *
   * `planPageCommand` decides WHAT (deterministically, in insights.js, for
   * the same reason the numbers are template-generated: a wrong filter is a
   * silently wrong figure on every number on screen). This decides how to
   * apply it, and nothing else in the screen knows a command happened —
   * every command lands on the same setters the controls use, so the
   * scrubber, the dropdown and the segmented buttons all show the result.
   */
  const runCommand = (plan) => {
    if (plan.kind === "filter") return changeFilter(plan.products);
    if (plan.kind === "series") return setSeries(plan.value);
    if (plan.kind === "list") return setView("batches");
    if (plan.kind === "range") {
      setSelectedDay(null);
      return setRange(
        plan.days
          ? { from: clampKey(shiftDate(lastKey, -(plan.days - 1)), firstKey, lastKey), to: lastKey }
          : { from: firstKey, to: lastKey }
      );
    }
    if (plan.kind === "scale") {
      /* Zoom holds the middle still. Anchoring to either end would walk the
       * window across the record every time you widened it. */
      const next = Math.max(2, Math.min(daysBetween(firstKey, lastKey) + 1, Math.round(spanDays * plan.factor)));
      const centre = shiftDate(from, Math.round((spanDays - 1) / 2));
      const end = clampKey(shiftDate(centre, Math.floor((next - 1) / 2)), firstKey, lastKey);
      setSelectedDay(null);
      return setRange({ from: clampKey(shiftDate(end, -(next - 1)), firstKey, end), to: end });
    }
    /* kind "none": the planner understood the instruction and is declining
     * it — nothing to apply, the sentence is the whole response. */
  };

  const productOptions = useMemo(
    () => (insights.byProduct || []).map((p) => ({ value: p.product, label: `${p.product} · ${p.avgYield}%` })),
    [insights.byProduct]
  );

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
    if (kind === "period") return periodCard;
    if (kind === "day") return makeDayCard(selectedCell?.key === value ? selectedCell : null, companyAvg);
    if (kind === "product")
      return makeRunCard({
        rows: inWindow(rows.filter((r) => r.product === value), from, to),
        products: [value],
        companyAvg,
        scopeLabel: scopeText,
        from,
        to,
      });
    /* Anything else highlighted is about what the page is about. */
    return runCard;
  };

  /* Memoized so the two derivations below do not re-run on every render: the
   * `?? []` would hand them a fresh array each time. */
  const batchRows = useMemo(() => runCard?.context.rows ?? [], [runCard]);
  const batchCounts = useMemo(
    () => ({
      all: batchRows.length,
      flagged: batchRows.filter((r) => r.flagged).length,
      slow: batchRows.filter((r) => isSlow(r, targets)).length,
    }),
    [batchRows, targets]
  );
  const shownBatches = useMemo(() => {
    const q = batchQuery.trim().toLowerCase();
    return batchRows.filter((r) => {
      if (batchView === "flagged" && !r.flagged) return false;
      if (batchView === "slow" && !isSlow(r, targets)) return false;
      if (!q) return true;
      /* Product and location by name, and the date as it is printed — people
       * search a list for the words they can see in it. */
      return `${r.product} ${r.locationName || ""} ${formatDay(r.closedOn)}`.toLowerCase().includes(q);
    });
  }, [batchRows, batchView, batchQuery, targets]);

  const askKey = productFilter.length === 1 ? `product:${productFilter[0]}` : "run:";

  /* ---- The header's three pieces, built once and placed by HV below. */
  const ticker = runCard ? (
    <HeadlineTicker
      batches={runCard.context.rows.length}
      avg={runCard.context.avgY}
      flagged={runCard.context.flaggedCount}
      range={[runCard.context.stats.low, runCard.context.stats.high]}
      days={spanDays}
    />
  ) : null;

  /* One location is a fact, not a choice: it reads as plain text until there
   * is something to choose between. */
  const locationControl =
    locationOptions.length > 1 ? (
      <Dropdown
        quiet
        multiple
        value={locationFilter}
        onChange={changeLocations}
        options={locationOptions}
        placeholder={scopeLabel}
        summary={(n) => `${n} locations`}
        aria-label="Limit to locations"
      />
    ) : (
      <span className="text-ink-3">{scopeText}</span>
    );

  const productControl = (shape) =>
    isAdmin && productOptions.length > 1 ? (
      <Dropdown
        quiet={shape === "quiet"}
        multiple
        icon={shape === "quiet" ? undefined : Filter}
        value={productFilter}
        onChange={changeFilter}
        options={productOptions}
        placeholder="All products"
        menuClassName="!max-w-sm"
        summary={(n) => `${n} products`}
        aria-label="Filter by product"
      />
    ) : null;

  /* ---- What the assistant may read and do while this screen is on.
   *
   * `runCommand` closes over half the screen's state, so it is a new function
   * every render; published directly it would re-register the source on every
   * keystroke. A ref holds the live one and the published handle is stable,
   * which leaves the memo below depending only on things that genuinely
   * change what the assistant knows. */
  const commandRef = useRef(null);
  useEffect(() => {
    commandRef.current = runCommand;
  });
  const onCommand = useCallback((plan) => commandRef.current?.(plan), []);

  const products = useMemo(() => productOptions.map((o) => o.value), [productOptions]);
  /* No day count here, unlike the old Popover's header: the scrubber prints
   * it two inches to the left, and at panel width it was the part that got
   * truncated away. */
  const scopeLine = [scopeText, filterLabel, formatSpanTitle(from, to)].filter(Boolean).join(" · ");

  useAssistantSource(
    useMemo(
      () => ({ card: periodCard, scopeLine, products, stations, onCommand }),
      [periodCard, scopeLine, products, stations, onCommand]
    )
  );

  return (
    <div data-ask-root="">
      {/* Subtitle and ticker are the ONE place the standing numbers live,
        * and they follow BOTH the product filter and the range, so they
        * always describe what is actually on screen. */}
      {/* ---- The header splits on ONE question: does it change when you move
        * the window?
        *
        * The title row holds what does not — which shop, which products. That
        * is what the page is about, and it is true before you have picked a
        * single day. It reads as a sentence rather than a pair of controls,
        * because that is what it is.
        *
        * Everything that moves with the window is on the window row with the
        * range, where you can watch it change as you scrub. The standing
        * numbers used to sit up here beside the title, which made them look
        * like facts about the shop instead of facts about thirty days. */}
      {/* The window: its two controls, the track, and the range label that
        * rides under the selection. Ruled off at the bottom, because what
        * follows is a reading of this window rather than more of it. */}
      <div className="pb-3 border-b border-line">
        {/* Both of the window's axes on one line: WHICH measure, and HOW
          * LONG. The series used to live above the chart, which made it read
          * as a chart setting — but it decides what every bar and every amber
          * mark on the page means, tab included. */}
        <div className="flex items-center justify-between gap-x-3 gap-y-2 flex-wrap mb-2">
          {/* Scope on the left, the window's own axes on the right: one row
            * that reads WHAT · WHICH MEASURE · HOW LONG, left to right. */}
          <span className="flex items-center gap-1.5 text-xs text-ink-4">
            {locationControl}
            {productControl("quiet") && (
              <>
                <span>·</span>
                {productControl("quiet")}
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
          {seriesOptions.length > 1 && (
            <>
              <Segmented size="sm" value={series} onChange={setSeries} options={seriesOptions} />
              {/* Ruled apart, or eight chips in a row read as one control and
                * you cannot tell where the measure stops and the length
                * begins. */}
              <Rule />
            </>
          )}
          <PresetRow from={from} to={to} firstKey={firstKey} lastKey={lastKey} onChange={changeRange} />
          </div>
        </div>

        <TimeScrubber from={from} to={to} firstKey={firstKey} lastKey={lastKey} weeks={weeks} onChange={changeRange} />
      </div>

      {/* The screen toolbar sits BELOW the timeline, because the timeline is
        * scope and the tabs are a reading of it — you pick the days once and
        * then choose how to look at them. Tasks' shape either way: views
        * left, the screen's own control right. On the chart that control is
        * the series, which used to float above the chart as a second
        * Segmented directly under these tabs — two rails doing one job. */}
      <ScreenToolbar
        tabs={
          <Segmented
            value={view}
            onChange={setView}
            className="min-w-0"
            options={[
              { value: "chart", label: "Chart", icon: ChartNoAxesColumn, hint: `${seriesLabel} per ${GRAIN_NOUN[grain]}` },
              { value: "batches", label: "Batches", icon: Rows3, hint: "Every closed batch in the window, in time order" },
            ]}
          />
        }
        /* The standing numbers ride with the tabs, not inside the chart:
          * they are about the WINDOW, not about one of its two readings, so
          * they have to survive the tab switch — and floating in the plot
          * they collide with a tall bar at the right end. */
        actions={ticker}
        /* The second line is the narrowing WITHIN the selected tab — the
          * chart has none, so it only exists on Batches. */
        refine={
          view === "batches" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Segmented
                size="sm"
                value={batchView}
                onChange={setBatchView}
                options={BATCH_VIEWS.map((v) => ({
                  value: v.id,
                  label: v.label,
                  /* All is the resting state, not a queue with a number. */
                  count: v.id === "all" ? undefined : batchCounts[v.id],
                }))}
              />
              <SearchInput
                value={batchQuery}
                onChange={setBatchQuery}
                placeholder="Search batches…"
                className="w-52"
              />
            </div>
          ) : null
        }
        status={
          view === "batches" && shownBatches.length !== batchRows.length ? (
            <p className="text-xs text-ink-4 tnum">
              {shownBatches.length} of {batchRows.length}
            </p>
          ) : null
        }
      />

      {view === "batches" ? (
        /* The list, at page width rather than dialog width — four columns
          * and a hundred rows never fit in a capped-height modal. Everything
          * in it is about the period, so one `data-ask` covers the lot and a
          * highlight anywhere in the table asks about the window. */
        <div data-ask="period:">
          {runCard ? (
            <BatchTable
              rows={shownBatches}
              multi={multi}
              targets={targets}
              series={series}
              sort={batchSort}
              onSort={sortBatches}
            />
          ) : (
            <p className="py-10 text-center text-xs text-ink-4">Nothing closed in this window.</p>
          )}
        </div>
      ) : (
        <>
        <div>
          <RunChart
            buckets={buckets}
            grain={grain}
            stations={stations}
            targets={targets}
            selected={selectedDay}
            onPick={pickBucket}
            quietSince={quietSince}
            which={series}
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
        </>
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
function HeadlineTicker({ batches, avg, flagged, range, days }) {
  if (!batches) return null;
  const spread = range && range[0] !== range[1] ? `${range[0]}\u2013${range[1]}% across the window` : null;
  return (
    <div className="flex items-center gap-2.5 text-xs font-normal leading-none">
      {/* The length leads: everything after it is a number ABOUT that many
        * days, and the range under the track says which days they are. */}
      {days != null && (
        <>
          <span className="text-ink-4 tnum">
            {days} day{days === 1 ? "" : "s"}
          </span>
          <Rule />
        </>
      )}
      {/* The spread used to be a fourth item on this line. It is the one thing
        * an average hides — two products can share an average and run nothing
        * alike — but it is a second reading of the number beside it, not a
        * number of its own, so it rides as the average's tooltip instead of
        * widening the row by a third. */}
      <Tooltip label={spread || ""} disabled={!spread}>
        <span className="text-ink-4 tnum">{avg != null ? `${avg}% yield` : "No yield yet"}</span>
      </Tooltip>
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
/**
 * The ladder everyone already knows how to read, and the reason it is short
 * labels rather than "5 weeks": these are a scale, and a scale is scanned,
 * not read. The old set opened on 35 days — a leftover from the five-week
 * strip this chart replaced — which matched no button, so the page loaded
 * with nothing lit and the first click always moved the window.
 *
 * The rungs are chosen against `grainFor`, not by round numbers: 2w and 1m
 * land in day bars, 3m and 1y in week bars, All in months. Every press
 * changes the shape of the chart, which is the only reason to have a preset
 * rather than a scrubber.
 */
const PRESETS = [
  { value: 14, label: "2w", title: "Last two weeks" },
  { value: 30, label: "1m", title: "Last 30 days" },
  { value: 91, label: "3m", title: "Last three months" },
  { value: 365, label: "1y", title: "Last 12 months" },
  { value: 0, label: "All", title: "The whole record" },
];

/** The window the page opens on — a preset, so one is always lit. */
const DEFAULT_SPAN = 30;

/** The range a preset produces, clamped to what the record actually holds. */
const presetRange = (days, firstKey, lastKey) =>
  days
    ? { from: clampKey(shiftDate(lastKey, -(days - 1)), firstKey, lastKey), to: lastKey }
    : { from: firstKey, to: lastKey };

/**
 * Presets longer than the record are DROPPED, not shown dark: offering a year
 * of a nine-month shop is offering "All" under another name.
 *
 * And a preset is "on" when pressing it would not move anything, which is not
 * the same as its length matching — on a nine-month record "1y" clamps to the
 * whole record, and the old `span === value` test left every button dark the
 * moment you pressed one.
 */
function presetState(from, to, firstKey, lastKey) {
  const total = Math.max(1, daysBetween(firstKey, lastKey)) + 1;
  const available = PRESETS.filter((p) => !p.value || p.value <= total);
  const active = available.find((p) => {
    const r = presetRange(p.value, firstKey, lastKey);
    return from === r.from && to === r.to;
  });
  return { available, active };
}

/**
 * The preset row, shared by the scrubber and the batch-list modal. The modal
 * has no room for a drag track, but "these are the wrong thirty days" is the
 * first thing anyone thinks reading a list of batches, and making them close
 * the dialog to fix it is making them lose their place.
 */
function PresetRow({ from, to, firstKey, lastKey, onChange }) {
  const { available, active } = presetState(from, to, firstKey, lastKey);
  return (
    <div className="flex items-center gap-0.5">
      {available.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onChange(presetRange(p.value, firstKey, lastKey))}
          aria-pressed={active?.label === p.label}
          title={p.title}
          className={cx(
            "h-7 px-2 rounded-md text-xs font-medium tabular-nums transition-colors duration-100",
            active?.label === p.label ? "bg-hover text-ink" : "text-ink-3 hover:bg-faint hover:text-ink"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

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

/* `formatDay` drops the year, so a window that crosses New Year reads as
 * "between Sep 16 and Sep 15" — backwards and a day long. Years go in only
 * when they are what distinguishes the two ends. */
const formatSpan = (from, to) =>
  from.slice(0, 4) === to.slice(0, 4)
    ? `between ${formatDay(from)} and ${formatDay(to)}`
    : `between ${formatDay(from)} ${from.slice(0, 4)} and ${formatDay(to)} ${to.slice(0, 4)}`;

/* The same range as a title rather than a clause — for the scrubber's label
 * and the export's header. Carries the years for the same reason: without
 * them a one-year window reads "Sep 16 – Sep 15". */
const formatSpanTitle = (from, to) =>
  from.slice(0, 4) === to.slice(0, 4)
    ? `${formatDay(from)} \u2013 ${formatDay(to)}`
    : `${formatDay(from)} ${from.slice(0, 4)} \u2013 ${formatDay(to)} ${to.slice(0, 4)}`;

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
  const mid = (left + right) / 2;

  /**
   * The wheel PANS the window; it does not scroll a container.
   *
   * A scrolling track would have bought readable bars at the cost of the one
   * thing the track is for — seeing the whole record at once, and where in it
   * the work is. Wheeling the window along keeps the map whole and still lets
   * you walk five years a notch at a time.
   *
   * Registered natively with `passive: false`, because React's own wheel
   * listener is passive and `preventDefault` in an `onWheel` handler does
   * nothing — the page would scroll underneath the gesture.
   *
   * The step is a PERCENTAGE of the current span, so one notch feels the same
   * whether the window is two weeks or two years, and the remainder carries
   * across events so a slow trackpad swipe still moves at day resolution
   * instead of rounding to nothing every frame.
   */
  const trackRef = useRef(null);
  const live = useRef(null);
  useEffect(() => {
    live.current = { from, to, firstKey, lastKey, onChange };
  });
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    let carry = 0;
    const onWheel = (e) => {
      /* A trackpad sends a horizontal swipe as deltaX and a mouse wheel only
       * ever sends deltaY; whichever is larger is the one being made. */
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!raw) return;
      e.preventDefault();
      const { from: f, to: t, firstKey: lo, lastKey: hi, onChange: emit } = live.current;
      const span = daysBetween(f, t);
      carry += (raw / 100) * (e.deltaMode === 1 ? 16 : 1) * Math.max(1, span * 0.08);
      const step = Math.trunc(carry);
      if (!step) return;
      carry -= step;
      const nextFrom = clampKey(shiftDate(f, step), lo, shiftDate(hi, -span));
      if (nextFrom !== f) emit({ from: nextFrom, to: shiftDate(nextFrom, span) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /**
   * One gesture, one rect, one frame.
   *
   * The track rect is read ONCE at pointerdown — a drag cannot resize the
   * thing it is being measured against, and reading a ref during render is a
   * bug the linter is right about. The working range is captured at the same
   * moment and every position is computed against THAT, not against the
   * props, so a resize cannot drift by accumulating its own output.
   *
   * Moves are coalesced into one `requestAnimationFrame` update and dropped
   * when the day under the pointer has not changed, so dragging across five
   * years re-renders the chart sixty times a second at most instead of once
   * per pointer event — which is the whole difference between this feeling
   * like a scrubber and feeling like a form control.
   *
   * `stopPropagation` is load-bearing: the edges sit inside the window,
   * which sits inside the track, and all three want the pointer. Without it
   * grabbing an edge also started a pan AND fired the track's re-centre, so
   * the window jumped out from under the cursor and two handlers then fought
   * over it. That is what "the edge resize doesn't work" was.
   */
  const startDrag = (mode, e, seed) => {
    const rect = e.currentTarget.closest("[data-scrub-track]")?.getBoundingClientRect();
    if (!rect || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(mode);

    const keyAt = (clientX) =>
      shiftDate(firstKey, Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * total));

    const base = seed ?? { from, to };
    const span = daysBetween(base.from, base.to);
    const origin = keyAt(e.clientX);

    let current = { from, to };
    const emit = (next) => {
      if (next.from === current.from && next.to === current.to) return;
      current = next;
      onChange(next);
    };
    if (seed) emit(seed);

    let frame = 0;
    let pending = null;
    const apply = () => {
      frame = 0;
      const k = pending;
      if (mode === "from") emit({ from: clampKey(k, firstKey, shiftDate(base.to, -1)), to: base.to });
      else if (mode === "to") emit({ from: base.from, to: clampKey(k, shiftDate(base.from, 1), lastKey) });
      else {
        const nextFrom = clampKey(shiftDate(base.from, daysBetween(origin, k)), firstKey, shiftDate(lastKey, -span));
        emit({ from: nextFrom, to: shiftDate(nextFrom, span) });
      }
    };

    const move = (ev) => {
      pending = keyAt(ev.clientX);
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const end = () => {
      if (frame) cancelAnimationFrame(frame);
      setDragging(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  /* A press on bare track re-centres the window and then keeps dragging from
   * there, so a click and a drag are the same gesture rather than two. The
   * length you picked survives it: a click should move the window, not
   * redefine it. */
  const jump = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const span = daysBetween(from, to);
    const centre = shiftDate(firstKey, Math.round(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * total));
    const nextFrom = clampKey(shiftDate(centre, -Math.round(span / 2)), firstKey, shiftDate(lastKey, -span));
    startDrag("pan", e, { from: nextFrom, to: shiftDate(nextFrom, span) });
  };

  /* Arrows move the window a day at a time, Shift moves it a week, and Alt
   * drags the right edge instead of the whole thing — the keyboard reading
   * of the same three gestures. A scrubber you can only use with a mouse is
   * a scrubber half the shop cannot use. */
  const onKeyDown = (e) => {
    const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    const span = daysBetween(from, to);
    if (dir) {
      e.preventDefault();
      const step = dir * (e.shiftKey ? 7 : 1);
      if (e.altKey) return onChange({ from, to: clampKey(shiftDate(to, step), shiftDate(from, 1), lastKey) });
      const nextFrom = clampKey(shiftDate(from, step), firstKey, shiftDate(lastKey, -span));
      return onChange({ from: nextFrom, to: shiftDate(nextFrom, span) });
    }
    if (e.key === "Home") {
      e.preventDefault();
      return onChange({ from: firstKey, to: shiftDate(firstKey, span) });
    }
    if (e.key === "End") {
      e.preventDefault();
      return onChange({ from: shiftDate(lastKey, -span), to: lastKey });
    }
  };


  return (
    <div>
      {/* No header row of its own any more: the range label and the presets
        * moved into the screen toolbar, where every other screen keeps that
        * kind of thing. What is left here is the map and its two ends. */}
      {/* The instructions used to be printed under the track, between the two
        * end dates — a permanent line of help text for a control most people
        * work out in one drag. It is a tooltip now, and the row below is just
        * the record's two ends.
        *
        * The Tooltip wraps the TRACK, not the window: its own span is
        * `relative`, so wrapping the window would re-parent every absolute
        * position in here to the tooltip and tear the scrubber apart. */}
      <Tooltip label="Drag to move · edges resize · scroll to pan" side="top" className="w-full">
      <div
        ref={trackRef}
        data-scrub-track=""
        onPointerDown={jump}
        className={cx(
          "relative w-full h-8 select-none touch-none",
          dragging === "from" || dragging === "to" ? "cursor-ew-resize" : dragging ? "cursor-grabbing" : "cursor-pointer"
        )}
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

        {/* Curtains, not a highlight. Washing the SELECTION was backwards —
          * it dimmed the weeks you had chosen and left the rest bright, so
          * the window read as the part being ignored. Dimming everything
          * outside it makes the selection the clear part, which is what a
          * scrubber is for. */}
        <div className="absolute inset-y-0 left-0 bg-surface/75" style={{ width: `${left}%` }} aria-hidden="true" />
        <div className="absolute inset-y-0 right-0 bg-surface/75" style={{ left: `${right}%` }} aria-hidden="true" />

        {/* The window. Drag the middle to move it, an edge to resize it.
          * `minWidth` keeps the two edges from collapsing into each other at
          * a one-day window, where there would otherwise be nothing left to
          * grab. */}
        <div
          tabIndex={0}
          role="group"
          aria-label={`Selected period, ${formatDay(from)} to ${formatDay(to)}. Arrow keys move it, Alt with an arrow resizes it.`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => startDrag("pan", e)}
          className={cx(
            "group absolute inset-y-0 rounded-sm border border-ink-3",
            "outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            dragging === "pan" ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{ left: `${left}%`, width: `${right - left}%`, minWidth: 16 }}
        >
          {/* Visible grips, not just hot zones. The old edges were two
            * invisible 8px strips: nothing said the window could be resized,
            * and finding them was a hunt. */}
          {[
            { mode: "from", side: "-left-1.5" },
            { mode: "to", side: "-right-1.5" },
          ].map((h) => (
            <span
              key={h.mode}
              onPointerDown={(e) => startDrag(h.mode, e)}
              className={cx("absolute inset-y-0 z-10 w-3 flex items-center justify-center cursor-ew-resize", h.side)}
            >
              <span
                className={cx(
                  "w-[3px] h-3.5 rounded-full transition-colors duration-100",
                  dragging === h.mode ? "bg-ink" : "bg-ink-3 group-hover:bg-ink-2"
                )}
              />
            </span>
          ))}
        </div>
      </div>
      </Tooltip>

      {/* The range rides UNDER the selection rather than sitting in a header,
        * so the label and the thing it labels are the same object — drag the
        * window and the words go with it.
        *
        * The record's two end dates used to book-end this row. They were the
        * one part of the scrubber nobody ever read: the track already shows
        * how much history there is, and the ends of it are not a fact anyone
        * needs in words.
        *
        * The transform flips at the extremes instead of always centring, or
        * a window parked at either end pushes its own label off the track. */}
      <div className="relative h-4 mt-1">
        <p
          className="absolute top-0 whitespace-nowrap text-[10px] leading-none tnum text-ink-3"
          style={{
            left: `${mid}%`,
            transform: `translateX(${mid < 12 ? "0" : mid > 88 ? "-100%" : "-50%"})`,
          }}
        >
          <span className="font-semibold uppercase tracking-wide text-ink">{formatSpanTitle(from, to)}</span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Chart -- */

const BAR_H = 64;

/**
 * Bars and the threshold line EASE to their new positions instead of
 * snapping.
 *
 * Scrubbing re-derives the whole chart on every frame, and at full speed a
 * five-year drag was a strobe: you could see that something was changing but
 * not what. A short ease means each update is chased rather than jumped to —
 * during a drag the transitions continuously retarget, so the bars flow, and
 * for a discrete change (a preset, a command from the Ask panel) the page
 * visibly moves FROM the old reading TO the new one, which is the thing that
 * makes the change comprehensible rather than merely fast.
 *
 * Bars are keyed by bucket key, so panning keeps the nodes that persist and
 * only the ones entering at the edges fade in. A granularity flip changes
 * every key at once, so the whole row fades — correct, because that is a
 * different chart, not a moved one.
 *
 * `height` is not compositor-friendly, but there are at most a few dozen
 * bars and `transform: scaleY` would distort their rounded caps.
 */
const CHART_EASE = "transition-[height,bottom,background-color] duration-[260ms] ease-out";

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
function RunChart({ buckets, grain, stations, targets, selected, onPick, quietSince, which }) {
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
      <div className="relative" style={{ height: BAR_H }}>
        {/* The threshold line moves whenever the window's spread changes, so
          * it eases like the bars do — a line that jumps while the bars slide
          * reads as two different charts. */}
        <div
          className={cx(
            "absolute left-0 right-0 z-10 border-t border-dashed border-line-strong pointer-events-none",
            CHART_EASE
          )}
          style={{ bottom: `${Math.round(scale(line) * 100)}%` }}
          aria-hidden="true"
        >
          {/* The line says what it is, on itself. It was explained in a
            * sentence under the chart, which means the mark and its meaning
            * were never in the same glance — and after a series change the
            * sentence is the only thing that moved. */}
          <span className="absolute right-0 -translate-y-1/2 pl-1.5 bg-surface text-[10px] leading-none tnum text-ink-4">
            {isYield ? `${line}%` : `${line} min`}
          </span>
        </div>
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
                    "w-full rounded-[2px] animate-fade-in",
                    CHART_EASE,
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
          One bar per {GRAIN_NOUN[grain]}, {isYield ? "taller" : "shorter"} is better.
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed border-line-strong" /> {isYield ? "the 75% line" : "target"}
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
/**
 * Every closed batch in the window, in time order — the Batches tab's whole
 * body.
 *
 * It was a preview of eight rows inside a modal, so it needed none of this.
 * As a tab it is a list screen, and the console has one grammar for those:
 * counted views and a search on the toolbar's second line, sortable columns
 * underneath. The narrowing lives in the toolbar rather than in here, because
 * it narrows what the tab is showing — which is exactly what that line is for
 * on Tasks and Permissions.
 */
const BATCH_VIEWS = [
  { id: "all", label: "All" },
  { id: "flagged", label: "Flagged" },
  { id: "slow", label: "Over target" },
];

/** A batch is "slow" when any station on it ran past its target. */
const isSlow = (r, targets) => Object.entries(r.minutes || {}).some(([st, m]) => isOverTarget(st, m, targets));

/**
 * Sorting keys. `minutes` follows the SERIES: with Smokehouse selected,
 * sorting by minutes sorts by Smokehouse, because that is the number the rest
 * of the page is already about. With Yield selected it falls back to the
 * total, which is the only reading left when no station is named.
 */
const sortValue = (r, key, series) => {
  if (key === "closedOn") return r.closedOn;
  if (key === "product") return (r.product || "").toLowerCase();
  if (key === "y") return r.y ?? -1;
  const mins = r.minutes || {};
  return series in mins ? mins[series] : Object.values(mins).reduce((a, m) => a + m, 0);
};

function SortHeader({ label, k, sort, onSort, align = "left" }) {
  const on = sort.key === k;
  return (
    <th
      aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cx("font-medium pb-1.5 pr-3", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cx(
          "inline-flex items-center gap-1 transition-colors hover:text-ink",
          on ? "text-ink" : "text-ink-4"
        )}
      >
        {align === "right" && on && <ArrowUpDown size={11} className="shrink-0" />}
        {label}
        {align !== "right" && on && <ArrowUpDown size={11} className="shrink-0" />}
      </button>
    </th>
  );
}

function BatchTable({ rows, multi, targets = {}, series = "yield", sort, onSort }) {
  const shown = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((x, y) => {
      const a = sortValue(x, sort.key, series);
      const b = sortValue(y, sort.key, series);
      return a === b ? 0 : (a < b ? -1 : 1) * dir;
    });
  }, [rows, sort, series]);

  if (!shown.length) {
    return (
      <EmptyState
        icon={Rows3}
        title="No batches match"
        description="Widen the window, clear the search, or switch back to All."
      />
    );
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr className="text-left text-xs text-ink-4 border-b border-line">
          <SortHeader label="Closed" k="closedOn" sort={sort} onSort={onSort} />
          <SortHeader label="Product" k="product" sort={sort} onSort={onSort} />
          <SortHeader label="Yield" k="y" sort={sort} onSort={onSort} align="right" />
          <th className="font-medium pb-1.5 pr-3 text-right">Box &rarr; final</th>
          <SortHeader label="Minutes" k="minutes" sort={sort} onSort={onSort} align="right" />
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => {
          const stations = Object.entries(r.minutes || {});
          return (
            <tr key={r.id} className="border-b border-line-soft last:border-0">
              <td className="py-1.5 pr-3 text-ink-2 whitespace-nowrap">
                {formatDay(r.closedOn)}
                {multi && r.locationName && <span className="text-ink-4"> · {r.locationName}</span>}
              </td>
              {/* The column the list was missing. A batch is a product on a
                * day, and without the product half of that was a row of
                * numbers you could not act on. */}
              <td className="py-1.5 pr-3 text-ink-2 truncate max-w-[16rem]">{r.product}</td>
              {/* Amber marks the column that actually failed. A batch can be
                * flagged for slow time at 88% yield, and colouring the yield
                * for it points at the wrong number. */}
              <td
                className={cx(
                  "py-1.5 pr-3 text-right tnum font-medium",
                  r.y < LOW_YIELD_PCT ? "text-warn" : series === "yield" ? "text-ink" : "text-ink-3"
                )}
              >
                {r.y}%
              </td>
              <td className="py-1.5 pr-3 text-right tnum text-ink-3 whitespace-nowrap">
                {r.boxWeight} &rarr; {r.finalWeight} lb
              </td>
              <td className="py-1.5 text-right tnum text-ink-3 whitespace-nowrap">
                {stations.length
                  ? stations.map(([st, m], i) => (
                      <span key={st}>
                        {i > 0 && " · "}
                        {/* The selected series reads in full ink and the
                          * others step back. Amber still overrides both:
                          * something that failed is not made quieter by
                          * being off-axis. */}
                        <span
                          className={cx(
                            isOverTarget(st, m, targets)
                              ? "text-warn font-medium"
                              : st === series && "text-ink font-medium"
                          )}
                        >
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
  );
}

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
/** The chip's width, and the gap it keeps from the selection and the edge. */
const CHIP_W = 96;
const CHIP_GAP = 6;

/**
 * Highlight anything on the dashboard and ask about exactly that.
 *
 * Two steps on purpose. A panel that opens on every highlight fights the
 * user — you cannot select a number to copy it, or drag through a sentence
 * to re-read it, without a dialog landing on the page. So a selection only
 * ever raises a small chip; nothing at all happens if it is ignored. The
 * chip is also the whole of the feature's discoverability, which is why it
 * carries a word and not just an icon.
 *
 * What it opens is now the SHELL's assistant panel, not a floating panel of
 * its own. Two triggers, one conversation: the rail button asks about the
 * screen, the chip asks about the highlight, and the only difference is the
 * subject chip the panel carries afterwards. Keeping a second, smaller chat
 * here meant two threads that could not see each other's answers and two
 * copies of every fix.
 *
 * What the selection is *about* comes from the nearest `data-ask` ancestor,
 * so a highlight inside the day detail asks about that day and one inside
 * the product detail asks about that product.
 */
function SelectionAsk({ cardFor }) {
  const [sel, setSel] = useState(null);
  const hostRef = useRef(null);
  const assistant = useAssistant();

  const dismiss = useCallback(() => setSel(null), []);

  useEffect(() => {
    /* Read the selection on the tick AFTER the gesture: mouseup fires before
     * the browser has collapsed or extended the range. */
    const read = () => {
      window.setTimeout(() => {
        const s = window.getSelection();
        if (!s || s.isCollapsed || s.rangeCount === 0) return dismiss();
        const text = s.toString().trim();
        /* Punctuation and lone units are not questions. */
        if (text.length < MIN_SELECTION || !/[a-z0-9]/i.test(text)) return dismiss();
        const node = s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentElement;
        if (!node?.closest?.("[data-ask-root]")) return dismiss();
        const rect = s.getRangeAt(0).getBoundingClientRect();
        if (!rect.width && !rect.height) return dismiss();
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

  if (!sel || !assistant || typeof document === "undefined") return null;

  const card = cardFor(sel.ask);
  if (!card) return null;

  /* The chip hangs off the END of the selection, where the cursor just let
   * go. Flipped above when there is no room below, never off either edge.
   * Portaled: it is positioned in viewport coordinates and the console's
   * scroller would otherwise clip it. */
  const left = Math.min(Math.max(sel.rect.right - CHIP_W, 12), window.innerWidth - CHIP_W - 12);
  const place =
    sel.rect.bottom + 40 > window.innerHeight
      ? { bottom: window.innerHeight - sel.rect.top + CHIP_GAP }
      : { top: sel.rect.bottom + CHIP_GAP };
  const short = sel.text.length > 44 ? `${sel.text.slice(0, 44)}…` : sel.text;

  return createPortal(
    <div ref={hostRef} className="fixed z-50" style={{ left, ...place }}>
      <button
        type="button"
        onClick={() => {
          assistant.openWith({ label: `“${short}”`, card });
          /* Drop the highlight once it has been handed over — leaving it
           * selected makes the next click read as a new selection. */
          window.getSelection()?.removeAllRanges();
          dismiss();
        }}
        aria-label={`Ask about "${sel.text}"`}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-line-strong bg-surface shadow-sm text-xs font-medium text-ink-2 hover:text-ink hover:border-ink-3 transition-colors"
      >
        <Sparkles size={12} className="text-ink-4" />
        Ask
      </button>
    </div>,
    document.body
  );
}
