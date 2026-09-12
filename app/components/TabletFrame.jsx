"use client";

import React, {
  createContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";

import { cx } from "./ui";

/** Read by AppShell (the h-full swap) to know it is inside a TabletFrame. */
export const TabletFrameContext = createContext(false);

/**
 * iPad Pro 11-inch (4th generation, 2022) — A2759. Every number is that
 * iPad in its own points; the whole frame renders at one scale factor:
 *
 *   display   2388 x 1668 px @2x  ->  834 x 1194 pt
 *   enclosure 247.6 x 178.5 mm    ->  bezel is (247.6-229.7)/2 = 8.95 mm on
 *                                     the long edge and (178.5-160.5)/2 =
 *                                     9.0 mm on the short one, i.e. uniform
 *   9.0 mm at 132 pt/inch         ->  47 pt of glass on all four sides
 *   display corner radius             18 pt (Apple's value for this panel)
 *
 * The enclosure radius is concentric with the display's (18 + 47 = 65 pt),
 * as the physical part is machined.
 *
 * The front camera sits centred on a SHORT edge: top-centre in portrait,
 * mid-left in landscape. Keeping it on the same physical edge makes the
 * rotate control read as the device turning.
 */
const IPAD = {
  screenW: 834,
  screenH: 1194,
  bezel: 47,
  screenRadius: 18,
  camera: 12, // ~2.3 mm lens aperture, the visible dot
};

const SHELL_RADIUS = IPAD.screenRadius + IPAD.bezel;
const OUTER_W = IPAD.screenW + IPAD.bezel * 2; // 928 pt
const OUTER_H = IPAD.screenH + IPAD.bezel * 2; // 1288 pt

/** Breathing room between the device and the edges of its stage; the corner
 * controls float over this same margin. */
const STAGE_MARGIN = 12;

/**
 * Wraps the floor app in a device mockup for demos. The device is sized by
 * measuring its stage and solving for the largest whole iPad that fits: one
 * scalar (`pt`, CSS pixels per iPad point) drives bezel, radii, camera and
 * screen alike.
 *
 * Deliberately no `transform: scale()`: scaling shows the app at a viewport
 * it never runs at. Sizing the screen in real CSS pixels makes the app
 * genuinely reflow. Caveat: the app's `lg:` rules are viewport media queries,
 * so they answer to the browser window, not this frame.
 */
export default function TabletFrame({ children }) {
  const [portrait, setPortrait] = useState(false);
  // Null until measured, and the device isn't rendered until then: mounting
  // the app into a 0x0 box would have it take its own first measurements
  // against a viewport that never existed.
  const [stage, setStage] = useState(null);
  const stageRef = useRef(null);

  // useLayoutEffect + an immediate read, so the first paint has a real size.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () =>
      setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const outerW = portrait ? OUTER_W : OUTER_H;
  const outerH = portrait ? OUTER_H : OUTER_W;

  // One scale factor for the whole device, fit by the tighter axis so the
  // iPad is never clipped on a short window.
  const pt = stage
    ? Math.max(
        0,
        Math.min(
          (stage.w - STAGE_MARGIN * 2) / outerW,
          (stage.h - STAGE_MARGIN * 2) / outerH,
        ),
      )
    : 0;
  const px = (points) => points * pt;

  const screenW = px(portrait ? IPAD.screenW : IPAD.screenH);
  const screenH = px(portrait ? IPAD.screenH : IPAD.screenW);

  // Centred in the bezel band on whichever short edge is currently "up".
  const camera = portrait
    ? { top: px(IPAD.bezel / 2), left: "50%" }
    : { left: px(IPAD.bezel / 2), top: "50%" };

  return (
    <div
      className="fixed inset-0"
      style={{ background: "#e5e0d5" }}
    >
      {/* Harness controls in the browser window's top corners. Icon-only:
          a labelled link runs through the device's rounded corner, a 32px
          circle clears it at every usable size. Names are in `title`. */}
      <Link
        href="/company/milaca-meats"
        aria-label="Back to console"
        title="Back to console"
        className={cx(
          "absolute top-2 left-2 z-10 inline-flex items-center justify-center",
          "w-8 h-8 rounded-full no-underline text-ink-3",
          "hover:bg-[rgba(20,16,14,0.06)] hover:text-ink transition-colors duration-100",
        )}
      >
        <ArrowLeft size={15} className="shrink-0" />
      </Link>

      <button
        type="button"
        aria-label="Rotate device"
        title={portrait ? "Rotate to landscape" : "Rotate to portrait"}
        onClick={() => setPortrait((p) => !p)}
        className={cx(
          "absolute top-2 right-2 z-10 inline-flex items-center justify-center",
          "w-8 h-8 rounded-full text-ink-3",
          "hover:bg-[rgba(20,16,14,0.06)] hover:text-ink transition-colors duration-100",
        )}
      >
        <RotateCw size={15} />
      </button>

      <div
        ref={stageRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        {stage && pt > 0 && (
          <div
            style={{
              width: px(outerW),
              height: px(outerH),
              background: "#2a2724",
              borderRadius: px(SHELL_RADIUS),
              padding: px(IPAD.bezel),
              position: "relative",
              boxShadow: "0 24px 60px -20px rgba(30,25,20,0.35)",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                ...camera,
                transform: "translate(-50%, -50%)",
                width: px(IPAD.camera),
                height: px(IPAD.camera),
                borderRadius: 9999,
                background: "#4a453f",
              }}
            />
            <div
              style={{
                position: "relative",
                width: screenW,
                height: screenH,
                borderRadius: px(IPAD.screenRadius),
                overflow: "hidden",
                background: "#fff",
                /* `contain: layout` makes the screen a containing block for
                 * `position: fixed` descendants (AppShell's bottom tab bar),
                 * so they pin to the glass rather than the browser window.
                 * Parts portaled to document.body are unaffected. */
                contain: "layout",
              }}
            >
              <TabletFrameContext.Provider value={true}>
                {children}
              </TabletFrameContext.Provider>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
