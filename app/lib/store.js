"use client";

/**
 * Client-side persistence for the shop floor.
 *
 * Work entered on the floor survives a refresh, a tab close, or a tablet going
 * to sleep — a shift's worth of state is never lost to a reload. This is the
 * seam to swap for a real API: same hook signature, different transport.
 *
 * The hook itself lives in ./persistence.js and is shared with the console's
 * own store (../company/lib/companyStore) — see that file for the hydration
 * and cross-tab rules. All this module decides is the namespace.
 */

import { createStore } from "./persistence";

/** The floor's namespace. Exported so anything reaching across to it names
 *  one constant rather than retyping the string — the drift that broke the
 *  station bridge started as a hand-copied key. */
export const FLOOR_NS = "milaca.production.v1";

const store = createStore(FLOOR_NS);

export const { usePersistentState, useHydrated, clearAll } = store;

/* `useSession` lived here — an in-memory, deliberately unpersisted identity,
 * so a shared terminal signed itself out. The terminal has no sign-in at all
 * now (the iPad's passcode is the lock) and nothing has imported it since.
 * The console keeps its own persisted session in ../company/lib/companyStore,
 * which is a different thing for a different reason: an admin on their own
 * laptop expects to stay signed in. */
