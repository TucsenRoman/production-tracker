"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Named portals from a screen into the app shell. A page's own actions belong
 * beside the page title, but the title is rendered by the shell and the
 * handlers live in the screen, so the screen posts into a slot the shell put
 * there. A ref callback sets the target once, so there is no render loop to
 * guard against.
 */
const SlotContext = createContext(null);

export function SlotProvider({ children }) {
  const [nodes, setNodes] = useState({});
  const register = useCallback((name, el) => {
    setNodes((n) => (n[name] === el ? n : { ...n, [name]: el }));
  }, []);
  return (
    <SlotContext.Provider value={{ nodes, register }}>
      {children}
    </SlotContext.Provider>
  );
}

/** Renders where the slot's contents should appear. Empty until a screen fills it. */
export function SlotTarget({ name, className }) {
  const ctx = useContext(SlotContext);
  const register = ctx?.register;
  const ref = useCallback((el) => register?.(name, el), [register, name]);
  return <div ref={ref} className={className} />;
}

/** Renders its children into the named target. No-op until the target mounts. */
export function Slot({ name, children }) {
  const ctx = useContext(SlotContext);
  const el = ctx?.nodes?.[name];
  return el ? createPortal(children, el) : null;
}
