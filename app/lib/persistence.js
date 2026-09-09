"use client";

/**
 * One localStorage-backed `usePersistentState`, built per namespace.
 *
 * There used to be two hand-copied versions of this hook — one in ./store.js
 * for the shop floor, one in ../company/lib/companyStore.js for the console —
 * byte-identical apart from the namespace string, right down to the comment
 * explaining the hydration fix. Duplication like that is what let the two
 * halves of this app drift apart in the first place (the station bridge spent
 * a release reading `milaca.company.v2` after the console had moved to v4),
 * so the hook is built once here and the namespace is the only thing a caller
 * supplies.
 *
 * Dev switch: NEXT_PUBLIC_PERSIST=off in .env.local makes every read miss and
 * every write no-op, so a refresh always re-seeds from SEED instead of serving
 * whatever is already sitting in localStorage. Restart the dev server after
 * changing it — NEXT_PUBLIC_* is inlined at build time.
 */

import { useEffect, useRef, useState } from "react";

const PERSIST = process.env.NEXT_PUBLIC_PERSIST !== "off";

export function createStore(namespace) {
  const key = (name) => `${namespace}.${name}`;

  const readRaw = (name) => {
    if (!PERSIST) return null;
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key(name));
    } catch {
      return null;
    }
  };

  const writeRaw = (name, raw) => {
    if (!PERSIST) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key(name), raw);
    } catch {
      /* quota or private mode — state stays in memory for this session */
    }
  };

  const parse = (raw, fallback) => {
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  /**
   * Like useState, but hydrated from localStorage after mount so server and
   * client render the same markup on the first pass — and kept in step with
   * the OTHER tab, which is the whole point here: the office runs the console
   * and the shop floor runs the tablet, at the same time, against the same
   * keys. Without the `storage` listener below, a station renamed or a batch
   * scheduled in one of them reached the other only on its next page load.
   */
  function usePersistentState(name, initial) {
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

    /* The last JSON this hook knows is in storage. It is what stops the
     * write effect and the storage listener from chasing each other: a value
     * that arrived FROM another tab must not be written straight back out,
     * or two open tabs ping-pong the same object forever. */
    const persisted = useRef(null);

    useEffect(() => {
      const raw = readRaw(name);
      if (raw != null) {
        persisted.current = raw;
        setValue(parse(raw, initial));
      }
      setHydrated(true);
      // `initial` is a seed, not a dependency — re-running on a new object
      // identity would re-hydrate over live state on every parent render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name]);

    useEffect(() => {
      if (!hydrated) return;
      let raw;
      try {
        raw = JSON.stringify(value);
      } catch {
        return;
      }
      if (raw === persisted.current) return;
      persisted.current = raw;
      writeRaw(name, raw);
    }, [name, value, hydrated]);

    /* The other half of the bridge. `storage` fires only in the OTHER
     * documents on this origin, which is exactly the case that matters: the
     * console writes, the tablet is already open. A null `e.key` is a
     * `localStorage.clear()` and means re-read everything. */
    useEffect(() => {
      if (!PERSIST) return undefined;
      if (typeof window === "undefined") return undefined;
      const onStorage = (e) => {
        if (e.key != null && e.key !== key(name)) return;
        const raw = readRaw(name);
        if (raw === persisted.current) return;
        persisted.current = raw;
        setValue(raw == null ? initial : parse(raw, initial));
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name]);

    return [value, setValue];
  }

  /** True once localStorage has been read, so screens can hold their skeleton. */
  function useHydrated() {
    const [ready, setReady] = useState(false);
    useEffect(() => setReady(true), []);
    return ready;
  }

  function clearAll() {
    if (typeof window === "undefined") return;
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(namespace))
      .forEach((k) => window.localStorage.removeItem(k));
  }

  return { namespace, key, usePersistentState, useHydrated, clearAll };
}

export { PERSIST };
