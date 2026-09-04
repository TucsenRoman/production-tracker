"use client";

/**
 * Seeded per-location production history — the batches each location has
 * closed out on the floor. Same record shape the shop floor's own history
 * uses (see ../../lib/domain.js's SEED.history), so the exact same yield
 * and time-in-station math applies unchanged; this file just gives the
 * company layer something to sum.
 *
 * In a real build this would be a live rollup fed by the floor's own data,
 * not a separate seed — it's kept standalone for now because the floor
 * domain has no concept of "which location" yet (see the note in
 * companyDomain.js). LOC-1's numbers mirror the floor demo's own history
 * exactly.
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

import { shiftDate, todayKey } from "../../lib/domain";

const T = todayKey();

export const PRODUCTION_SEED = {
  "LOC-1": [
    { id: "B-1042", product: "Applewood Bacon", closedOn: shiftDate(T, -10), boxWeight: 62, finalWeight: 47, minutes: { Smokehouse: 260, Packaging: 40 } },
    { id: "B-1041", product: "Summer Sausage", closedOn: shiftDate(T, -11), boxWeight: 40, finalWeight: 34, minutes: { Smokehouse: 210, Packaging: 38 } },
    { id: "B-1039", product: "Bratwurst - Original", closedOn: shiftDate(T, -12), boxWeight: 55, finalWeight: 49, minutes: { Packaging: 50 } },
    { id: "B-1037", product: "Bratwurst - Jalapeño Cheddar", closedOn: shiftDate(T, -13), boxWeight: 38, finalWeight: 33, minutes: { Packaging: 42 } },
    { id: "B-1036", product: "Applewood Bacon", closedOn: shiftDate(T, -14), boxWeight: 58, finalWeight: 41, minutes: { Smokehouse: 305, Packaging: 55 } },
    { id: "B-1033", product: "Snack Sticks - Honey BBQ", closedOn: shiftDate(T, -16), boxWeight: 30, finalWeight: 26, minutes: { Smokehouse: 195, Packaging: 30 } },
  ],
};
