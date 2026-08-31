"use client";

/**
 * Seeded per-location production history — the batches each location has
 * closed out on the floor. Same record shape the shop floor's own history
 * uses (see ../../lib/domain.js's SEED.history), so the exact same yield
 * and time-in-station math applies unchanged; this file just gives the
 * company layer something to sum and compare across locations.
 *
 * In a real build this would be a live rollup fed by each location's floor
 * data, not a separate seed — it's kept standalone for now because the
 * floor domain has no concept of "which location" yet (see the note in
 * companyDomain.js). LOC-1's numbers mirror the floor demo's own history
 * exactly; LOC-2 is new, and deliberately tells a worse story so the
 * company-wide comparison has something real to point at.
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
  "LOC-2": [
    { id: "F-2201", product: "Applewood Bacon", closedOn: shiftDate(T, -9), boxWeight: 60, finalWeight: 42, minutes: { Smokehouse: 250, Packaging: 58 } },
    { id: "F-2198", product: "Bratwurst - Original", closedOn: shiftDate(T, -10), boxWeight: 50, finalWeight: 41, minutes: { Packaging: 47 } },
    { id: "F-2195", product: "Summer Sausage", closedOn: shiftDate(T, -13), boxWeight: 38, finalWeight: 27, minutes: { Smokehouse: 300, Packaging: 55 } },
    { id: "F-2190", product: "Snack Sticks - Hot", closedOn: shiftDate(T, -15), boxWeight: 24, finalWeight: 19, minutes: { Smokehouse: 230, Packaging: 44 } },
    { id: "F-2187", product: "Bratwurst - Maple", closedOn: shiftDate(T, -18), boxWeight: 26, finalWeight: 17, minutes: { Packaging: 60 } },
  ],
};
