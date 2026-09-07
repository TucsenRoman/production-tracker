"use client";

/**
 * Per-location production history — the batches each location has closed
 * out on the floor. Same record shape the shop floor's own history uses
 * (../../lib/domain.js's SEED.history), because it IS that history: this
 * used to be a hand-copied duplicate of those same six records (drifted
 * the moment either copy was edited without the other), which is exactly
 * backwards for a single-location demo where LOC-1 always meant "the shop
 * floor" anyway. Referencing SEED.history directly makes that explicit —
 * one seed, read from two places, instead of one seed and a stale echo of it.
 *
 * In a real build this would be a live rollup fed by the floor's own data,
 * not a seed at all — the floor domain has no concept of "which location"
 * yet (see the note in companyDomain.js), so a real multi-location build
 * would still need to key incoming batches by location somewhere.
 *
 * Single-location demo (Sept 2026): this used to also carry a "LOC-2"
 * entry for a second location ("Foreston Depot") so the console had a real
 * cross-location comparison to show. The demo is now set up as a single-
 * location business instead — every screen that branched on
 * `locations.length` already had a single-location path (a floor manager's
 * own view was always scoped to just their location), so removing the
 * second location here needed no changes to any of the comparison logic,
 * just less data for it to run on.
 */

import { SEED } from "../../lib/domain";

export const PRODUCTION_SEED = {
  "LOC-1": SEED.history,
};
