"use client";

import { useEffect, useRef } from "react";

/**
 * Double-tap hotkeys: press a bare key twice within `windowMs` to fire its
 * handler. `bindings` is { key: handler }, matched against
 * `e.key.toLowerCase()`; it is read through a ref, so the listener attaches
 * once and always calls the latest handler.
 *
 * Always yields to typing: `isTypingTarget` walks up with `closest()` so it
 * catches a <select>, contentEditable, or a nested custom input, not just a
 * literal <input>/<textarea>. Ignores key repeat and modifier combos so it
 * never fights a browser shortcut.
 */
function isTypingTarget(el) {
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
