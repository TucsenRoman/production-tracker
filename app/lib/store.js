"use client";

/**
 * Client-side persistence.
 *
 * Work entered on the floor survives a refresh, a tab close, or a tablet going
 * to sleep — a shift's worth of state is never lost to a reload. This is the
 * seam to swap for a real API: same hook signature, different transport.
 */

import { useCallback, useEffect, useState } from "react";

const NS = "milaca.production.v1";
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

/**
 * Like useState, but hydrated from localStorage after mount so server and
 * client render the same markup on the first pass.
 */
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

/** True once localStorage has been read, so screens can hold their skeleton. */
export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

export function clearAll() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(NS))
    .forEach((k) => window.localStorage.removeItem(k));
}

/** Session identity is deliberately not persisted — shared terminals sign out. */
export function useSession() {
  const [user, setUser] = useState(null);
  const signIn = useCallback((staff) => setUser(staff), []);
  const signOut = useCallback(() => setUser(null), []);
  return { user, signIn, signOut };
}
