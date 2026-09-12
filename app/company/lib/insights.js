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

import { LOW_YIELD_PCT, STAGE_TARGET_MINUTES, isOverTarget, yieldPct } from "../../lib/domain";

const round1 = (n) => Math.round(n * 10) / 10;
const fmtPct = (n) => (n == null ? "—" : `${n}%`);

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

  return { company, byLocation, byStation, cards: sorted };
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

