"use client";

/**
 * One localStorage-backed `usePersistentState`, built per namespace, shared
 * by the floor store and the console store.
 *
 * Dev switch: NEXT_PUBLIC_PERSIST=off in .env.local makes every read miss and
 * every write no-op, so a refresh always re-seeds from SEED. Restart the dev
 * server after changing it — NEXT_PUBLIC_* is inlined at build time.
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
   * client render the same first pass, and kept in step with the OTHER tab
   * (the console and the tablet run at the same time against the same keys)
   * via the `storage` listener below.
   */
  function usePersistentState(name, initial) {
    const [value, setValue] = useState(initial);
    // Must be state, not a ref. A ref flipped inside the hydrate effect is
    // visible to the write effect in the same commit, before `setValue(stored)`
    // has landed, so the write effect persists the stale `initial` over the
    // real stored value. That usually self-corrects a render later, but if the
    // owner unmounts in that window (a redirect effect, e.g.) the stale write
    // is permanent. As state, this update batches with `setValue(stored)`, so
    // the write effect only sees hydrated=true once `value` is the real one.
    const [hydrated, setHydrated] = useState(false);

    /* The last JSON this hook knows is in storage. Stops the write effect and
     * the storage listener chasing each other: a value that arrived FROM
     * another tab must not be written straight back out. */
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

    /* `storage` fires only in OTHER documents on this origin, which is the
     * case that matters. A null `e.key` is a `localStorage.clear()`. */
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

