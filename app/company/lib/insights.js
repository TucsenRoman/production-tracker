"use client";

/**
 * Company-wide insight generation — the enterprise-scope counterpart to the
 * shop floor's InsightsScreen. Same underlying math (yieldPct, isOverTarget,
 * the same LOW_YIELD_PCT / STAGE_TARGET_MINUTES thresholds the floor uses),
 * but instead of one location's flat batch list, this compares locations
 * and stations against each other — a capability a single floor screen
 * structurally can't have, and the actual point of rolling this up.
 *
 * Card text is template-generated from real computed numbers, not a live
 * model call — there's no LLM wired into this project yet. Every card
 * carries a `context` bundle with the numbers behind it, so a follow-up
 * question can be answered on demand (see answerInsightQuestion /
 * answerCompanyQuestion below) without inventing anything. Swapping either
 * responder for a real model call later — same signature, same context
 * bundle as the prompt — wouldn't require touching anything upstream.
 */

import { LOW_YIELD_PCT, STAGE_TARGET_MINUTES, isOverTarget, yieldPct } from "../../lib/domain";

const round1 = (n) => Math.round(n * 10) / 10;
const fmtPct = (n) => (n == null ? "—" : `${n}%`);

function locationStats(history) {
  const yields = history.map((h) => yieldPct(h.boxWeight, h.finalWeight)).filter((v) => v != null);
  const avgYield = yields.length ? round1(yields.reduce((a, b) => a + b, 0) / yields.length) : null;
  const flagged = history.filter((h) => {
    const y = yieldPct(h.boxWeight, h.finalWeight);
    const slow = Object.keys(h.minutes || {}).some((s) => isOverTarget(s, h.minutes[s]));
    return (y != null && y < LOW_YIELD_PCT) || slow;
  });
  return { batches: history.length, avgYield, flagged: flagged.length };
}

function stationStats(production, locations, station) {
  const perLocation = locations.map((loc) => {
    const history = production[loc.id] || [];
    const runs = history.filter((h) => h.minutes && h.minutes[station] != null);
    const over = runs.filter((h) => isOverTarget(station, h.minutes[station]));
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
    target: STAGE_TARGET_MINUTES[station],
    runs,
    overCount,
    overPct: runs ? overCount / runs : 0,
    perLocation,
  };
}

const TONE_RANK = { danger: 0, warn: 1, ok: 2, neutral: 3 };

export function buildCompanyInsights({ locations, stations, production }) {
  const byLocation = locations.map((loc) => ({
    locationId: loc.id,
    name: loc.name,
    ...locationStats(production[loc.id] || []),
  }));

  const allHistory = locations.flatMap((loc) => production[loc.id] || []);
  const company = locationStats(allHistory);

  const byStation = stations.map((s) => stationStats(production, locations, s));

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

  // Only locations that actually deviate from the company average — not
  // every location, every time, which would just be noise. Compared against
  // every OTHER location's average, not the company blend — a location's
  // own numbers are part of that blend, which dilutes exactly the gap
  // we're trying to surface (worse the fewer locations there are: with
  // just two, comparing to a blended average only ever shows half the real
  // gap between them).
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

  // A station running over target often enough, company-wide, to be worth
  // flagging — and naming where it's concentrated when it's uneven.
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

/** Deterministic Q&A over the whole company — locations, team, POS, PINs, and the insights bundle. */
export function answerCompanyQuestion({ company, locations, users, crewPins, integrations, insights }, question) {
  const q = (question || "").toLowerCase();
  const activeUsers = users.filter((u) => u.status === "active");
  const invited = users.filter((u) => u.status === "invited");
  const connected = new Set(integrations.filter((i) => i.status === "connected").map((i) => i.locationId));

  if (/yield|perform/.test(q)) {
    return `Company-wide average yield is ${fmtPct(insights.company.avgYield)} across ${insights.company.batches} closed batches, with ${insights.company.flagged} flagged for low yield or slow time.`;
  }
  if (/pos|clover|connect/.test(q)) {
    const missing = locations.filter((l) => !connected.has(l.id));
    return missing.length === 0
      ? "Every location is connected to a POS."
      : `${connected.size} of ${locations.length} locations are connected. Missing: ${missing.map((l) => l.name).join(", ")}.`;
  }
  if (/worst|behind|trail/.test(q)) {
    const worst = [...insights.byLocation].filter((l) => l.avgYield != null).sort((a, b) => (a.avgYield ?? 0) - (b.avgYield ?? 0))[0];
    return worst ? `${worst.name} is trailing at ${fmtPct(worst.avgYield)} average yield.` : "Not enough closed batches yet to say.";
  }
  if (/best|top|ahead|lead/.test(q)) {
    const best = [...insights.byLocation].filter((l) => l.avgYield != null).sort((a, b) => (b.avgYield ?? 0) - (a.avgYield ?? 0))[0];
    return best ? `${best.name} is leading at ${fmtPct(best.avgYield)} average yield.` : "Not enough closed batches yet to say.";
  }
  if (/location/.test(q)) {
    return `${company.name} runs ${locations.length} location${locations.length === 1 ? "" : "s"}${
      locations.length ? `: ${locations.map((l) => l.name).join(", ")}` : ""
    }.`;
  }
  if (/team|staff|admin|manager|invit/.test(q)) {
    return `${activeUsers.length} active team member${activeUsers.length === 1 ? "" : "s"}${
      invited.length ? `, ${invited.length} pending invite${invited.length === 1 ? "" : "s"}` : ""
    }.`;
  }
  if (/pin|code|station/.test(q)) {
    const stationPins = crewPins.filter((p) => p.role === "station").length;
    const leadPins = crewPins.filter((p) => p.role === "lead").length;
    return `${stationPins} station device code${stationPins === 1 ? "" : "s"} issued and ${leadPins} lead PIN${leadPins === 1 ? "" : "s"} across the company.`;
  }
  return "I can answer questions about yield, POS connections, locations, team, and PINs from what's set up so far — try rephrasing, or ask about one of those.";
}
