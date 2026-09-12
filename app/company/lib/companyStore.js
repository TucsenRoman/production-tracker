"use client";

/**
 * Persistence for the admin console: the shared persistence hook under its
 * own namespace. Unlike the floor's approval PINs, the admin session is
 * persisted — an admin on their laptop expects to stay signed in.
 *
 * Bump the namespace version whenever COMPANY_SEED/PRODUCTION_SEED change
 * shape: seeds only apply when a browser has nothing stored, so editing them
 * does nothing for anyone who has already opened the console. Everything
 * outside the console must import `COMPANY_NS` rather than spell the key out,
 * or it silently detaches on the next bump.
 */

import { useCallback } from "react";

import { createStore } from "../../lib/persistence";

export const COMPANY_NS = "milaca.company.v4";

const store = createStore(COMPANY_NS);

export const { usePersistentState, useHydrated, clearAll } = store;

/** Persisted admin session. Simulated auth — no password is verified. */
export function useCompanySession() {
  const [session, setSession] = usePersistentState("session", null);

  const signIn = useCallback((user) => setSession({ userId: user.id, email: user.email }), [setSession]);
  const signOut = useCallback(() => setSession(null), [setSession]);

  return { session, signIn, signOut };
}
