"use client";

import React from "react";

/**
 * Isometric line illustration of a production floor, drawn entirely from the
 * app's own Notion-DNA tokens — no colour is introduced that isn't already
 * one of --color-canvas / --color-sunken / --color-inset / --color-line-strong
 * / --color-ink(-2/-3) / --color-primary. If those tokens change, this
 * illustration restyles with them.
 *
 * This is a DELIBERATE, RECORDED exception to bans[12] in
 * .claude/skills/notion/dna.json ("never use an illustration ... in an empty
 * state") — see approved_forks there for the reasoning. Everything else about
 * it still obeys the DNA: the single accent screen keeps the whole scene
 * under the 1% accent budget, and there is no gradient, shadow blur, or
 * second hue anywhere in it.
 *
 * Geometry is a small hand-rolled isometric projector (30°, 2:1) rather than
 * hand-drawn paths, so every box/figure/vehicle shares exactly the same
 * angle and the scene stays easy to extend.
 */

const COS30 = Math.cos((30 * Math.PI) / 180);
const SIN30 = Math.sin((30 * Math.PI) / 180);
const UNIT = 26;

// Three-step shading reused from the app's own neutral ramp — top face
// lightest (canvas), right face mid (inset), left face darkest (line-strong).
const TOP = "var(--color-canvas)";
const RIGHT = "var(--color-inset)";
const LEFT = "var(--color-line-strong)";
const FLOOR = "var(--color-sunken)";
const SHADOW = "var(--color-inset)";
const FIGURE_DK = "var(--color-ink-2)";
const ACCENT = "var(--color-primary)";
const INK = "var(--color-ink)";
const STROKE_W = 1.3;

function pt(x, y, z) {
  return [(x - z) * COS30 * UNIT, (x + z) * SIN30 * UNIT - y * UNIT];
}

function polyPoints(points) {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

/** A single box (equipment, wall, loft, truck body...) with up to 3 visible faces. */
function Box({ id, cx, cz, w, d, h, y0 = 0, top = TOP, right = RIGHT, left = LEFT, sw = STROKE_W, stroke = INK }) {
  const x0 = cx - w / 2,
    x1 = cx + w / 2;
  const z0 = cz - d / 2,
    z1 = cz + d / 2;
  const A0 = pt(x0, y0, z0),
    B0 = pt(x1, y0, z0),
    C0 = pt(x1, y0, z1),
    D0 = pt(x0, y0, z1);
  const A1 = pt(x0, y0 + h, z0),
    B1 = pt(x1, y0 + h, z0),
    C1 = pt(x1, y0 + h, z1),
    D1 = pt(x0, y0 + h, z1);
  return (
    <g data-box={id}>
      {left && <polygon points={polyPoints([A0, D0, D1, A1])} fill={left} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />}
      {right && <polygon points={polyPoints([D0, C0, C1, D1])} fill={right} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />}
      {top && <polygon points={polyPoints([A1, B1, C1, D1])} fill={top} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />}
    </g>
  );
}

function ShadowEllipse({ id, cx, cz, rx, rz, y0 = 0 }) {
  const [x, y] = pt(cx, y0, cz);
  return <ellipse data-shadow={id} cx={x} cy={y} rx={rx * UNIT} ry={rz * UNIT * 0.5} fill={SHADOW} />;
}

/** Headless figure: flat silhouette body + round head + a contact shadow. No face, no colour beyond one grey. */
function Figure({ id, cx, cz, y0 = 0, scale = 1, fill = FIGURE_DK }) {
  const [hx, hy] = pt(cx, y0 + 0.58 * scale + 0.15 * scale, cz);
  return (
    <g data-figure={id}>
      <ShadowEllipse id={`${id}-shadow`} cx={cx} cz={cz} rx={0.32 * scale} rz={0.22 * scale} y0={y0} />
      <Box id={`${id}-body`} cx={cx} cz={cz} w={0.4 * scale} d={0.3 * scale} h={0.58 * scale} y0={y0} top={fill} right={fill} left={fill} sw={1} />
      <circle cx={hx} cy={hy} r={0.155 * scale * UNIT} fill={fill} stroke="none" />
    </g>
  );
}

function Wheel({ id, cx, cz, y0 = 0 }) {
  const [x, y] = pt(cx, y0, cz);
  return <circle data-wheel={id} cx={x} cy={y} r={0.16 * UNIT} fill={INK} stroke="none" />;
}

/** Delivery truck: cargo box + cab + four wheels, parked past the floor's front edge as if outside. */
function Truck({ id, cx, cz, y0 = 0, scale = 1 }) {
  const cabCx = cx + 0.72 * scale;
  return (
    <g data-truck={id}>
      <ShadowEllipse id={`${id}-shadow`} cx={cx} cz={cz} rx={0.95 * scale} rz={0.55 * scale} y0={y0} />
      <Box id={`${id}-cargo`} cx={cx} cz={cz} w={0.8 * scale} d={0.85 * scale} h={0.72 * scale} y0={y0} />
      <Box id={`${id}-cab`} cx={cabCx} cz={cz} w={0.46 * scale} d={0.72 * scale} h={0.42 * scale} y0={y0} />
      <Wheel id={`${id}-w1`} cx={cx - 0.22 * scale} cz={cz - 0.46 * scale} y0={y0} />
      <Wheel id={`${id}-w2`} cx={cx - 0.22 * scale} cz={cz + 0.46 * scale} y0={y0} />
      <Wheel id={`${id}-w3`} cx={cabCx + 0.06 * scale} cz={cz - 0.4 * scale} y0={y0} />
      <Wheel id={`${id}-w4`} cx={cabCx + 0.06 * scale} cz={cz + 0.4 * scale} y0={y0} />
    </g>
  );
}

/** A short conveyor run: two rails plus perpendicular ties, drawn as hairlines. */
function Conveyor({ id, x0, z0, x1, z1, y0 = 0.02, n = 6 }) {
  const rails = [-0.06, 0.06].map((off, i) => {
    const [ax, ay] = pt(x0, y0, z0 + off);
    const [bx, by] = pt(x1, y0, z1 + off);
    return <line key={`${id}-rail-${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={LEFT} strokeWidth={1} />;
  });
  const ties = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const cx_ = x0 + (x1 - x0) * t,
      cz_ = z0 + (z1 - z0) * t;
    const [ax, ay] = pt(cx_, y0, cz_ - 0.06);
    const [bx, by] = pt(cx_, y0, cz_ + 0.06);
    return <line key={`${id}-tie-${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={LEFT} strokeWidth={1} />;
  });
  return (
    <g data-conveyor={id}>
      {rails}
      {ties}
    </g>
  );
}

function WallClock({ cx, cy, cz }) {
  const [x, y] = pt(cx, cy, cz);
  return (
    <g data-clock="wall">
      <circle cx={x} cy={y} r={8.5} fill={TOP} stroke={INK} strokeWidth={1.1} />
      <line x1={x} y1={y} x2={x} y2={y - 5} stroke={INK} strokeWidth={1} />
      <line x1={x} y1={y} x2={x + 3.5} y2={y} stroke={INK} strokeWidth={1} />
    </g>
  );
}

export default function OpsIllustration({ className }) {
  const screenAt = pt(0.6 + 0.35, 0.55, 0.9);
  return (
    <svg
      viewBox="-235 -195 470 370"
      className={className}
      role="img"
      aria-label="Illustration of a production floor with a rear office loft"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* floor */}
      <Box id="floor" cx={0} cz={0} w={6.4} d={5.6} h={0.001} top={FLOOR} right={null} left={null} sw={1.2} />

      {/* the two cutaway walls */}
      <Box id="wall-left" cx={-3.2} cz={0} w={0.12} d={5.6} h={2.0} right={LEFT} left={LEFT} sw={1.2} />
      <Box id="wall-back" cx={0} cz={-2.8} w={6.4} d={0.12} h={2.0} right={LEFT} left={LEFT} sw={1.2} />

      {/* rear office loft — the second implied zone */}
      <Box id="loft" cx={-2.55} cz={-2.2} w={2.5} d={2.0} h={1.0} y0={1.0} sw={1.2} />
      <Box id="desk" cx={-2.6} cz={-2.4} w={0.75} d={0.38} h={0.34} y0={2.0} sw={1} />
      <WallClock cx={0.9} cy={1.05} cz={-2.86} />

      {/* equipment — one carries the single accent screen */}
      <ShadowEllipse id="eq1" cx={0.6} cz={0.9} rx={0.42} rz={0.32} />
      <Box id="eq1" cx={0.6} cz={0.9} w={0.7} d={0.6} h={1.05} />
      <rect x={screenAt[0] - 6} y={screenAt[1] - 5} width={12} height={10} rx={1} fill={ACCENT} />

      <ShadowEllipse id="eq2" cx={-0.6} cz={1.6} rx={0.4} rz={0.3} />
      <Box id="eq2" cx={-0.6} cz={1.6} w={0.65} d={0.55} h={0.85} />

      <ShadowEllipse id="eq3" cx={1.7} cz={-0.2} rx={0.36} rz={0.28} />
      <Box id="eq3" cx={1.7} cz={-0.2} w={0.55} d={0.5} h={0.7} />

      <Conveyor id="conveyor" x0={1.0} z0={0.7} x1={1.5} z1={0.15} />

      {/* headless figures */}
      <Figure id="figure-1" cx={-0.2} cz={1.5} />
      <Figure id="figure-2" cx={1.15} cz={-0.55} scale={1.02} />

      {/* truck at the dock, parked past the open edge */}
      <Truck id="truck" cx={3.35} cz={2.35} scale={1.35} />
    </svg>
  );
}
