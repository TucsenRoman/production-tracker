"use client";

/**
 * Persistence for the company/admin console.
 *
 * Same hook as the shop floor (../../lib/persistence) under its own
 * namespace, but — unlike the shared-terminal approval PINs — the admin
 * session IS persisted. An owner/admin signing in on their laptop expects to
 * stay signed in, unlike a shared tablet on the floor.
 *
 * The namespace carries a version suffix on purpose: bump it (v3 -> v4, Sept
 * 2026) whenever COMPANY_SEED/PRODUCTION_SEED change shape or shrink (e.g.
 * the single-location demo cut). Without the bump, every browser that had
 * already hydrated from localStorage keeps serving its old stored copy
 * forever — the seed constants only apply the very first time a browser has
 * nothing stored yet, so editing them silently does nothing for anyone who
 * has already opened the console.
 *
 * WHEN YOU BUMP IT, bump only this constant. Everything that reads company
 * state from outside the console — the floor's roster, its station list, its
 * permission checks — imports `COMPANY_NS` or this hook rather than spelling
 * the key out, precisely because a hand-copied `milaca.company.v2...` string
 * in app/lib/sharedStations.js survived the last bump and quietly cut the
 * floor off from every station the console had.
 */

import { useCallback } from "react";

import { createStore } from "../../lib/persistence";

export const COMPANY_NS = "milaca.company.v4";

const store = createStore(COMPANY_NS);

export const { usePersistentState, useHydrated, clearAll } = store;

/**
 * Admin/owner session — persisted, since this is an account login rather than
 * a shared-terminal PIN. No password is ever actually verified against a
 * server; this is simulated auth.
 */
export function useCompanySession() {
  const [session, setSession] = usePersistentState("session", null);

  const signIn = useCallback((user) => setSession({ userId: user.id, email: user.email }), [setSession]);
  const signOut = useCallback(() => setSession(null), [setSession]);

  return { session, signIn, signOut };
}
