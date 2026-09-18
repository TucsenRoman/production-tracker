"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowUpDown, CalendarDays, ChartNoAxesColumn, CheckCircle2, Download, FileImage, FileType2, Filter, Palette, Sheet, Sparkles, TrendingUp } from "lucide-react";

import { Button, Dropdown, EmptyState, IconButton, Pill, Popover, Segmented, Tooltip, cx, useToast } from "../../components/ui";
import { formatDay, isOverTarget, LOW_YIELD_PCT, shiftDate, STAGE_TARGET_MINUTES, todayKey, yieldPct } from "../../lib/domain";
import { isFlaggedBatch, productStats, windowStats } from "../lib/insights";
import { chartCsv, chartSvg, download, svgToPngBlob, trendLine } from "../lib/chartExport";
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
  /* Which locations the page is about. Empty means every one this person can
   * see — the history already arrives scoped to that, so this narrows within
   * their own view rather than granting anything. */
  const [locationFilter, setLocationFilter] = useState([]);
  /* The Batches tab's own narrowing. Separate from the page's filters on
   * purpose: these say which of THESE batches to look at, not which batches
   * the page is about, and they reset nothing when you leave the tab. */
  const toast = useToast();
  /* The window is a (period, anchor, offset) triple rather than a pair of
   * dates, so the controls can stay lit and the stepper knows what a "step"
   * is. Dragging the scrubber sets `tf` to null — a hand-drawn window is not
   * any preset, and pretending one is lit would be a lie. */
  /* The chosen period is BOTH the preset and the track's snap grid, so it
   * survives a hand-drag: dragging changes the window, not what you are
   * stepping in. */
  const [tf, setTf] = useState("m");
  const [plotMode, setPlotMode] = useState("bars");
  const [batchView, setBatchView] = useState("all");
  /* Off by default. A trend line is an assertion, and asserting one over four
   * bars because the chart happened to load is how a tool starts lying. */
  const [trendOn, setTrendOn] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
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
  /* `series` is a MEASURE now — "yield" or "time" — and `isolate` is the one
   * station the stack has been collapsed to, if any. */
  const [series, setSeries] = useState("yield");
  const [isolate, setIsolate] = useState(null);

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

  const stations = useMemo(() => [...new Set(filtered.flatMap((r) => Object.keys(r.minutes || {})))], [filtered]);

  /* The scrubber's context track: the whole record at week resolution, and
   * unfiltered by time — it is a map of where the data is, not a second chart.
   *
   * `overShare` is what colours a candle, and it is measured ON THE SERIES THE
   * CHART IS SHOWING. It used to use `flagged`, which is low yield OR any
   * station over target — so on the Yield chart the track lit up amber for
   * smokehouse overruns that the bars underneath could not show, and the map
   * contradicted the thing it was a map of. Two marks in the same colour, one
   * above the other, have to be answering the same question.
   *
   * The denominator counts only batches that HAVE a reading for the measure:
   * a week where two of nine batches went near the smokehouse is not a good
   * smokehouse week just because the other seven never went. */
  const weeks = useMemo(() => {
    /* This test has to speak the same language the CHART does, and the chart
     * now speaks in measures rather than in one station at a time. The rename
     * broke it silently: `!stations.includes("time")` was true, so Time fell
     * through to the yield branch and the track stopped reacting to the
     * toggle at all — the map quietly went back to answering a question
     * nobody had asked. */
    const isYield = series === "yield";
    const watched = isolate ? [isolate] : stations;
    const valueOf = (r) =>
      isYield ? r.y : watched.some((st) => r.minutes?.[st] != null)
        ? watched.reduce((a, st) => a + (r.minutes?.[st] ?? 0), 0)
        : null;
    const crossed = (r) => {
      if (isYield) return r.y != null && r.y < LOW_YIELD_PCT;
      /* Any watched station over its own target — the same rule a band uses
       * in the stack, so a week goes amber for exactly the reason a bar does. */
      return watched.some((st) => isOverTarget(st, r.minutes?.[st], targets));
    };
    const byWeek = new Map();
    for (const r of filtered) {
      const k = startOfWeek(r.closedOn);
      (byWeek.get(k) || byWeek.set(k, []).get(k)).push(r);
    }
    return bucketsFor(firstKey, lastKey, "week").map((b) => {
      const rows = byWeek.get(b.key) || [];
      const measured = rows.filter((r) => valueOf(r) != null);
      return {
        ...b,
        ...windowStats(rows),
        overShare: measured.length ? measured.filter(crossed).length / measured.length : 0,
      };
    });
  }, [filtered, firstKey, lastKey, series, stations, targets, isolate]);



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

  /* The pills and the stepper speak in (period, anchor, offset); the rest of
   * the page only ever sees dates. */
  const setTimeframe = (id) => {
    const p = PERIODS.find((x) => x.id === id) || PERIODS[1];
    setSelectedDay(null);
    setTf(id);
    setRange(timeframeRange(p, firstKey, lastKey));
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
    if (plan.kind === "series") {
      /* A command naming a station means "show me that station", which is now
       * Time + isolate rather than a series of its own. */
      if (plan.value === "yield") {
        setIsolate(null);
        return setSeries("yield");
      }
      setSeries("time");
      return setIsolate(plan.value);
    }
    /* There is no list TAB any more — the list is always on the page, so the
     * command takes you to it rather than switching to it. */
    if (plan.kind === "list") return document.querySelector("[data-batch-list]")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  /* No text search here on purpose. The Ask panel is the search on this
   * screen, and it is better at it: it already knows the window, the product
   * filter and the location scope, so "applewood bacon" there answers within
   * the same twelve batches a box would have matched — and answers questions
   * a substring never could. A second field would have been a narrower search
   * sitting under a broader one. */
  const shownBatches = useMemo(
    () =>
      batchRows.filter((r) => {
        if (batchView === "flagged" && !r.flagged) return false;
        if (batchView === "slow" && !isSlow(r, targets)) return false;
        return true;
      }),
    [batchRows, batchView, targets]
  );

  /* What the chart draws, and what the export menu hands out — one
   * derivation, so a downloaded file can never disagree with the screen. */
  const plot = useMemo(
    () => chartPoints(buckets, series, stations, targets, isolate),
    [buckets, series, stations, targets, isolate]
  );
  const trend = useMemo(() => trendLine(plot.points), [plot]);

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

  const batchRefine = (
    <Pill
      variant="accent"
      value={batchView}
      onChange={setBatchView}
      aria-label="Which batches to list"
      options={BATCH_VIEWS.map((v) => ({
        value: v.id,
        label: v.label,
        resting: v.resting,
        count: batchCounts[v.id],
      }))}
    />
  );

  /* The chart tab's right-hand controls, mirroring where the batch pill sits
   * on the other tab: the tabs say what you are looking at, this end of the
   * row says what you are doing with it. */
  const exportChart = async (kind) => {
    setExportOpen(false);
    const unit = plot.isYield ? "%" : "min";
    const valueLabel = plot.isYield ? "Average yield" : `${plot.station} minutes`;
    const stamp = `${from}_${to}`;
    const base = `insights-${plot.isYield ? "yield" : plot.station.toLowerCase()}-${stamp}`;
    try {
      if (kind === "csv") {
        download(new Blob([chartCsv(plot.points, { valueLabel, unit })], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
        return;
      }
      const svg = chartSvg(plot.points, {
        valueLabel,
        unit,
        line: plot.line,
        /* The title names the measure, the subtitle carries the scope and the
         * range — the same two lines the screen leads with, so the file is
         * readable by someone who was not looking at the screen. */
        title: valueLabel,
        subtitle: scopeLine,
        /* The line is exported only when it is on screen — a file that
         * asserts more than the chart did is a file that misquotes you. */
        trend: trendOn ? trend : null,
      });
      if (!svg) {
        toast?.("Nothing closed in this window, so there is no chart to export.");
        return;
      }
      if (kind === "svg") {
        download(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${base}.svg`);
        return;
      }
      download(await svgToPngBlob(svg), `${base}.png`);
    } catch {
      toast?.("Could not build that file. Try the CSV.");
    }
  };

  const chartKey = (
    <Popover
      open={keyOpen}
      onClose={() => setKeyOpen(false)}
      align="start"
      label="What the marks on the chart mean"
      panelClassName="p-3"
      content={
        <ul className="flex flex-col gap-1.5 text-xs text-ink-2 whitespace-nowrap">
          <li className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[2px] shrink-0 bg-warn/75" />
            Over target
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[2px] shrink-0 bg-line-soft" />
            Nothing closed
          </li>
          {series === "yield" ? (
            <li className="flex items-center gap-2">
              <span className="w-2.5 border-t border-dashed border-line-strong shrink-0" />
              The {LOW_YIELD_PCT}% line — taller is better
            </li>
          ) : (
            <>
              <li className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-[2px] shrink-0 bg-ink/[0.045] border border-line" />
                One stripe per station, as tall as its target
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2.5 border-t border-dashed border-line-strong shrink-0" />
                Target cycle time — shorter is better
              </li>
            </>
          )}
          {quietSince && (
            <li className="pt-1 mt-0.5 border-t border-line-soft text-ink-3">
              Nothing has closed since {formatDay(quietSince)}.
            </li>
          )}
        </ul>
      }
    >
      <IconButton
        label="What the marks mean"
        icon={Palette}
        aria-expanded={keyOpen}
        onClick={() => setKeyOpen((v) => !v)}
        className={keyOpen ? "bg-hover text-ink" : undefined}
      />
    </Popover>
  );

  const chartTools = (
    <div className="flex items-center gap-1.5">
      <Tooltip
        label={
          trend
            ? `Least squares across the window — ${trend.delta >= 0 ? "up" : "down"} ${Math.abs(round1(trend.delta))}${plot.isYield ? " points" : " min"} end to end`
            : "Needs at least three periods with data"
        }
      >
        <button
          type="button"
          role="switch"
          aria-checked={trendOn && !!trend}
          disabled={!trend}
          onClick={() => setTrendOn((v) => !v)}
          className={cx(
            "inline-flex items-center gap-1.5 h-[var(--ctl-h)] px-2.5 rounded-md text-xs font-medium",
            "transition-colors duration-100 disabled:opacity-45 disabled:cursor-not-allowed",
            trendOn && trend ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-faint hover:text-ink"
          )}
        >
          <TrendingUp size={14} className="shrink-0" />
          Trend
        </button>
      </Tooltip>
      <Popover
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        align="end"
        label="Export this chart"
        panelClassName="p-1"
        content={
          <div className="flex flex-col min-w-[13rem]">
            {EXPORTS.map((x) => (
              <button
                key={x.kind}
                type="button"
                onClick={() => exportChart(x.kind)}
                className="flex items-start gap-2.5 px-2 py-1.5 rounded-md text-left hover:bg-hover"
              >
                <x.icon size={15} className="mt-0.5 shrink-0 text-ink-3" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-ink">{x.label}</span>
                  <span className="block text-[11px] text-ink-3">{x.note}</span>
                </span>
              </button>
            ))}
          </div>
        }
      >
        <Button variant="ghost" size="md" icon={Download} onClick={() => setExportOpen((v) => !v)} aria-expanded={exportOpen}>
          Export
        </Button>
      </Popover>
    </div>
  );

  /* ---- The page's parts, built once and arranged by LV below. Layout is
   * the variable here; the pieces are not. */
  const scopeNode = (
    <span className="flex items-center gap-1.5 text-xs text-ink-4">
      {locationControl}
      {productControl("quiet") && (
        <>
          <span>·</span>
          {productControl("quiet")}
        </>
      )}
    </span>
  );
  /* Two options, forever, however many stations the shop grows. It sits with
   * the window controls because what you are measuring is a property of the
   * window, not of the chart card that happens to draw it. */
  const seriesNode = stations.length ? (
    <Pill
      variant="accent"
      value={series}
      onChange={(v) => {
        setSeries(v);
        setIsolate(null);
      }}
      aria-label="What to measure"
      options={MEASURES.map((m) => ({ value: m.id, label: m.label, hint: m.hint }))}
    />
  ) : null;
  const presetNode = (
    <TimeframeControls period={tf} onChange={setTimeframe} />
  );
  const trackNode = (
    <TimeScrubber
      from={from}
      to={to}
      firstKey={firstKey}
      lastKey={lastKey}
      weeks={weeks}
      onChange={changeRange}
      snapUnit={PERIODS.find((p) => p.id === tf)?.unit ?? null}
    />
  );
  /* ---- The two readings, no longer two tabs.
   *
   * They were a Chart tab and a Batches tab, which asked people to choose
   * between "how did the window go" and "which batches were in it" — two
   * halves of one question, and the tab made you ask it twice and lose the
   * other answer each time. Stacked, the chart is the summary and the list is
   * the evidence under it, which is the order people read them in anyway. */
  const chartBody = (
    <>
      {plotMode === "grid" ? (
        <CalendarPlot plot={plot} selected={selectedDay} onPick={pickBucket} />
      ) : (
      <RunChart
        plot={plot}
        grain={grain}
        selected={selectedDay}
        onPick={pickBucket}
        trend={trendOn ? trend : null}
        height={BAR_H_SPLIT}
        onIsolate={setIsolate}
      />
      )}
      {selectedCell && dayCard && (
        <div className="mt-5 pt-4 border-t border-line" data-ask={`day:${selectedCell.key}`}>
          <InsightHeadline
            card={{ ...dayCard, title: formatDay(selectedCell.key) }}
            onClear={() => setSelectedDay(null)}
          />
          <ul className={cx("mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-1.5", ICON_INDENT)}>
            {selectedCell.batches.map((b) => (
              <li key={b.id} className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-ink-2 truncate">
                  {b.product}
                  {b.locationName && <span className="text-ink-4"> · {b.locationName}</span>}
                </span>
                <span className={cx("text-xs font-medium tnum shrink-0", b.flagged ? "text-warn" : "text-ink-3")}>
                  {b.y}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  const yearBlock = (
    <div data-ask={askKey}>
      <Section
        title="Compared with a year ago"
        hint={
          overlaps
            ? null
            : `The same ${spanDays} days one year earlier — ${formatDay(yearAgo.from)} to ${formatDay(yearAgo.to)}, ${yearAgo.from.slice(0, 4)}`
        }
      >
        {/* A window longer than a year, shifted back a year, overlaps itself —
          * the comparison would be partly against the very batches it is
          * comparing. Say so rather than print a number that looks like an
          * answer. */}
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
  );

  const listBody = (
    /* Everything in it is about the period, so one `data-ask` covers the lot
      * and a highlight anywhere in the table asks about the window. */
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
  );



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
      {/* ---- The window DISSOLVES; the chart gets the card.
        *
        * The card moved. The window controls had one because five loose bands
        * of chrome read as five unrelated stripes — but a panel is a strong
        * claim, and it was spending it on the thing you set rather than the
        * thing you read. Navigation should sit in the page; the reading should
        * sit in an object. So the scrubber is back on bare page with a hairline
        * under it, and the chart is what is framed.
        *
        * The preset row is a Pill now, which is what holds the controls
        * together without a panel doing it for them. */}
      {/* WHAT you are measuring and HOW MUCH of the record — both are
        * properties of the window, so both sit on the window's row. The
        * measure used to live in the chart card, which made it look like a
        * property of that one drawing rather than of everything below it. */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {scopeNode}
        <span className="flex-1" />
        {seriesNode}
        {presetNode}
      </div>
      {trackNode}
      {/* The standing numbers ride UNDER the track, on the line the range
        * already owns — they are facts about this window, so they belong to
        * the control that sets it rather than to the page header. */}
      <div className="flex items-center justify-between gap-3 flex-wrap mt-1 pb-3 border-b border-line">
        {ticker}
      </div>

      {/* The chart card takes three fifths of the row and the year-ago table
        * takes the rest as a sibling. Giving width away is what makes the plot
        * squarish — you cannot square thirty day-bars by stretching them — and
        * it promotes the comparison out of the footnote it was in. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-lg border border-line bg-surface px-4 pt-3 pb-4">
          {/* The card's controls sit LEFT, where reading starts. They were
            * right-aligned because the row used to open with the measure
            * chips; with those gone the row opened with nothing and the
            * controls floated against an empty gutter. */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {/* Bars and calendar are two readings of ONE window, not two
              * windows — so this is a view switch inside the card, not another
              * thing the page can be set to. Bars answer "how much, when";
              * the grid answers "which days, and does it rhyme with the
              * week". */}
            <Segmented
              size="sm"
              value={plotMode}
              onChange={setPlotMode}
              options={[
                { value: "bars", label: "Bars", icon: ChartNoAxesColumn, hint: "One bar per period" },
                { value: "grid", label: "Grid", icon: CalendarDays, hint: "Days wrapped into weeks" },
              ]}
            />
            {chartTools}
            {chartKey}
            <span className="flex-1" />
          </div>
          {chartBody}
        </div>
        <div className="lg:col-span-2 rounded-lg border border-line bg-surface px-4 pt-3 pb-4">{yearBlock}</div>
      </div>

      {/* The list, under the summary rather than behind a tab. */}
      <div className="mt-7" data-batch-list="">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">Batches</h3>
          {batchRefine}
        </div>
        {listBody}
      </div>

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
/**
 * TIMEFRAME: one pill, and a track that snaps.
 *
 * This was two pills and a stepper — period, anchor, and ← → to walk back a
 * period at a time. The anchor pill was the weak one: "Rolling vs To date" is
 * a distinction analysts make and nobody on a floor says out loud, and the
 * stepper was faking a spatial relationship ("the month before this one")
 * with an abstract button.
 *
 * Both of those jobs belong to the track. The scrubber already shows the
 * whole record and already moves the window by hand; what it lacked was
 * PRECISION — at roughly a pixel and a half per day you cannot land on the
 * first of the month by eye. So the period pill now does two things: it picks
 * a window, and it sets the SNAP GRID the track drags against. Pick Month and
 * the track grows month ticks; drag one notch left and you are on August,
 * whole. That is the stepper, except you can see it happen.
 *
 * What that costs, honestly: a snap cannot advertise itself. The pill has to
 * stay, because it is the menu — it is the only thing on the page that says
 * "quarters are a thing you can have here". A track with invisible magnetism
 * and no pill would be a feature only its author knows about.
 *
 * Rolling windows are gone as a concept. "The last 30 days" has no calendar
 * edge to snap to, and a shop says "September", not "the trailing thirty".
 * You can still draw one by hand — hold Shift, which turns the magnet off.
 */
const PERIODS = [
  /* Abbreviated. The long words were there to spell out a grammar back when a
   * second pill sat beside them ("Last / This Month"); with one pill and a
   * track that snaps, the letter is enough and the row stops eating the
   * width the scope line needs. The hint carries the full word. */
  { id: "w", label: "W", unit: "week", title: "A week at a time" },
  { id: "m", label: "M", unit: "month", title: "A month at a time" },
  { id: "q", label: "Q", unit: "quarter", title: "A quarter at a time" },
  { id: "y", label: "Y", unit: "year", title: "A year at a time" },
  { id: "all", label: "All", title: "The whole record, no snapping" },
];

/** The window the page opens on. */
const DEFAULT_SPAN = 30;

const startOfMonth = (key) => `${key.slice(0, 7)}-01`;
const startOfQuarter = (key) => {
  const m = Number(key.slice(5, 7)) - 1;
  return `${key.slice(0, 4)}-${String(Math.floor(m / 3) * 3 + 1).padStart(2, "0")}-01`;
};
const startOfYear = (key) => `${key.slice(0, 4)}-01-01`;

/* Resolved lazily: `startOfWeek` is declared further down with the other date
 * helpers, and a module-level object would read it at definition time. */
const CAL_START = {
  week: (k) => startOfWeek(k),
  month: startOfMonth,
  quarter: startOfQuarter,
  year: startOfYear,
};

/**
 * Every period boundary inside the record, oldest first.
 *
 * The record's own first day is included as an edge. It is not a calendar
 * boundary, but it is the only other place a window can honestly begin — and
 * without it the earliest period would be unreachable by dragging.
 */
function boundariesFor(unit, firstKey, lastKey) {
  if (!unit || !CAL_START[unit]) return [];
  const out = [];
  let k = CAL_START[unit](lastKey);
  while (k > firstKey) {
    out.unshift(k);
    k = CAL_START[unit](shiftDate(k, -1));
  }
  out.unshift(firstKey);
  return out;
}

/** The last day of the period starting at `startKey`. */
const periodEnd = (startKey, boundaries, lastKey) => {
  const next = boundaries.find((b) => b > startKey);
  return next ? shiftDate(next, -1) : lastKey;
};

const nearestKey = (key, boundaries) =>
  boundaries.reduce((best, b) => (Math.abs(daysBetween(b, key)) < Math.abs(daysBetween(best, key)) ? b : best), boundaries[0]);

/** The range a period lands on when you press it: this one, so far. */
function timeframeRange(period, firstKey, lastKey) {
  if (!period || period.id === "all") return { from: firstKey, to: lastKey };
  return { from: clampKey(CAL_START[period.unit](lastKey), firstKey, lastKey), to: lastKey };
}

const QUARTER_OF = (key) => `Q${Math.floor(Number(key.slice(5, 7) - 1) / 3) + 1} ${key.slice(0, 4)}`;

/**
 * A window that lands exactly on a calendar period is NAMED, not dated.
 *
 * "August" is what the window is; "Aug 1 – Aug 31" is a description of it that
 * the reader then has to decode back into "August". This is the whole payoff
 * of snapping — you get a preset's legibility without a chip existing for it.
 */
function windowName(from, to, unit, boundaries, lastKey) {
  if (!unit || !boundaries.length) return null;
  const start = CAL_START[unit](from);
  if (start !== from) return null;
  const soFar = to === lastKey && from === CAL_START[unit](lastKey);
  const whole = to === periodEnd(from, boundaries, lastKey);
  if (!soFar && !whole) return null;
  const name =
    unit === "month"
      ? `${MONTH_LABELS[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}`
      : unit === "quarter"
        ? QUARTER_OF(from)
        : unit === "year"
          ? from.slice(0, 4)
          : `Week of ${formatDay(from)}`;
  return soFar ? `${name} so far` : name;
}

/** The period pill. It picks a window AND sets the track's snap grid. */
function TimeframeControls({ period, onChange }) {
  return (
    <Pill
      variant="accent"
      value={period}
      onChange={onChange}
      aria-label="Window size, and what the track snaps to"
      options={PERIODS.map((p) => ({ value: p.id, label: p.label, hint: p.title }))}
    />
  );
}

function TimeScrubber({ from, to, firstKey, lastKey, weeks, onChange, tall = false, showLabel = true, snapUnit = null }) {
  const [dragging, setDragging] = useState(null);

  /**
   * SNAPPING.
   *
   * The track is about a pixel and a half per day across a multi-year record,
   * so landing on the first of the month by eye is not a thing anyone can do.
   * The magnet makes the precise windows the EASY ones and leaves the rest
   * reachable — hold Shift and the magnet is off, which is the one gesture
   * that has to stay available because a shop floor question is not always a
   * calendar question.
   *
   * `snapPan` is the part that took thought. Dragging a window that IS a whole
   * period should walk period to period — that is the stepper, done spatially.
   * Dragging a window that is NOT should keep its length and just tidy its
   * start, because silently resizing someone's hand-drawn window to a calendar
   * month is the control overriding a decision they already made.
   */
  const bounds = useMemo(() => boundariesFor(snapUnit, firstKey, lastKey), [snapUnit, firstKey, lastKey]);
  const snapping = bounds.length > 1;

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

    /* Shift is the bypass, read per EVENT rather than per gesture: you can
     * start a drag, decide halfway that you want the exact day, and hold it. */
    const rawKeyAt = (clientX) =>
      shiftDate(firstKey, Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * total));
    const keyAt = (clientX, free) => {
      const k = rawKeyAt(clientX);
      return snapping && !free ? nearestKey(k, bounds) : k;
    };

    const base = seed ?? { from, to };
    const span = daysBetween(base.from, base.to);
    const origin = rawKeyAt(e.clientX);

    let current = { from, to };
    const emit = (next) => {
      if (next.from === current.from && next.to === current.to) return;
      current = next;
      onChange(next);
    };
    if (seed) emit(seed);

    let frame = 0;
    let pending = null;
    let free = e.shiftKey;
    const apply = () => {
      frame = 0;
      const { raw, snapped } = pending;
      if (mode === "from") {
        emit({ from: clampKey(snapped, firstKey, shiftDate(base.to, -1)), to: base.to });
      } else if (mode === "to") {
        /* A window ENDS the day before the next boundary, not on it — snapping
         * the right edge to Sep 1 would mean "August plus one day". */
        const end = snapping && !free && snapped !== lastKey ? shiftDate(snapped, -1) : snapped;
        emit({ from: base.from, to: clampKey(end, shiftDate(base.from, 1), lastKey) });
      } else if (snapping && !free) {
        /* A pan with a grid on ALWAYS lands on one whole period — it does not
         * preserve whatever length the window happens to have.
         *
         * It used to only do that when the window was ALREADY a whole period,
         * and preserve the span otherwise. That read as reasonable and was a
         * trap: drag to the start of the record, the period clamps to a
         * part-period against the record's first day, and from then on the
         * window is "not a period" — so every later drag preserved that
         * accidental length while the pill still said Quarter. The control
         * and the window had silently stopped describing each other, with no
         * way back except pressing the pill again.
         *
         * Forcing a full period means the clamp is a place you can leave. */
        const start = clampKey(nearestKey(shiftDate(base.from, daysBetween(origin, raw)), bounds), firstKey, lastKey);
        emit({ from: start, to: clampKey(periodEnd(start, bounds, lastKey), start, lastKey) });
      } else {
        const moved = shiftDate(base.from, daysBetween(origin, raw));
        const nextFrom = clampKey(moved, firstKey, shiftDate(lastKey, -span));
        emit({ from: nextFrom, to: shiftDate(nextFrom, span) });
      }
    };

    const move = (ev) => {
      free = ev.shiftKey;
      pending = { raw: rawKeyAt(ev.clientX), snapped: keyAt(ev.clientX, free) };
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
    /* With a grid on, a bare click takes the PERIOD you clicked in rather than
     * re-centring the old window there. Clicking somewhere in August and
     * getting August is the whole promise of the ticks; getting "thirty days
     * centred on the 14th" would be the track ignoring its own marks. */
    if (snapping && !e.shiftKey) {
      const start = [...bounds].reverse().find((b) => b <= centre) ?? firstKey;
      return startDrag("pan", e, { from: start, to: clampKey(periodEnd(start, bounds, lastKey), start, lastKey) });
    }
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
      {/* The tooltip is where the track explains itself, including its one
        * colour — a mark nobody can decode is decoration. */}
      <Tooltip
        label={`Drag to move · edges resize · scroll to pan${snapping ? " · snaps to the grid, Shift to ignore it" : ""} · amber weeks ran a third over the line`}
        side="top"
        className="w-full"
      >
      <div
        ref={trackRef}
        data-scrub-track=""
        onPointerDown={jump}
        className={cx(
          "relative w-full select-none touch-none",
          tall ? "h-14" : "h-8",
          dragging === "from" || dragging === "to" ? "cursor-ew-resize" : dragging ? "cursor-grabbing" : "cursor-pointer"
        )}
      >
        {/* The whole record at week resolution, drawn by HOW MUCH CLOSED,
          * not by yield. A scrubber is a map you navigate — you drag to
          * where the work is — and yield here would be a second, smaller
          * copy of the chart above saying the same thing worse.
          *
          * But a map with nothing marked on it only answers "where is there
          * data", and you already knew there was data. A week holding a
          * flagged batch goes amber, so the track answers the question people
          * actually bring to it — where should I be looking — before they
          * have dragged anything. It stays HEIGHT for volume and COLOUR for
          * trouble, which are two readings of one bar rather than two bars.
          *
          * A week goes amber when a THIRD of its batches crossed the line on
          * the measure the chart is showing.
          *
          * Three tests were tried. "Holds a flagged batch" painted nearly
          * every candle — at week resolution almost any stretch holds one, so
          * the test is true of the whole record and marks nothing. "Week
          * average crossed the line" painted none, because a couple of bad
          * batches rarely drag a week's mean under; a signal that never fires
          * is no signal. A share of FLAGGED batches fired at the right rate
          * but answered the wrong question: flagged means low yield or any
          * station slow, so the track went amber over smokehouse overruns
          * while the Yield bars below it were all green — the map arguing
          * with the chart it sits on top of.
          *
          * Measured on the current series, the two agree by construction, and
          * switching the measure re-marks the map. Height is how much closed,
          * colour is how much of it went wrong at the thing you are looking
          * at. */}
        <div className="absolute inset-0 flex items-end gap-px" aria-hidden="true">
          {weeks.map((w) => (
            <span
              key={w.key}
              className={cx(
                "flex-1 min-w-px rounded-[1px] transition-colors duration-150",
                w.overShare >= WEEK_TROUBLE_SHARE
                  ? "bg-warn/70"
                  : w.batches
                    ? "bg-line-strong"
                    : "bg-line-soft"
              )}
              style={{ height: w.batches ? `${Math.max(10, Math.min(100, (w.batches / busiest) * 100))}%` : 2 }}
            />
          ))}
        </div>

        {/* The grid, drawn UNDER the curtains so the out-of-window ticks dim
          * with everything else. Hairlines only: a tick is a place the window
          * can land, and anything heavier competes with the candles, which are
          * the actual data. */}
        {snapping &&
          bounds.slice(1).map((b) => (
            <span
              key={b}
              className="absolute inset-y-0 w-px bg-line-strong/50 pointer-events-none"
              style={{ left: `${pct(b)}%` }}
              aria-hidden="true"
            />
          ))}

        {/* Curtains, not a highlight. Washing the SELECTION was backwards —
          * it dimmed the weeks you had chosen and left the rest bright, so
          * the window read as the part being ignored. Dimming everything
          * outside it makes the selection the clear part, which is what a
          * scrubber is for. */}
        <div className={cx("absolute inset-y-0 left-0", CURTAIN)} style={{ width: `${left}%` }} aria-hidden="true" />
        <div className={cx("absolute inset-y-0 right-0", CURTAIN)} style={{ left: `${right}%` }} aria-hidden="true" />

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
      {showLabel && (
      <div className="relative h-4 mt-1">
        <p
          className="absolute top-0 whitespace-nowrap text-[10px] leading-none tnum text-ink-3"
          style={{
            left: `${mid}%`,
            transform: `translateX(${mid < 12 ? "0" : mid > 88 ? "-100%" : "-50%"})`,
          }}
        >
          <span className="font-semibold uppercase tracking-wide text-ink">
            {windowName(from, to, snapUnit, bounds, lastKey) ?? formatSpanTitle(from, to)}
          </span>
        </p>
      </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Chart -- */

const BAR_H = 64;

/** The split layout's plot height — the card is ~3/5 of the row, so the plot
 *  lands near 4:3 without buying height it does not need. */
const BAR_H_SPLIT = 200;

/* TEMPORARY SCAFFOLD: how the out-of-window track recedes. One gets kept.
 *
 *   "flat"  — a flat wash, what it does now.
 *   "blur"  — a real backdrop blur over the candles outside the window.
 *   "desat" — the colour is drained outside the window and the shapes stay
 *             sharp, so amber only ever appears where you are looking. */
const SV = "flat";
const CURTAIN =
  SV === "blur"
    ? "bg-surface/55 backdrop-blur-[2px]"
    : SV === "desat"
      ? "bg-surface/60 backdrop-saturate-0"
      : "bg-surface/75";

/** How much of a week has to cross the line before the scrubber calls it out. */
const WEEK_TROUBLE_SHARE = 1 / 3;

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

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The axis stamp for a bucket.
 *
 * A ruler marks its units, not every tick — but "every seventh day" was a rule
 * for a thirty-day window applied to all of them, and at eight days it stamped
 * twice and left six bars unnamed. A bar you cannot name is a bar you cannot
 * act on. So the stride follows how many bars there ARE: label them all while
 * two digits still fit, then back off.
 */
function dayStride(n) {
  if (n <= 35) return 1;
  if (n <= 60) return 2;
  return Math.ceil(n / 12);
}

function stampFor(b, i, grain, buckets) {
  const d = new Date(`${grain === "month" ? `${b.key}-01` : b.key}T00:00:00`);
  const prev = i > 0 ? new Date(`${grain === "month" ? `${buckets[i - 1].key}-01` : buckets[i - 1].key}T00:00:00`) : null;
  const newMonth = !prev || prev.getMonth() !== d.getMonth();
  if (grain === "day") {
    if (d.getDate() === 1) return MONTH_LABELS[d.getMonth()];
    return i % dayStride(buckets.length) === 0 ? `${d.getDate()}` : "";
  }
  if (grain === "week") return newMonth ? MONTH_LABELS[d.getMonth()] : "";
  return `${MONTH_LABELS[d.getMonth()]}${i === 0 || d.getMonth() === 0 ? ` \u2019${String(d.getFullYear()).slice(2)}` : ""}`;
}

/**
 * MEASURE, not series.
 *
 * There was a chip per station — Yield · Packaging · Smokehouse — which is
 * fine at two stations and unusable at twelve: the row runs off the page, and
 * worse, you end up with twelve separate charts you have to flip between to
 * answer one question. "Where does the time go" is not twelve questions.
 *
 * There are only ever two KINDS of measurement here, whatever the shop grows
 * into. Yield is one number per batch, a percentage, higher is better. Time is
 * N numbers per batch, minutes per station, lower is better. So the control is
 * two options forever, and Time draws every station at once as a stack: the
 * column height is the whole cycle time and the segments are where it went.
 *
 * The honest cost: only the bottom segment shares a baseline, so comparing one
 * station across days is harder in a stack than it was in its own chart. That
 * is what `isolate` is for — click a station in the legend and the stack
 * collapses to that station alone, which is the old per-station chart, on
 * demand, without a chip sitting in the toolbar all day waiting for it.
 */
const MEASURES = [
  { id: "yield", label: "Yield", hint: "Finished weight against box weight" },
  { id: "time", label: "Time", hint: "Minutes per batch, split by station" },
];

/* Every band is the same ink.
 *
 * They were shades of one colour, which works at two stations and falls apart
 * at eight: the ramp runs out, the last few are indistinguishable, and a
 * reader is left matching greys to a key. Position is the better encoding and
 * it is free — the bands are always in the same order, so a named lane down
 * the left says which is which, permanently, for any number of stations. That
 * leaves colour doing one job: amber means over target. */
const BAND_FILL = "bg-ink-2";

/**
 * What the chart plots, derived once at screen level rather than inside the
 * chart — because the export menu has to hand out exactly what is on screen,
 * and a second derivation is a second chance to disagree with it.
 */
function chartPoints(buckets, measure, stations, targets, isolate = null) {
  const isYield = measure === "yield";
  if (isYield) {
    const line = LOW_YIELD_PCT;
    return {
      isYield: true,
      station: null,
      shown: [],
      line,
      points: buckets.map((b) => {
        const v = b.avgYield;
        return { ...b, v, parts: null, over: v != null && v < line };
      }),
    };
  }

  const shown = isolate ? [isolate] : stations;
  const targetOf = (st) => targets[st] ?? STAGE_TARGET_MINUTES[st] ?? 0;
  /* The line is the SUM of the shown stations' targets — the cycle time the
   * shop is aiming at. A single station's target would be meaningless against
   * a stacked total. */
  const line = shown.reduce((a, st) => a + targetOf(st), 0);

  /* The target LADDER: where each band should end if every station hits its
   * own target. One line per station, drawn cumulatively, so a band's own
   * reference is the line directly above the band below it — which is what
   * makes a stack readable despite only the bottom segment sharing a
   * baseline. The top rung is the sum, i.e. target cycle time. */
  let running = 0;
  const ladder = shown.map((st) => {
    running += targetOf(st);
    return { station: st, at: running, own: targetOf(st) };
  });

  return {
    isYield: false,
    station: isolate,
    shown,
    ladder,
    line,
    points: buckets.map((b) => {
      const parts = shown.map((st) => ({
        station: st,
        v: b.minutes?.[st] ?? null,
        over: isOverTarget(st, b.minutes?.[st], targets),
      }));
      const any = parts.some((x) => x.v != null);
      const v = any ? parts.reduce((a, x) => a + (x.v ?? 0), 0) : null;
      /* ONE over-test for minutes, wherever it is asked.
       *
       * The stack coloured a band with `isOverTarget`, which has a tolerance
       * band, while an isolated station coloured its bar with a plain
       * `v > target`. So the same day could be amber alone and grey in the
       * stack — the chart disagreeing with itself depending on which way you
       * were looking at it. `isOverTarget` wins because it is what the batch
       * table and the scrubber already use. */
      const over = shown.length === 1 ? parts[0].over : parts.some((x) => x.over);
      return { ...b, v, parts, over, overTotal: v != null && v > line };
    }),
  };
}

function CalendarPlot({ plot, selected, onPick }) {
  const { isYield, line, points } = plot;
  const days = points.filter((p) => p.from === p.to);
  if (!days.length) return <p className="py-8 text-xs text-ink-4">The calendar reading needs daily buckets.</p>;

  const values = days.map((p) => p.v).filter((v) => v != null);
  const lo = Math.min(...values, line);
  const hi = Math.max(...values, line);
  /* Good is deep in both directions, but "good" flips: a high yield is good,
   * a high minute count is not. */
  const depth = (v) => {
    if (hi === lo) return 0.55;
    const t = (v - lo) / (hi - lo);
    return 0.18 + 0.72 * (isYield ? t : 1 - t);
  };

  /* Monday-first, so the weekend sits at the end of the row where it reads as
   * the edge of the week rather than a gap down the middle. */
  const lead = (new Date(`${days[0].from}T00:00:00`).getDay() + 6) % 7;

  return (
    <div className="shrink-0">
      <div className="grid grid-cols-7 gap-1 w-[220px]">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-center text-[10px] leading-none text-ink-4 pb-0.5">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`pad${i}`} />
        ))}
        {days.map((p) => {
          const isSel = selected === p.key;
          const empty = p.v == null;
          return (
            <button
              key={p.key}
              type="button"
              disabled={empty}
              onClick={() => onPick?.(p)}
              title={`${formatDay(p.from)}${empty ? ", nothing closed" : `, ${p.v}${isYield ? "%" : " min"}`}`}
              className={cx(
                "aspect-square rounded-[3px] transition-[background-color,box-shadow] duration-150",
                empty && "bg-line-soft cursor-default",
                !empty && (p.over ? "bg-warn" : isYield ? "bg-ok" : "bg-ink"),
                isSel && "ring-2 ring-ink ring-offset-1"
              )}
              style={empty ? undefined : { opacity: depth(p.v) }}
            />
          );
        })}
      </div>
      <p className="mt-2.5 flex items-center gap-2 text-[11px] text-ink-4">
        <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-ok" style={{ opacity: 0.25 }} />
        <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-ok" style={{ opacity: 0.9 }} />
        {isYield ? "lighter is a worse day" : "lighter is a slower day"}
        <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-warn ml-1" />
        over the line
      </p>
    </div>
  );
}

function RunChart({ plot, grain, selected, onPick, compact = false, trend = null, height = BAR_H, onIsolate }) {
  const { isYield, station, line, points, shown = [], ladder = [] } = plot;
  /* A stack only reads as proportions if it starts at zero. A minutes chart
   * normally crops its baseline so the differences are visible, but cropping
   * a stack would make the segments lie about their share of the total — so
   * Time-with-a-stack trades that sensitivity for honesty, and isolating a
   * station gets the cropped baseline back. */
  const stacked = !isYield && shown.length > 1;

  const values = points.map((p) => p.v).filter((v) => v != null);
  const lo = values.length ? (isYield ? Math.min(line, ...values) - 2 : stacked ? 0 : Math.min(line, ...values) * 0.92) : line - 2;
  const hi = values.length ? (isYield ? Math.max(line, ...values) + 2 : Math.max(line, ...values) * 1.04) : line + 2;
  /* Every rung has to be inside the plot or the ladder lies by omission. */
  const top = stacked ? Math.max(hi, ...ladder.map((r) => r.at)) * 1.02 : hi;
  const scale = (v) => Math.max(0.04, Math.min(1, (v - lo) / (top - lo)));
  const labelled = !compact && points.length <= VALUE_LABEL_MAX;
  const clickable = grain !== "day" || !!onPick;

  /* The lane a station's band occupies, as a pair of percentages up the plot.
   * Drives the backdrop stripe AND the label beside it, from one source, so a
   * name can never drift off the band it names. */
  const lanes = stacked
    ? ladder.map((rung, i) => ({
        ...rung,
        lo: scale(i ? ladder[i - 1].at : 0) * 100,
        hi: scale(rung.at) * 100,
      }))
    : [];

  return (
    <div className={cx(stacked && !compact && "flex items-stretch gap-3")}>
      {/* The key, down the left, outside the plot.
        *
        * It was a dashed line per station with its label floating over the
        * bars on a knocked-out background — a label that has to erase the data
        * to be readable is a label in the wrong place. Out here it costs a
        * gutter and owes the chart nothing. */}
      {stacked && !compact && (
        <div className="relative w-[82px] shrink-0" style={{ height }}>
          {lanes.map((lane) => (
            /* Anchored to the band's TOP edge — its target — and reading
              * downward into its own band, rather than centred in it. Centring
              * looked tidier and broke immediately: a station with a small
              * target owns a thin band, and two lines of type do not fit in
              * thirty pixels. Hung off the boundary, the label is the same
              * size whatever the band is, and it sits exactly where the dashed
              * rule used to be. */
            <button
              key={lane.station}
              type="button"
              onClick={() => onIsolate?.(lane.station)}
              title={`Show ${lane.station} alone`}
              className="absolute inset-x-0 translate-y-full flex flex-col items-end text-right pr-0.5 pt-0.5 group"
              style={{ bottom: `${lane.hi}%` }}
            >
              <span className="text-[11px] leading-tight text-ink-2 group-hover:text-ink truncate max-w-full">
                {lane.station}
              </span>
              <span className="text-[10px] leading-tight tnum text-ink-4">{lane.own} min</span>
            </button>
          ))}
        </div>
      )}
      <div className={cx(stacked && !compact && "flex-1 min-w-0")}>
      <div className="relative" style={{ height: compact ? 34 : height }}>
        {/* Alternating stripes instead of dashed rules. A band's target is now
          * the EDGE of its stripe, which is a boundary you read by position
          * rather than a line you read by decoding. */}
        {stacked &&
          lanes.map((lane, i) => (
            <div
              key={lane.station}
              /* bg-sunken is a 2% wash and disappears against the card. The
               * stripe has to be a mark you can see without looking for it,
               * so it is a deliberate tint rather than the surface token. */
              className={cx("absolute inset-x-0 pointer-events-none", i % 2 === 0 ? "bg-ink/[0.045]" : "bg-transparent")}
              style={{ bottom: `${lane.lo}%`, height: `${Math.max(lane.hi - lane.lo, 0)}%` }}
              aria-hidden="true"
            />
          ))}
        {/* One dashed rule, for the TOTAL. The per-station targets are the
          * stripe edges — a boundary you read by position — but the total is
          * the number a bar is judged against, and a bar crossing a line is
          * the one reading that needs no decoding at all. */}
        {stacked && !!lanes.length && (
          <div
            className={cx("absolute left-0 right-0 z-10 border-t border-dashed border-line-strong pointer-events-none", CHART_EASE)}
            style={{ bottom: `${lanes[lanes.length - 1].hi}%` }}
            aria-hidden="true"
          >
            <span className="absolute right-0 -translate-y-1/2 pl-1.5 bg-surface text-[10px] leading-none tnum text-ink-4">
              {line} min total
            </span>
          </div>
        )}
        {/* The threshold line moves whenever the window's spread changes, so
          * it eases like the bars do — a line that jumps while the bars slide
          * reads as two different charts. */}
        <div
          className={cx(
            "absolute left-0 right-0 z-10 border-t border-dashed border-line-strong pointer-events-none",
            stacked && "hidden",
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
        {/* The trend, drawn OVER the bars in one SVG rather than as a
          * per-bar mark. A least-squares fit is a statement about the whole
          * window, so it has to be one continuous object crossing it — a
          * dotted sequence of per-bucket marks would read as more data.
          *
          * `preserveAspectRatio="none"` lets a 0–100 viewBox stretch to
          * whatever the column is, so the line lands on the same scale the
          * bars use without measuring the DOM. */}
        {trend && (
          <svg
            className="absolute inset-0 z-20 w-full h-full pointer-events-none overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              x1={50 / points.length}
              y1={100 - scale(trend.start) * 100}
              x2={100 - 50 / points.length}
              y2={100 - scale(trend.end) * 100}
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
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
                {stacked && p.v != null ? (
                  /* One column, segmented by station, tallest-first from the
                    * floor. A segment goes amber against ITS OWN target, not
                    * the stack's — the sum being fine does not make a
                    * smokehouse overrun fine. */
                  <span
                    className={cx("w-full rounded-[2px] overflow-hidden flex flex-col-reverse", CHART_EASE)}
                    style={{ height: `${Math.round(scale(p.v) * 100)}%` }}
                  >
                    {p.parts.map((part, pi) =>
                      part.v == null ? null : (
                        <span
                          key={part.station}
                          title={`${part.station} ${part.v} min`}
                          className={cx(
                            "w-full",
                            part.over ? "bg-warn/75" : BAND_FILL,
                            /* A hairline of the card's own background between
                              * bands. The grey shades separate themselves, but
                              * two amber bands touching merge into one block
                              * and the stack silently loses a boundary —
                              * exactly where it matters most, because that is
                              * the day two stations both went over. Drawn on
                              * every seam rather than only the amber ones, so
                              * the rule is one rule. */
                            pi > 0 && "border-b-[1.5px] border-surface"
                          )}
                          style={{ height: `${(part.v / p.v) * 100}%` }}
                        />
                      )
                    )}
                  </span>
                ) : (
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
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-1 mt-1.5">
        {points.map((p, i) => (
          <div key={p.key} className="flex-1 min-w-0 text-center leading-tight">
            {labelled && (
              <p
                className={cx(
                  "text-[11px] tnum truncate",
                  p.v == null
                    ? "text-ink-4"
                    : (stacked ? p.overTotal : p.over)
                      ? "text-warn font-medium"
                      : "text-ink-2"
                )}
              >
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

      {/* The key lives in a Popover now, the same shape Production uses for
        * its colour key. An inline legend is a permanent sentence explaining
        * marks that most readings do not need explained — and this one had
        * grown to four clauses. Behind an icon it costs nothing until asked. */}
      {!compact && station && (
        <button
          type="button"
          onClick={() => onIsolate?.(null)}
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-ink-2 hover:text-ink transition-colors"
        >
          {station} alone — show every station
        </button>
      )}
      </div>
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
/* Three formats because people take a chart away for three different reasons:
 * to do their own maths on it, to put it in a document, or to paste it in an
 * email. One format would have served one of them. */
const EXPORTS = [
  { kind: "png", label: "PNG image", note: "Paste into email or chat", icon: FileImage },
  { kind: "svg", label: "SVG vector", note: "Stays sharp at any size", icon: FileType2 },
  { kind: "csv", label: "CSV data", note: "The numbers behind the bars", icon: Sheet },
];

const BATCH_VIEWS = [
  /* "All" is the OFF position, not a filter — `resting` keeps the accent off
   * it, so blue in this control only ever means the list is narrowed. */
  { id: "all", label: "All", resting: true },
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
