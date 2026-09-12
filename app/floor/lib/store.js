"use client";

/**
 * Client-side persistence for the shop floor. This is the seam to swap for a
 * real API: same hook signature, different transport. The hook lives in
 * ../../lib/persistence.js; this module only decides the namespace.
 */

import { createStore } from "../../lib/persistence";

/** Exported so anything reaching across names one constant, not a retyped string. */
export const FLOOR_NS = "milaca.production.v1";

const store = createStore(FLOOR_NS);

export const { usePersistentState, useHydrated, clearAll } = store;
