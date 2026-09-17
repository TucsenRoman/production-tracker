"use client";

/**
 * The things a manager actually asks of a window of closed batches, answered
 * from the rollups rather than from prose. Order matters: the more specific
 * keyword sets are tested first, so "which product is worst" does not fall
 * into the generic "compare" branch.
 */
function answerPeriodQuestion(ctx, q) {
  const { byProduct, byStation, stats, yearAgo, spanLabel, scopeLabel, overlaps } = ctx;
  /* Rank only what is rankable. Over a short window a product can have ONE
   * batch, and one bad batch would otherwise crown it "the weakest product"
   * — a claim about a process made from a single measurement. Thin products
   * are still reported, but as a single batch, not as a ranking. */
  const rankable = byProduct.filter((p) => p.batches >= MIN_RANK_BATCHES);
  const worst = rankable[0];
  const best = rankable[rankable.length - 1];
  const thin = byProduct.filter((p) => p.batches < MIN_RANK_BATCHES && p.avgYield < LOW_YIELD_PCT);
  const over = byStation.filter((s) => s.overCount > 0).sort((a, b) => b.overPct - a.overPct);

  const noData = () => `Nothing closed ${spanLabel} — there is nothing to read yet in this window.`;
  if (!stats.batches) return noData();

  /* "What should I look at" — the one question worth asking of a dashboard,
   * answered as the two or three things that are actually unusual. */
  if (/look at|stands? out|notable|summar|what.?s (up|wrong|going)|anything/.test(q)) {
    const notes = [];
    if (worst && rankable.length > 1 && stats.avgYield != null) {
      const gap = round1(stats.avgYield - worst.avgYield);
      if (gap >= 2) notes.push(`${b(worst.product)} is the weak spot at ${fmtPct(worst.avgYield)} over ${worst.batches} batches, ${gap} points under the ${fmtPct(stats.avgYield)} average`);
    }
    if (thin.length) {
      notes.push(
        `${thin.map((p) => `${b(p.product)} came in at ${fmtPct(p.avgYield)}`).join(" and ")} — ${
          thin.length === 1 ? "one batch, so" : "a batch or two each, so"
        } too little to call a pattern`
      );
    }
    if (over.length) {
      const s = over[0];
      notes.push(`${b(s.station)} went over its ${s.target}-minute target on ${s.overCount} of ${s.runs} run${s.runs === 1 ? "" : "s"}`);
    }
    if (stats.flagged) notes.push(`${b(stats.flagged)} of ${stats.batches} batches ${stats.flagged === 1 ? "is" : "are"} flagged`);
    if (!overlaps && yearAgo?.avgYield != null && stats.avgYield != null) {
      const d = round1(stats.avgYield - yearAgo.avgYield);
      if (Math.abs(d) >= 1) notes.push(`yield is ${Math.abs(d)} points ${d > 0 ? "up on" : "down on"} the same stretch last year`);
    }
    if (!notes.length) return `Nothing unusual ${spanLabel}: ${stats.batches} batches at ${fmtPct(stats.avgYield)}, nothing flagged, every station inside target.`;
    return `${notes[0][0].toUpperCase()}${notes[0].slice(1)}. ${notes.slice(1).map((n) => `${n[0].toUpperCase()}${n.slice(1)}.`).join(" ")}`.trim();
  }

  /* Ranking. The screen deliberately shows no leaderboard, so this is the
   * only place "which one" gets answered. */
  if (/which|worst|weak|lowest|best|strongest|highest|rank|drag/.test(q)) {
    if (rankable.length < 2) {
      const thinNote = byProduct.length
        ? ` The window holds ${byProduct.length} product${byProduct.length === 1 ? "" : "s"}, none with more than ${
            Math.max(...byProduct.map((p) => p.batches))
          } batch${Math.max(...byProduct.map((p) => p.batches)) === 1 ? "" : "es"}.`
        : "";
      return `Not enough closed batches per product ${spanLabel} to rank them — it takes ${MIN_RANK_BATCHES} to say anything about a product rather than about one batch.${thinNote} Widen the window and ask again.`;
    }
    const wantsBest = /best|strongest|highest/.test(q) && !/worst|weak|lowest|drag/.test(q);
    const pick = wantsBest ? best : worst;
    const others = (wantsBest ? [...rankable].reverse() : rankable).slice(1, 3);
    const caveat = thin.length
      ? ` (${thin.map((p) => `${p.product} ran lower at ${fmtPct(p.avgYield)}, but only ${p.batches} batch${p.batches === 1 ? "" : "es"}`).join("; ")}.)`
      : "";
    return `${b(pick.product)} is the ${wantsBest ? "strongest" : "weakest"} ${spanLabel} at ${fmtPct(pick.avgYield)} over ${pick.batches} batches${
      pick.flagged ? `, ${pick.flagged} flagged` : ""
    }. Then ${others.map((p) => `${p.product} at ${fmtPct(p.avgYield)}`).join(", ")}.${caveat}`;
  }

  /* Stations. `byStation` was computed and displayed nowhere for a while;
   * this is where it surfaces. */
  if (/station|smokehouse|packaging|over target|slow|minutes|time/.test(q)) {
    if (!byStation.length) return `No station minutes were logged ${spanLabel}.`;
    if (!over.length) {
      return `${b("Every station")} stayed inside target ${spanLabel}: ${byStation.map((s) => `${s.station} averaged ${s.avgMinutes} min against ${s.target}`).join(", ")}.`;
    }
    return over
      .map((s) => `${b(s.station)} went over its ${s.target}-minute target on ${s.overCount} of ${s.runs} run${s.runs === 1 ? "" : "s"}, averaging ${s.avgMinutes} min`)
      .join(". ") + ".";
  }

  if (/flag/.test(q)) {
    if (!stats.flagged) return `Nothing flagged ${spanLabel} — every batch closed above ${LOW_YIELD_PCT}% and inside every station target.`;
    const byProd = byProduct.filter((p) => p.flagged).map((p) => `${b(p.product)} (${p.flagged})`);
    return `${stats.flagged} of ${stats.batches} batches flagged ${spanLabel}, for low yield or slow time: ${byProd.join(", ")}.`;
  }

  if (/year|ago|last (spring|summer|fall|winter)/.test(q)) {
    if (overlaps) {
      return `This window is longer than a year, so the same stretch one year earlier overlaps it — the comparison would be partly against these very batches. Narrow it to a year or less and ask again.`;
    }
    if (!yearAgo || !yearAgo.batches) return `Nothing on record from the same stretch a year earlier to compare ${spanLabel} against.`;
    const d = stats.avgYield != null && yearAgo.avgYield != null ? round1(stats.avgYield - yearAgo.avgYield) : null;
    const yieldLine =
      d == null ? "" : Math.abs(d) < 1
        ? `Yield is ${b("where it was")}, ${fmtPct(stats.avgYield)} against ${fmtPct(yearAgo.avgYield)}`
        : `Yield is ${b(`${Math.abs(d)} points ${d > 0 ? "better" : "worse"}`)}, ${fmtPct(stats.avgYield)} against ${fmtPct(yearAgo.avgYield)}`;
    return `${yieldLine} (${stats.batches} batches against ${yearAgo.batches}).`;
  }

  if (/why|driv|cause/.test(q)) {
    if (stats.flagged && worst) {
      return `${stats.flagged} of ${stats.batches} batches were flagged, and ${b(worst.product)} carries the lowest average at ${fmtPct(worst.avgYield)}. That is where the ${fmtPct(stats.avgYield)} overall comes from.`;
    }
    return `Nothing flagged ${spanLabel}; the ${fmtPct(stats.avgYield)} average is spread evenly across ${byProduct.length} product${byProduct.length === 1 ? "" : "s"}.`;
  }

  return `${scopeLabel ? `${scopeLabel}, ` : ""}${spanLabel}: ${stats.batches} batches closed, ${fmtPct(stats.avgYield)} average yield, ${stats.flagged} flagged, across ${byProduct.length} product${
    byProduct.length === 1 ? "" : "s"
  }. I don't have a specific answer for that yet, but that is everything behind this window.`;
}

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

/**
 * EMPHASIS: bold the answer, not the numbers.
 *
 * Every answer and every command acknowledgement is written in the sliver of
 * Markdown the panel renders — `**like this**` — and the rule for what goes
 * inside it is not "the important bit" or "the figures". It is: **whatever
 * the question asked for.**
 *
 *   "show me the flagged products"   → the PRODUCT NAMES bold. Not the count.
 *   "how many were flagged?"         → the COUNT bolds. Not the names.
 *   "is Smokehouse over target?"     → the VERDICT bolds.
 *   "which product is weakest?"      → the PRODUCT bolds, not its yield.
 *   "what was the yield?"            → now the yield bolds.
 *
 * The same sentence therefore emphasises different words depending on what
 * was asked, which is the whole point: emphasis is how a reader finds the
 * answer without reading the sentence, so pointing it at a fixed part of
 * speech (numbers, say) makes it decoration instead of information.
 *
 * Three constraints that keep it that way:
 *   1. **At most one emphasis per sentence.** Two bolds is a sentence that
 *      could not decide, and a paragraph where a third of the words are bold
 *      is a paragraph with no emphasis at all.
 *   2. **Never bold a number just for being a number.** A figure bolds only
 *      when the figure IS the answer.
 *   3. **Supporting clauses stay plain**, even when they carry the more
 *      interesting number — "Charting **Smokehouse** minutes; it averaged 271
 *      against a 240-minute target" answers "show me Smokehouse", and the 271
 *      is what you then go and read.
 *
 * When a model is wired in behind this, these five lines are its instruction,
 * not a formatting preference: it phrases, the template decides the numbers,
 * and the bold marks which clause is the reply. A model that bolds every
 * figure has misunderstood the job.
 */
const b = (x) => `**${x}**`;

const round1 = (n) => Math.round(n * 10) / 10;
const fmtPct = (n) => (n == null ? "—" : `${n}%`);
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const fmtDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtRange = (w) => `${fmtDate(w.from)} and ${fmtDate(w.to)}`;

/**
 * Batches a product needs before its average is a fact about the product
 * rather than a fact about one batch. Ranking below this is how a single bad
 * run gets reported as "the weakest product".
 */
export const MIN_RANK_BATCHES = 3;

/** Days in the two windows `productHistory` compares (now vs. a year ago). */
export const HISTORY_WINDOW_DAYS = 90;
/** Months on the product history strip: a full year plus the current one. */
export const HISTORY_MONTHS = 13;

/**
 * Yield, flags and per-station minutes over a set of product rows (rows
 * already carry `y` and `flagged`). `minutes` averages only the batches that
 * actually ran the station, keyed by station name, rounded to whole minutes.
 */
export function windowStats(rows) {
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

/* ------------------------------------------------------ Page commands -- */

/**
 * The verbs that turn a question into an instruction. Asking and steering
 * are different acts and the panel has to tell them apart: "which product is
 * weakest?" wants a sentence, "show me the weakest product" wants the page
 * to change. The verb is the whole test — without one, nothing here runs and
 * the question falls through to the answerer as it always did.
 */
const COMMAND_VERB =
  /\b(show|bring|pull|display|chart|graph|plot|filter|focus|zoom|open|set|switch|drill|isolate|narrow|widen|clear|reset|view|jump|hide)(s|ed|ing)?\b|\b(take me|go to|only|just|all)\b/;

const UNIT_DAYS = { day: 1, week: 7, month: 30, year: 365 };

const listOut = (names) =>
  names.length <= 1 ? names[0] || "" : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/* "3 batchs" is the kind of thing that makes generated prose read as
 * generated. Only the sibilant rule matters here — every noun this is handed
 * is a word from the domain, not arbitrary English. */
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : /(ch|sh|s|x|z)$/.test(word) ? "es" : "s"}`;

/**
 * Turn a typed instruction into a change to the page, or null if it is not
 * one. Pure and deterministic, exactly like the answers: the model — when
 * there is one — would phrase this, never decide it, because a wrong filter
 * is a silently wrong number on every figure on screen.
 *
 * Returns `{ kind, ...payload, say }`. `say` is what the thread prints, and
 * it states what changed in the same voice as an answer, because from the
 * reader's side "filtered to Applewood Bacon" IS the answer to "bring the
 * flagged products up".
 *
 * One action per question on purpose. "Show smokehouse times for the last
 * three months" is two instructions, and guessing which half to honour is
 * worse than honouring the first and letting the second be asked.
 */
export function planPageCommand(ctx, question, options = {}) {
  const q = (question || "").toLowerCase().trim();
  if (!q || !COMMAND_VERB.test(q)) return null;

  const { byProduct = [], byStation = [], stats = {}, spanLabel = "in this window" } = ctx || {};
  const catalogue = options.products?.length ? options.products : byProduct.map((p) => p.product);
  const stations = options.stations?.length ? options.stations : byStation.map((s) => s.station);

  /* Undo comes first: "show all products" contains a product word and would
   * otherwise be read as a filter. */
  if (/\b(all|every|any|each) (the )?(product|item|s?ku)s?\b/.test(q) || /\b(clear|reset|remove|drop|unset)\w*\b.*\b(filter|selection|products?)\b/.test(q)) {
    return { kind: "filter", products: [], say: `Cleared the product filter — ${b("every product")} is back on screen.` };
  }

  /* The window. Checked before products because "show me the last 3 months"
   * is about time even when a product is named in the same breath. */
  const span = q.match(/\b(\d+)\s*(day|week|month|year)s?\b/);
  if (span && /\b(last|past|previous|recent|back|window|range|period|show|set|zoom|go|take)\b/.test(q)) {
    const days = Math.max(1, Number(span[1]) * UNIT_DAYS[span[2]]);
    return { kind: "range", days, say: `Window set to the last ${b(plural(Number(span[1]), span[2]))}.` };
  }
  if (/\ball[- ]?time\b|\b(whole|entire|full) (record|history|thing)\b|\beverything (we|you) have\b/.test(q)) {
    return { kind: "range", days: 0, say: `Window set to ${b("the whole record")}.` };
  }
  if (/\bzoom out\b|\bwiden\b|\bwider\b|\bmore (time|history)\b/.test(q)) {
    return { kind: "scale", factor: 2, say: "Widened the window." };
  }
  if (/\bzoom in\b|\bnarrow\b|\btighten\b|\bcloser\b/.test(q)) {
    return { kind: "scale", factor: 0.5, say: "Narrowed the window." };
  }

  /* The batch list. */
  if (/\b(batch list|list of batches|every batch|all (the )?batches|the batches|table|rows)\b/.test(q) && !/\bflag/.test(q)) {
    return { kind: "list", say: `Switched to the batch list — ${plural(stats.batches ?? 0, "batch")} ${spanLabel}.` };
  }

  /* The chart's series. A station named alongside a steering verb means
   * "put it on the chart"; a station named in a question about timings is
   * handled by the answerer, which has the rollups to say something. */
  const station = stations.find((s) => q.includes(s.toLowerCase()));
  if (station && !/\bover target\b|\bhow (long|many)\b|\bis .* running\b/.test(q)) {
    const s = byStation.find((x) => x.station === station);
    return {
      kind: "series",
      value: station,
      /* The station is what you asked to see; the 271 is what you then go
       * and read. One emphasis, and it is the subject. */
      say: s?.avgMinutes != null
        ? `Charting ${b(station)} minutes — it averaged ${s.avgMinutes} against a ${s.target}-minute target ${spanLabel}.`
        : `Charting ${b(station)} minutes.`,
    };
  }
  if (/\byields?\b/.test(q) && !catalogue.some((p) => q.includes(p.toLowerCase()))) {
    return { kind: "series", value: "yield", say: `Charting ${b("yield")}.` };
  }

  /* Flagged. The question in the screenshot — "bring the flagged products up
   * on screen" — which used to be answered with a sentence about them while
   * the page carried on showing everything. */
  if (/flag/.test(q)) {
    const flagged = byProduct.filter((p) => p.flagged > 0).map((p) => p.product);
    if (!flagged.length) return { kind: "none", say: `Nothing is flagged ${spanLabel}, so there is nothing to bring up.` };
    return {
      kind: "filter",
      products: flagged,
      say: `Filtered to ${listOut(flagged.map(b))} — ${plural(stats.flagged ?? 0, "flagged batch")} ${spanLabel}, all of ${
        flagged.length === 1 ? "it there" : "them there"
      }.`,
    };
  }

  /* Superlatives. Same MIN_RANK_BATCHES floor as the ranking answer: the
   * page must not be filtered down to a product on the strength of one
   * batch, because every figure on screen would then be that one batch. */
  if (/\b(weak|worst|low|drag|best|strong|top)/.test(q)) {
    const rankable = byProduct.filter((p) => p.batches >= MIN_RANK_BATCHES);
    if (rankable.length < 2) {
      return {
        kind: "none",
        say: `Not enough closed batches per product ${spanLabel} to pick one out — it takes ${MIN_RANK_BATCHES} to say anything about a product rather than about one batch. Widen the window and ask again.`,
      };
    }
    const wantsBest = /\b(best|strong|top)/.test(q) && !/\b(weak|worst|low|drag)/.test(q);
    const pick = wantsBest ? rankable[rankable.length - 1] : rankable[0];
    return {
      kind: "filter",
      products: [pick.product],
      say: `Filtered to ${b(pick.product)}, the ${wantsBest ? "strongest" : "weakest"} ${spanLabel} at ${fmtPct(pick.avgYield)} over ${plural(
        pick.batches,
        "batch"
      )}.`,
    };
  }

  /* A product by name. Longest match first, so "Snack Sticks - Honey BBQ"
   * is not shadowed by a plain "Snack Sticks". */
  const named = [...catalogue]
    .sort((a, b) => b.length - a.length)
    .filter((p) => q.includes(p.toLowerCase()))
    .filter((p, i, all) => !all.slice(0, i).some((longer) => longer.toLowerCase().includes(p.toLowerCase())));
  if (named.length) {
    return { kind: "filter", products: named, say: `Filtered to ${listOut(named.map(b))}.` };
  }

  return null;
}

/** Deterministic Q&A scoped to one insight card — reasons only over that card's own numbers. */
export function answerInsightQuestion(card, question) {
  const q = (question || "").toLowerCase();

  /* The period: everything in the window the scrubber has selected, for the
   * products the filter has selected. This is the only branch that can rank
   * products or speak about stations, because it is the only one handed the
   * rollups — which is exactly why the screen stopped printing a ranking of
   * its own and sends people here instead. */
  if (card.context.type === "period") {
    return answerPeriodQuestion(card.context, q);
  }

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

