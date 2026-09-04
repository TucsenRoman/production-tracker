"use client";

/**
 * Persistence for the company/admin console.
 *
 * Reuses the same localStorage-backed hooks as the shop floor (../../lib/store)
 * but under its own namespace, and — unlike the shared-terminal PIN session —
 * the admin session IS persisted. An owner/admin signing in on their laptop
 * expects to stay signed in, unlike a shared tablet on the floor.
 *
 * The namespace carries a version suffix on purpose: bump it (v1 -> v2, Sept
 * 2026) whenever COMPANY_SEED/PRODUCTION_SEED change shape or shrink (e.g.
 * the single-location demo cut). Without the bump, every browser that had
 * already hydrated from localStorage keeps serving its old stored copy
 * forever - the seed constants only apply the very first time a browser
 * has nothing stored yet, so editing them silently does nothing for
 * anyone who has already opened the console.
 */

import { useCallback, useEffect, useState } from "react";

const NS = "milaca.company.v2";
const key = (name) => `${NS}.${name}`;

function read(name, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(name, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    /* quota or private mode — state stays in memory for this session */
  }
}

export function usePersistentState(name, initial) {
  const [value, setValue] = useState(initial);
  // A reactive flag, not a ref (Sept 2026 fix — was `useRef(false)`). With a
  // ref, flipping `hydrated.current = true` inside the hydrate effect below
  // is visible to the write effect in the SAME commit, before the
  // `setValue(stored)` scheduled two lines up has actually landed — so on
  // first mount the write effect fired immediately with the still-stale
  // `initial` value and (since hydrated was now "true") persisted THAT over
  // whatever was really in localStorage. It self-corrects a render later in
  // most cases, but anything that unmounts this hook's owner in that
  // one-render window (a redirect effect elsewhere in the same component,
  // e.g.) commits the stale write permanently — observed live: a page that
  // checked `session` on mount and redirected away when it read as
  // logged-out (before hydration) clobbered the real session, and
  // company/users/locations right along with it, signing the whole demo
  // out. Making this state instead of a ref means its own update batches
  // together with `setValue(stored)`, so the write effect only ever
  // observes hydrated=true on a render where `value` is already the real,
  // hydrated one — no stale write, ever.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = read(name, undefined);
    if (stored !== undefined) setValue(stored);
    setHydrated(true);
  }, [name]);

  useEffect(() => {
    if (hydrated) write(name, value);
  }, [name, value, hydrated]);

  return [value, setValue];
}

export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

/**
 * Admin/owner session — persisted, since this is an account login rather than
 * a shared-terminal PIN. `demo: true` marks it clearly as simulated auth: no
 * password is ever actually verified against a server.
 */
export function useCompanySession() {
  const [session, setSession] = usePersistentState("session", null);

  const signIn = useCallback((user) => setSession({ userId: user.id, email: user.email }), [setSession]);
  const signOut = useCallback(() => setSession(null), [setSession]);

  return { session, signIn, signOut };
}
