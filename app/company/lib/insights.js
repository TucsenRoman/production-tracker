"use client";

/**
 * Company-wide insight generation: the floor's yield/target math, applied to
 * compare locations and stations against each other.
 *
 * Card text is template-generated from computed numbers — no LLM is wired in.
 * Every card carries a `context` bundle with the numbers behind it, so
 * answerInsightQuestion can answer follow-ups without inventing anything, and
 * a real model call could replace it later with the same signature.
 */

import { LOW_YIELD_PCT, STAGE_TARGET_MINUTES, isOverTarget, shiftDate, todayKey, yieldPct } from "../../lib/domain";

const round1 = (n) => Math.round(n * 10) / 10;
const fmtPct = (n) => (n == null ? "—" : `${n}%`);
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const fmtDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtRange = (w) => `${fmtDate(w.from)} and ${fmtDate(w.to)}`;

/** Days in the two windows `productHistory` compares (now vs. a year ago). */
export const HISTORY_WINDOW_DAYS = 90;
/** Months on the product history strip: a full year plus the current one. */
export const HISTORY_MONTHS = 13;

/**
 * Yield, flags and per-station minutes over a set of product rows (rows
 * already carry `y` and `flagged`). `minutes` averages only the batches that
 * actually ran the station, keyed by station name, rounded to whole minutes.
 */
function windowStats(rows) {
  const perStation = {};
  for (const r of rows) {
    for (const [s, m] of Object.entries(r.minutes || {})) {
      if (m == null) continue;
      (perStation[s] ||= []).push(m);
    }
  }
  const minutes = Object.fromEntries(Object.entries(perStation).map(([s, list]) => [s, Math.round(mean(list))]));
  const avg = mean(rows.map((r) => r.y));
  return {
    batches: rows.length,
    avgYield: avg == null ? null : round1(avg),
    flagged: rows.filter((r) => r.flagged).length,
    minutes,
  };
}

/**
 * One product's long run: a month-by-month strip over the last
 * HISTORY_MONTHS and a "now vs. a year ago" comparison of two equal windows,
 * the last HISTORY_WINDOW_DAYS against the same days one year earlier. The
 * windows are what the "a year ago" question answers from; the months are
 * what the panel draws. Rows are the panel's product rows (with `y` and
 * `flagged`), in any order.
 */
export function productHistory(rows, today = todayKey()) {
  const months = [];
  const first = new Date(`${today.slice(0, 7)}-01T00:00:00`);
  for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
    const d = new Date(first);
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    const inMonth = rows.filter((r) => r.closedOn && r.closedOn.slice(0, 7) === key);
    months.push({
      key,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      year: d.getFullYear(),
      ...windowStats(inMonth),
    });
  }

  const recentFrom = shiftDate(today, -(HISTORY_WINDOW_DAYS - 1));
  const yearAgoTo = shiftDate(today, -365);
  const yearAgoFrom = shiftDate(recentFrom, -365);
  const inRange = (from, to) => rows.filter((r) => r.closedOn && r.closedOn >= from && r.closedOn <= to);

  const stations = [...new Set(rows.flatMap((r) => Object.keys(r.minutes || {})))];

  return {
    months,
    stations,
    recent: { from: recentFrom, to: today, ...windowStats(inRange(recentFrom, today)) },
    yearAgo: { from: yearAgoFrom, to: yearAgoTo, ...windowStats(inRange(yearAgoFrom, yearAgoTo)) },
  };
}

/**
 * A closed batch worth flagging: low yield, or any station over target.
 * Exported so the Insights chart colours points by the same predicate
 * `locationStats` counts with.
 */
export function isFlaggedBatch(h, targets = {}) {
  const y = yieldPct(h.boxWeight, h.finalWeight);
  const slow = Object.keys(h.minutes || {}).some((s) => isOverTarget(s, h.minutes[s], targets));
  return (y != null && y < LOW_YIELD_PCT) || slow;
}

export function locationStats(history, targets = {}) {
  const yields = history.map((h) => yieldPct(h.boxWeight, h.finalWeight)).filter((v) => v != null);
  const avgYield = yields.length ? round1(yields.reduce((a, b) => a + b, 0) / yields.length) : null;
  const flagged = history.filter((h) => isFlaggedBatch(h, targets));
  return { batches: history.length, avgYield, flagged: flagged.length };
}

/**
 * Closed-batch history grouped by product, worst average yield first — the
 * question `locationStats` doesn't answer: not "which shop" but "which
 * item". Same shape as a location row (`batches`/`avgYield`/`flagged`) plus
 * `product` and a `low`/`high` spread so a manager can see how wide a
 * product's own results run, not just its average.
 */
export function productStats(history, targets = {}) {
  const byProduct = new Map();
  for (const h of history) {
    const y = yieldPct(h.boxWeight, h.finalWeight);
    if (y == null) continue;
    const list = byProduct.get(h.product);
    if (list) list.push(h);
    else byProduct.set(h.product, [h]);
  }

  return Array.from(byProduct.entries())
    .map(([product, batches]) => {
      const yields = batches.map((h) => yieldPct(h.boxWeight, h.finalWeight));
      const avgYield = round1(yields.reduce((a, b) => a + b, 0) / yields.length);
      const flagged = batches.filter((h) => isFlaggedBatch(h, targets)).length;
      return {
        product,
        batches: batches.length,
        avgYield,
        flagged,
        low: Math.min(...yields),
        high: Math.max(...yields),
      };
    })
    .sort((a, b) => a.avgYield - b.avgYield);
}

function stationStats(production, locations, station, targets = {}) {
  const perLocation = locations.map((loc) => {
    const history = production[loc.id] || [];
    const runs = history.filter((h) => h.minutes && h.minutes[station] != null);
    const over = runs.filter((h) => isOverTarget(station, h.minutes[station], targets));
    return {
      locationId: loc.id,
      name: loc.name,
      runs: runs.length,
      overCount: over.length,
      overPct: runs.length ? over.length / runs.length : 0,
    };
  });
  const runs = perLocation.reduce((a, l) => a + l.runs, 0);
  const overCount = perLocation.reduce((a, l) => a + l.overCount, 0);
  return {
    station,
    target: targets[station] ?? STAGE_TARGET_MINUTES[station],
    runs,
    overCount,
    overPct: runs ? overCount / runs : 0,
    perLocation,
  };
}

const TONE_RANK = { danger: 0, warn: 1, ok: 2, neutral: 3 };

export function buildCompanyInsights({ locations, stations, production, targets = {} }) {
  const byLocation = locations.map((loc) => ({
    locationId: loc.id,
    name: loc.name,
    ...locationStats(production[loc.id] || [], targets),
  }));

  const allHistory = locations.flatMap((loc) => production[loc.id] || []);
  const company = locationStats(allHistory, targets);
  const byProduct = productStats(allHistory, targets);

  const byStation = stations.map((s) => stationStats(production, locations, s, targets));

  // Scoped views (a floor manager sees just their own location) get
  // location-specific wording instead of the company-wide phrasing below.
  const singleLocation = locations.length === 1 ? locations[0] : null;

  const cards = [];

  if (company.batches > 0) {
    cards.push({
      id: "overall",
      tone: "neutral",
      title: singleLocation
        ? `${company.batches} batches closed at ${singleLocation.name}`
        : `${company.batches} batches closed company-wide`,
      detail: singleLocation
        ? `Averaging ${fmtPct(company.avgYield)} yield.`
        : `Averaging ${fmtPct(company.avgYield)} yield across every location.`,
      context: { type: "overall", company, byLocation },
    });
  }

  // Only locations that deviate, and compared against the OTHER locations'
  // average, not the company blend: a location's own numbers dilute the
  // blend (with two locations, only half the real gap would show).
  byLocation.forEach((loc) => {
    if (loc.avgYield == null || loc.batches < 2) return;
    const peers = byLocation.filter((l) => l.locationId !== loc.locationId && l.avgYield != null && l.batches >= 2);
    if (!peers.length) return;
    const peerAvg = round1(peers.reduce((a, l) => a + l.avgYield, 0) / peers.length);
    const delta = round1(loc.avgYield - peerAvg);
    if (Math.abs(delta) < 5) return;
    const behind = delta < 0;
    cards.push({
      id: `loc-${loc.locationId}`,
      tone: behind ? "warn" : "ok",
      title: behind ? `${loc.name}'s yield is trailing the rest of the company` : `${loc.name} is running ahead of the rest of the company`,
      detail: `${fmtPct(loc.avgYield)} average yield, ${Math.abs(delta)} points ${behind ? "below" : "above"} the ${fmtPct(peerAvg)} average everywhere else.`,
      context: { type: "location", loc, company, byLocation, peerAvg },
    });
  });

  // Stations over target often enough to flag, naming where it's concentrated.
  byStation.forEach((st) => {
    if (st.runs < 3 || st.overPct < 0.4) return;
    const active = st.perLocation.filter((l) => l.runs > 0);
    const worst = [...active].sort((a, b) => b.overPct - a.overPct)[0];
    const concentrated = worst && active.length > 1 && worst.overPct - st.overPct > 0.2;
    cards.push({
      id: `station-${st.station}`,
      tone: "warn",
      title: singleLocation
        ? `${st.station} is running over target at ${singleLocation.name}`
        : `${st.station} is running over target company-wide`,
      detail: `${st.overCount} of ${st.runs} runs went over the ${st.target}-minute target${
        singleLocation
          ? ""
          : concentrated
          ? `, mostly at ${worst.name}`
          : " — spread fairly evenly across locations"
      }.`,
      context: { type: "station", st },
    });
  });

  const sorted = [
    ...cards.filter((c) => c.id === "overall"),
    ...cards.filter((c) => c.id !== "overall").sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]),
  ];

  return { company, byLocation, byProduct, byStation, cards: sorted };
}

/** Deterministic Q&A scoped to one insight card — reasons only over that card's own numbers. */
export function answerInsightQuestion(card, question) {
  const q = (question || "").toLowerCase();

  if (card.context.type === "location") {
    const { loc, peerAvg, byLocation } = card.context;
    if (/why|driv|cause/.test(q)) {
      return `${loc.name} closed ${loc.batches} batch${loc.batches === 1 ? "" : "es"}, ${loc.flagged} flagged for low yield or slow time, averaging ${fmtPct(loc.avgYield)} against ${fmtPct(peerAvg)} everywhere else.`;
    }
    if (/compare|other|vs\.?|versus|rank/.test(q)) {
      const others = byLocation.filter((l) => l.locationId !== loc.locationId && l.avgYield != null);
      if (!others.length) return `There's no other location with enough closed batches yet to compare ${loc.name} against.`;
      const best = [...others].sort((a, b) => (b.avgYield ?? 0) - (a.avgYield ?? 0))[0];
      return `${best.name} is the strongest comparison point right now at ${fmtPct(best.avgYield)} average yield, versus ${loc.name}'s ${fmtPct(loc.avgYield)}.`;
    }
    if (/trend|improv|wors|getting/.test(q)) {
      return `Not enough closed batches yet at ${loc.name} to call a trend with confidence — check back after a few more close out.`;
    }
    return `${loc.name}: ${loc.batches} batches closed, ${fmtPct(loc.avgYield)} average yield, ${loc.flagged} flagged. I don't have a specific answer for that yet, but that's everything behind this card.`;
  }

  if (card.context.type === "station") {
    const { st } = card.context;
    const active = st.perLocation.filter((l) => l.runs > 0);
    if (/why|driv|cause/.test(q)) {
      const lines = active.sort((a, b) => b.overPct - a.overPct).map((l) => `${l.name} (${l.overCount}/${l.runs})`).join(", ");
      return `${st.overCount} of ${st.runs} ${st.station} runs went over the ${st.target}-minute target. By location: ${lines}.`;
    }
    if (/compare|other|vs\.?|versus/.test(q)) {
      const sortedLocs = [...active].sort((a, b) => a.overPct - b.overPct);
      if (sortedLocs.length < 2) return `There's only one location with ${st.station} runs logged so far.`;
      const bestL = sortedLocs[0];
      const worstL = sortedLocs[sortedLocs.length - 1];
      return `${bestL.name} is tightest at ${st.station} (${bestL.overCount}/${bestL.runs} over target); ${worstL.name} is loosest (${worstL.overCount}/${worstL.runs}).`;
    }
    return `${st.station}: ${st.overCount} of ${st.runs} runs over the ${st.target}-minute target, company-wide. I don't have a specific answer for that yet, but that's everything behind this card.`;
  }

  if (card.context.type === "day") {
    const { batches, avgY, flaggedCount, companyAvg } = card.context;
    if (/why|driv|cause/.test(q)) {
      if (flaggedCount > 0) {
        const names = batches.filter((b) => b.flagged).map((b) => b.product).join(", ");
        return `${flaggedCount} of ${batches.length} batch${batches.length === 1 ? "" : "es"} that day ${
          flaggedCount === 1 ? "was" : "were"
        } flagged for low yield or slow time: ${names}.`;
      }
      return `Nothing flagged that day — every batch closed within target.`;
    }
    if (/compare|other|vs\.?|versus|average|typical/.test(q)) {
      if (avgY == null || companyAvg == null) return `Not enough data yet to compare this day to the average.`;
      const delta = round1(avgY - companyAvg);
      if (Math.abs(delta) < 1) return `${fmtPct(avgY)} average yield that day — right in line with the ${fmtPct(companyAvg)} overall average.`;
      return `${fmtPct(avgY)} average yield that day, ${Math.abs(delta)} points ${delta > 0 ? "above" : "below"} the ${fmtPct(companyAvg)} overall average.`;
    }
    return `${batches.length} batch${batches.length === 1 ? "" : "es"} closed, ${fmtPct(avgY)} average yield, ${flaggedCount} flagged. I don't have a specific answer for that yet, but that's everything behind this day.`;
  }

  if (card.context.type === "product") {
    const { product, rows, avgY, flaggedCount, companyAvg, history } = card.context;
    /* Checked before "trend": "last year" contains no trend keyword, but
     * "how does this compare to a year ago" would otherwise hit "compare". */
    if (/year|ago|last (spring|summer|fall|winter)/.test(q) && history) {
      const { recent, yearAgo } = history;
      if (!yearAgo.batches) {
        return `No ${product} batches closed between ${fmtRange(yearAgo)} — nothing on record from a year ago to compare against.`;
      }
      if (!recent.batches) {
        return `A year ago ${product} averaged ${fmtPct(yearAgo.avgYield)} over ${yearAgo.batches} batch${yearAgo.batches === 1 ? "" : "es"} (${fmtRange(yearAgo)}), but nothing has closed in the last ${HISTORY_WINDOW_DAYS} days to compare.`;
      }
      const delta = round1(recent.avgYield - yearAgo.avgYield);
      const yieldLine =
        Math.abs(delta) < 1
          ? `Yield is where it was: ${fmtPct(recent.avgYield)} over the last ${HISTORY_WINDOW_DAYS} days against ${fmtPct(yearAgo.avgYield)} the same stretch last year`
          : `Yield is ${Math.abs(delta)} points ${delta > 0 ? "better" : "worse"} than a year ago: ${fmtPct(recent.avgYield)} over the last ${HISTORY_WINDOW_DAYS} days against ${fmtPct(yearAgo.avgYield)} the same stretch last year`;
      const stationLines = Object.keys(recent.minutes)
        .filter((s) => yearAgo.minutes[s] != null)
        .map((s) => {
          const d = recent.minutes[s] - yearAgo.minutes[s];
          if (Math.abs(d) < 3) return `${s} is holding at about ${recent.minutes[s]} min`;
          return `${s} is ${Math.abs(d)} min ${d < 0 ? "faster" : "slower"} (${recent.minutes[s]} vs ${yearAgo.minutes[s]})`;
        });
      return `${yieldLine} (${recent.batches} vs ${yearAgo.batches} batches).${stationLines.length ? ` ${stationLines.join("; ")}.` : ""}`;
    }
    if (/why|driv|cause/.test(q)) {
      if (flaggedCount > 0) {
        const dates = rows.filter((r) => r.flagged).map((r) => `${r.closedOn} (${r.y}%)`).join(", ");
        return `${flaggedCount} of ${rows.length} ${product} batch${rows.length === 1 ? "" : "es"} ${
          flaggedCount === 1 ? "was" : "were"
        } flagged for low yield or slow time: ${dates}.`;
      }
      return `Nothing flagged for ${product} — every batch closed above ${LOW_YIELD_PCT}% and within target.`;
    }
    if (/trend|improv|wors|getting/.test(q)) {
      /* Real trend here, unlike a location: the rows ARE the series. First
       * half against second half, in date order — crude, but honest with
       * the handful of batches a product usually has. */
      if (rows.length < 4) {
        return `Only ${rows.length} ${product} batch${rows.length === 1 ? "" : "es"} closed so far — too few to call a trend. Check back after a couple more.`;
      }
      const half = Math.floor(rows.length / 2);
      const avg = (list) => round1(list.reduce((a, r) => a + r.y, 0) / list.length);
      const early = avg(rows.slice(0, half));
      const late = avg(rows.slice(rows.length - half));
      const delta = round1(late - early);
      if (Math.abs(delta) < 1) return `Flat: the latest ${half} ${product} batches average ${fmtPct(late)}, about the same as the earlier ${half} at ${fmtPct(early)}.`;
      return `${delta > 0 ? "Improving" : "Slipping"}: the latest ${half} ${product} batches average ${fmtPct(late)}, ${Math.abs(delta)} points ${
        delta > 0 ? "above" : "below"
      } the earlier ${half} at ${fmtPct(early)}.`;
    }
    if (/compare|other|vs\.?|versus|average|typical/.test(q)) {
      if (avgY == null || companyAvg == null) return `Not enough data yet to compare ${product} to the average.`;
      const delta = round1(avgY - companyAvg);
      if (Math.abs(delta) < 1) return `${product} averages ${fmtPct(avgY)} — right in line with the ${fmtPct(companyAvg)} average across everything.`;
      return `${product} averages ${fmtPct(avgY)}, ${Math.abs(delta)} points ${delta > 0 ? "above" : "below"} the ${fmtPct(companyAvg)} average across everything.`;
    }
    return `${product}: ${rows.length} batch${rows.length === 1 ? "" : "es"} closed, ${fmtPct(avgY)} average yield, ${flaggedCount} flagged. I don't have a specific answer for that yet, but that's everything behind this product.`;
  }

  // "overall"
  const { company, byLocation } = card.context;
  const singleLocation = byLocation.length === 1 ? byLocation[0] : null;
  if (/why|driv|cause/.test(q)) {
    if (singleLocation) {
      return `That's everything closed at ${singleLocation.name} — there's only one location in view here, so there's nothing to compare it against.`;
    }
    const worst = [...byLocation].filter((l) => l.avgYield != null).sort((a, b) => (a.avgYield ?? 0) - (b.avgYield ?? 0))[0];
    return worst ? `${worst.name} is pulling the average down the most, at ${fmtPct(worst.avgYield)}.` : "Not enough closed batches yet to point at a specific driver.";
  }
  return singleLocation
    ? `${company.batches} batches closed at ${singleLocation.name}, ${fmtPct(company.avgYield)} average yield, ${company.flagged} flagged. I don't have a specific answer for that yet, but that's everything behind this card.`
    : `${company.batches} batches closed company-wide, ${fmtPct(company.avgYield)} average yield, ${company.flagged} flagged. I don't have a specific answer for that yet, but that's everything behind this card.`;
}

