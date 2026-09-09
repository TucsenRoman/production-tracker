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

/**
 * Read by AppShell (the h-full swap) to know it is rendered inside a
 * TabletFrame. Defaults to false, so CompanyConsole — which never renders
 * inside one — is completely unaffected.
 *
 * ProductionTracker's Shell used to read this too, to decide whether to
 * portal the dev RoleSwitcher chip straight to document.body: the bezel's
 * own `transform: scale()` becomes a containing block for anything
 * `position: fixed` inside it, which trapped the chip against the mock
 * device instead of the real viewport. That chip switched a role the floor
 * no longer has and is retired, so only the h-full swap reads this now.
 */
export const TabletFrameContext = createContext(false);

/**
 * iPad Pro 11-inch (4th generation, 2022) — A2759.
 *
 * The mockup used to be an eyeballed rounded rectangle, which is the one
 * thing a device mockup must not be: if the proportions are invented, the
 * screenshot proves nothing about how the app sits on the real hardware.
 * So every number here is that specific iPad, expressed in ITS OWN points,
 * and the whole frame is rendered at one scale factor away from 1:1:
 *
 *   display   2388 x 1668 px @2x  ->  834 x 1194 pt
 *   enclosure 247.6 x 178.5 mm    ->  bezel is (247.6-229.7)/2 = 8.95 mm on
 *                                     the long edge and (178.5-160.5)/2 =
 *                                     9.0 mm on the short one, i.e. uniform
 *   9.0 mm at 132 pt/inch         ->  47 pt of glass on all four sides
 *   display corner radius             18 pt (Apple's own value for this
 *                                     panel; iPad corners are far subtler
 *                                     than a phone's, which is exactly what
 *                                     the old approximation got wrong)
 *
 * The enclosure radius is CONCENTRIC with the display's — 18 + 47 = 65 pt —
 * because that is how the physical part is machined, and a non-concentric
 * pair is the tell that reads as "mockup" even when nobody can say why.
 *
 * The front camera on this generation sits centred on a SHORT edge, so it is
 * top-centre in portrait and mid-LEFT in landscape. Keeping it attached to
 * the same physical edge (rather than always drawing it "at the top") is
 * what makes the rotate control read as the device turning rather than the
 * picture being redrawn.
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

/** Breathing room between the device and the edges of its stage. */
/* Breathing room around the device, and the only thing now standing between
 * the bezel and the window edge — 12 rather than 20, since the corner
 * controls float over this same margin instead of taking a band of their
 * own. Small enough that the tablet reads as filling the screen. */
const STAGE_MARGIN = 12;

/**
 * Wraps the floor app in a device mockup for demos, so a screenshot reads as
 * "this is the tablet on the production floor" without a caption. Purely
 * visual chrome outside the app's own Notion DNA component system; only used
 * from ProductionTracker's Shell. CompanyConsole is never wrapped in this and
 * stays a normal, fully responsive web page.
 *
 * The device is sized by measuring its stage and solving for the largest
 * whole iPad that fits — one scalar (`pt`, CSS pixels per iPad point) drives
 * bezel, radii, camera and screen alike, so the proportions above hold at any
 * window size instead of only at the one the numbers were tuned on.
 *
 * Deliberately NO `transform: scale()` (which the earlier version used to fit
 * a fixed 1180x820 logical screen into small windows). Scaling shows the app
 * at a viewport it will never actually run at, just drawn smaller — every
 * breakpoint, every wrap point and every real line-length problem hidden
 * behind a zoom. Sizing the screen area in real CSS pixels instead means the
 * app inside genuinely reflows, which is the only version of this mockup that
 * can tell you anything you didn't already know. (Caveat worth knowing: the
 * app's own `lg:` rules are viewport media queries, so they answer to the
 * browser window, not to this frame — see the note in the report.)
 */
export default function TabletFrame({ children }) {
  const [portrait, setPortrait] = useState(false);
  // Stage size in CSS pixels. Null until measured, and the device isn't
  // rendered until then — mounting the app into a 0x0 box would have it take
  // its own first measurements (AppShell's mobile header height, say)
  // against a viewport that never existed.
  const [stage, setStage] = useState(null);
  const stageRef = useRef(null);

  // useLayoutEffect + an immediate read, so the very first paint already has
  // a real size: same measure-don't-guess pattern the rest of this codebase
  // uses, and it avoids a frame of the app laid out at zero width.
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

  // One scale factor for the whole device. Fits by the tighter of the two
  // axes so the iPad is never clipped on a short window — the case the old
  // fixed-size frame handled by shrinking the app instead.
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
      {/* Harness controls, in the BROWSER window's top corners — outside the
          device, on the page background.
          
          Icon-only for the reason the header bar died: at full height the
          tablet is nearly the whole window, and the only room left is the
          narrow gutter either side of it. A labelled link needs ~160px and
          runs through the device's rounded corner; a 32px circle clears it at
          every size the frame is usable at. Names are in the `title`. */}
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
                /* The screen is the app's viewport, so anything the app pins
                 * with `position: fixed` — AppShell's mobile bottom nav, most
                 * visibly — has to pin to the glass, not to the browser
                 * window. The old frame got that for free from its
                 * `transform: scale()` (a transform makes an element a
                 * containing block for fixed descendants); dropping the
                 * transform to let the app reflow dropped that side effect
                 * with it, and the tab bar started sitting on the paper below
                 * the iPad. `contain: layout` restores the containing block
                 * deliberately rather than by accident, and its isolation is
                 * true here anyway: nothing inside a device screen should
                 * influence layout outside it. Parts the app portals to
                 * document.body (tooltips, modals) are outside this subtree
                 * by design and are unaffected. */
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
