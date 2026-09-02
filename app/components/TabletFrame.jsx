"use client";

import React, { createContext, useEffect, useState } from "react";
import Link from "next/link";

/**
 * Read by AppShell (the h-full swap) and by ProductionTracker's Shell (which
 * portals RoleSwitcher to document.body instead of rendering it inside the
 * mock device) to know they're rendered inside a TabletFrame. Defaults to
 * false, so CompanyConsole — which never renders inside a TabletFrame — is
 * completely unaffected.
 */
export const TabletFrameContext = createContext(false);

// iPad Air's own landscape logical resolution for the tablet preset —
// comfortably above Tailwind's 1024px `lg` breakpoint, so it renders the
// real desktop/rail layout, same as an actual production-floor tablet.
// The mobile preset (iPhone 14/15-ish) sits well under that breakpoint, so
// it exercises AppShell's compact mobile header instead.
const DEVICES = {
  tablet: { w: 1180, h: 820, bezel: 18, outerRadius: 40, innerRadius: 24, label: "Tablet" },
  mobile: { w: 390, h: 844, bezel: 14, outerRadius: 54, innerRadius: 40, label: "Mobile" },
};

const VIEWPORT_MARGIN = 48;
const MIN_SCALE = 0.35;

/**
 * Wraps the floor app in a static device mockup for demos — a bezel, a
 * front-camera dot, and a fixed content area sized to the chosen device —
 * so it reads as "this is the tablet (or phone) experience" at a glance,
 * including in a screenshot. Purely visual chrome outside the app's own
 * Notion DNA component system; only used from ProductionTracker's Shell.
 * CompanyConsole is never wrapped in this and stays a normal, fully
 * responsive web page.
 *
 * Scales the whole device down (CSS transform, never re-flowing the app's
 * own layout) to fit smaller browser windows, computed from window size on
 * mount, on resize, and whenever the device preset changes — matches the
 * measure-don't-guess pattern the rest of this codebase already uses for
 * the mobile header height and the RoleSwitcher's viewport clamping.
 *
 * The back link, device toggle, and touch-simulation checkbox are demo
 * chrome that lives outside the scaled bezel on purpose, so none of it is
 * ever mistaken for part of the app itself.
 */
export default function TabletFrame({ children }) {
  const [device, setDevice] = useState("tablet");
  const [forceTouch, setForceTouch] = useState(false);
  const [scale, setScale] = useState(1);

  const preset = DEVICES[device];
  const totalW = preset.w + preset.bezel * 2;
  const totalH = preset.h + preset.bezel * 2;

  useEffect(() => {
    const recompute = () => {
      const availW = window.innerWidth - VIEWPORT_MARGIN * 2;
      const availH = window.innerHeight - VIEWPORT_MARGIN * 2;
      const next = Math.min(1, availW / totalW, availH / totalH);
      setScale(Math.max(MIN_SCALE, next));
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [totalW, totalH]);

  // `forceTouch` fakes `(hover: none) and (pointer: coarse)` for a
  // mouse-driven demo — see the `.force-touch-density` rules in
  // globals.css. Applied on <html> (not scoped to the frame) since the
  // real media query it stands in for is also global; always cleaned up
  // on unmount so leaving "/" never leaks the class into the console.
  useEffect(() => {
    document.documentElement.classList.toggle("force-touch-density", forceTouch);
    return () => document.documentElement.classList.remove("force-touch-density");
  }, [forceTouch]);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center gap-4 p-6 overflow-auto"
      style={{ background: "#e5e0d5" }}
    >
      <div
        style={{ width: Math.max(360, totalW * scale) }}
        className="flex items-center justify-between gap-3"
      >
        <Link
          href="/company/milaca-meats"
          style={{
            fontSize: 13,
            color: "#5c574e",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Back to console
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "#d8d2c3",
            borderRadius: 10,
            padding: "6px 10px",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#4a453f",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={forceTouch}
              onChange={(e) => setForceTouch(e.target.checked)}
            />
            Simulate touch (no hover)
          </label>

          <div style={{ width: 1, height: 16, background: "#b8b1a0" }} />

          <div style={{ display: "flex", gap: 2 }}>
            {Object.entries(DEVICES).map(([key, d]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDevice(key)}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: device === key ? "#2a2724" : "transparent",
                  color: device === key ? "#f2efe6" : "#4a453f",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ width: totalW * scale, height: totalH * scale }}>
        <div
          style={{
            width: totalW,
            height: totalH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: "#2a2724",
            borderRadius: preset.outerRadius,
            padding: preset.bezel,
            position: "relative",
            boxShadow: "0 24px 60px -20px rgba(30,25,20,0.35)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: 6,
              borderRadius: 9999,
              background: "#4a453f",
            }}
          />
          <div
            style={{
              width: preset.w,
              height: preset.h,
              borderRadius: preset.innerRadius,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <TabletFrameContext.Provider value={true}>{children}</TabletFrameContext.Provider>
          </div>
        </div>
      </div>

      <p className="text-xs" style={{ color: "#8f897c" }}>
        Floor terminal — {device} preview
      </p>
    </div>
  );
}
