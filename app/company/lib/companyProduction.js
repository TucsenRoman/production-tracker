"use client";

/**
 * Per-location closed-batch history, keyed by location id. LOC-1 is the shop
 * floor's own seed history, referenced directly so the two never drift.
 */

import { SEED } from "../../lib/domain";

export const PRODUCTION_SEED = {
  "LOC-1": SEED.history,
};
