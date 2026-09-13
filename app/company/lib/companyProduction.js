"use client";

/**
 * Per-location closed-batch history, keyed by location id. LOC-1 is the shop
 * floor's own seed history, referenced directly so the two never drift, with
 * a generated year of older closes behind it so the Insights product history
 * has a "this time last year" to compare against.
 *
 * Demo data. The generator is deterministic (fixed-seed PRNG), so every
 * fresh browser sees the same year; bump COMPANY_NS in companyStore when the
 * shape or the recipe changes, or nobody with stored state will see it.
 */

import { SEED, shiftDate, todayKey } from "../../lib/domain";

/* Per-product recipe: base yield, batch size, which stations it runs through,
 * and a yearly drift in yield points (positive = getting better), so the
 * year-over-year comparison has something honest to say per product rather
 * than the same story everywhere. */
const RECIPES = [
  { product: "Applewood Bacon", base: 74, spread: 5, weight: [50, 64], smoke: [225, 290], pack: [35, 58], drift: -3, perMonth: 4 },
  { product: "Peppered Bacon", base: 76, spread: 4, weight: [40, 50], smoke: [225, 290], pack: [30, 50], drift: 1, perMonth: 3 },
  { product: "Summer Sausage", base: 85, spread: 3, weight: [36, 46], smoke: [190, 240], pack: [30, 45], drift: 2, perMonth: 3 },
  { product: "Bratwurst - Original", base: 89, spread: 2, weight: [48, 60], smoke: null, pack: [38, 55], drift: 0, perMonth: 4 },
  { product: "Bratwurst - Jalapeño Cheddar", base: 87, spread: 3, weight: [34, 42], smoke: null, pack: [36, 50], drift: 3, perMonth: 2 },
  { product: "Bratwurst - Maple", base: 88, spread: 2, weight: [22, 30], smoke: null, pack: [30, 44], drift: 0, perMonth: 1 },
  { product: "Snack Sticks - Original", base: 84, spread: 4, weight: [24, 32], smoke: [180, 220], pack: [26, 40], drift: 1, perMonth: 2 },
  { product: "Snack Sticks - Honey BBQ", base: 86, spread: 3, weight: [26, 34], smoke: [180, 215], pack: [26, 38], drift: -1, perMonth: 2 },
  { product: "Snack Sticks - Hot", base: 83, spread: 4, weight: [20, 28], smoke: [185, 230], pack: [28, 42], drift: 4, perMonth: 2 },
  { product: "Ground Beef - 80/20", base: 96, spread: 2, weight: [40, 60], smoke: null, pack: [25, 40], drift: 0, perMonth: 3 },
];

/** Months of generated history behind the floor's own seed rows: enough
 * that the Insights "a year ago" window (90 days ending a year back) is
 * fully populated, with a little slack before it. */
const MONTHS_BACK = 16;

/* mulberry32 — small, deterministic, good enough for demo scatter. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateHistory(today) {
  const rand = prng(20240312);
  const between = ([lo, hi]) => lo + Math.round(rand() * (hi - lo));
  /* Sum of two uniforms: a soft bell, so most batches sit near `base` and the
   * odd one lands out at the edge of `spread`. */
  const jitter = (spread) => (rand() + rand() - 1) * spread;

  const rows = [];
  let n = 0;
  const earliestDay = -MONTHS_BACK * 30;
  /* Leave the floor seed's own window (the last ~16 days) to the floor seed
   * so the calendar's recent weeks stay exactly as the floor shows them. */
  const latestDay = -18;

  for (const r of RECIPES) {
    for (let m = 0; m < MONTHS_BACK; m++) {
      for (let k = 0; k < r.perMonth; k++) {
        const dayOffset = earliestDay + m * 30 + Math.floor(rand() * 30);
        if (dayOffset > latestDay) continue;
        const closedOn = shiftDate(today, dayOffset);
        if (new Date(`${closedOn}T00:00:00`).getDay() === 0) continue; // closed Sundays
        /* Drift runs linearly over the whole generated span: the oldest
         * batch sits `drift` points away from the newest. */
        const progress = (dayOffset - earliestDay) / (latestDay - earliestDay);
        const y = r.base + r.drift * (progress - 1) + jitter(r.spread);
        const boxWeight = between(r.weight);
        const finalWeight = Math.max(1, Math.round(boxWeight * (y / 100)));
        const minutes = { Packaging: between(r.pack) };
        if (r.smoke) minutes.Smokehouse = between(r.smoke);
        n += 1;
        rows.push({ id: `B-0${String(n).padStart(3, "0")}`, product: r.product, closedOn, boxWeight, finalWeight, minutes });
      }
    }
  }

  /* Newest last, the same convention as SEED.history. */
  return rows.sort((a, b) => (a.closedOn < b.closedOn ? -1 : a.closedOn > b.closedOn ? 1 : 0));
}

export const PRODUCTION_SEED = {
  "LOC-1": [...generateHistory(todayKey()), ...SEED.history],
};
