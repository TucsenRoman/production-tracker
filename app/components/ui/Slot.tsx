"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface SlotContextValue {
  nodes: Record<string, HTMLElement | null>;
  register: (name: string, el: HTMLElement | null) => void;
}

/**
 * Named portals from a screen into the app shell. A page's own actions belong
 * beside the page title, but the title is rendered by the shell and the
 * handlers live in the screen, so the screen posts into a slot the shell put
 * there. A ref callback sets the target once, so there is no render loop to
 * guard against.
 */
const SlotContext = createContext<SlotContextValue | null>(null);

export function SlotProvider({ children }: { children?: ReactNode }) {
  const [nodes, setNodes] = useState<Record<string, HTMLElement | null>>({});
  const register = useCallback((name: string, el: HTMLElement | null) => {
    setNodes((n) => (n[name] === el ? n : { ...n, [name]: el }));
  }, []);
  return (
    <SlotContext.Provider value={{ nodes, register }}>
      {children}
    </SlotContext.Provider>
  );
}

/** Renders where the slot's contents should appear. Empty until a screen fills it. */
export function SlotTarget({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const ctx = useContext(SlotContext);
  const register = ctx?.register;
  const ref = useCallback(
    (el: HTMLElement | null) => register?.(name, el),
    [register, name],
  );
  return <div ref={ref} className={className} />;
}

/** Renders its children into the named target. No-op until the target mounts. */
export function Slot({ name, children }: { name: string; children?: ReactNode }) {
  const ctx = useContext(SlotContext);
  const el = ctx?.nodes?.[name];
  return el ? createPortal(children, el) : null;
}
