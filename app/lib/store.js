"use client";

/**
 * Client-side persistence.
 *
 * Work entered on the floor survives a refresh, a tab close, or a tablet going
 * to sleep — a shift's worth of state is never lost to a reload. This is the
 * seam to swap for a real API: same hook signature, different transport.
 */

import { useCallback, useEffect, useRef, useState } from "react";

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
  const hydrated = useRef(false);

  useEffect(() => {
    const stored = read(name, undefined);
    if (stored !== undefined) setValue(stored);
    hydrated.current = true;
  }, [name]);

  useEffect(() => {
    if (hydrated.current) write(name, value);
  }, [name, value]);

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
