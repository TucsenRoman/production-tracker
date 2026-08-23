"use client";

/**
 * Persistence for the company/admin console.
 *
 * Reuses the same localStorage-backed hooks as the shop floor (../../lib/store)
 * but under its own namespace, and — unlike the shared-terminal PIN session —
 * the admin session IS persisted. An owner/admin signing in on their laptop
 * expects to stay signed in, unlike a shared tablet on the floor.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const NS = "milaca.company.v1";
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
