"use client";

import { useEffect, useRef } from "react";

/**
 * Reusable double-tap hotkeys: press a bare key twice within `windowMs` to
 * fire its handler. "b" "b" toggles the sidebar, "2" "2" jumps to a nav item
 * — same gesture everywhere it's used, so it only has to be explained once.
 *
 * `bindings` is a plain object of { key: handler }, matched against
 * `e.key.toLowerCase()`. Pass a fresh object every render if you like —
 * bindings are read through a ref, so the listener is attached exactly once
 * and always calls whatever the latest handler is, without re-subscribing.
 *
 * Every consumer gets the same guard for free, which is the point of this
 * hook: it always yields to typing. `isTypingTarget` walks up from the event
 * target with `closest()` rather than checking the exact tag, so it also
 * catches a native <select>, a contentEditable region, and a click that
 * lands on something nested inside a custom input wrapper — not just a
 * literal <input>/<textarea> hit. It also ignores held-down key repeat and
 * any modifier combo (meta/ctrl/alt), so it never fights a browser shortcut.
 */
export function isTypingTarget(el) {
  if (!el || typeof el.closest !== "function") return false;
  return el.closest('input, textarea, select, [contenteditable], [contenteditable="true"]') != null;
}

export function useDoubleTapHotkey(bindings, { windowMs = 1000 } = {}) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const pendingKeyRef = useRef(null);
  const pendingAtRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const key = e.key.toLowerCase();
      if (!(key in bindingsRef.current)) return;
      if (isTypingTarget(e.target)) return;

      const now = Date.now();
      const isRepeat = pendingKeyRef.current === key && now - pendingAtRef.current <= windowMs;

      if (!isRepeat) {
        pendingKeyRef.current = key;
        pendingAtRef.current = now;
        return;
      }

      pendingKeyRef.current = null;
      e.preventDefault();
      bindingsRef.current[key]?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [windowMs]);
}
