"use client";

import React, { useId } from "react";

/**
 * Insights' own icon: a magnifying glass with an AI sparkle tucked into its
 * top-right corner — one glyph, not two icons floating next to each other.
 * A knockout circle clears its own patch out of the glass's stroke so the
 * sparkle reads as sitting ON the glass. That knockout fills with --row-bg,
 * a custom property the nav row itself sets (see AppShell's renderNavItem)
 * to the row's *actual* current background — canvas at rest, the
 * pre-composited hover/selected tint otherwise — so the patch never shows
 * up as a mismatched halo the way a fixed canvas/surface fill did. Falls
 * back to canvas when nothing sets --row-bg (e.g. the mobile tab bar,
 * whose background never changes on selection). Everything else is
 * monochrome currentColor except the sparkle, which carries its own
 * blue-to-violet gradient — the rail's one deliberate spot of color, fixed
 * regardless of hover/selected state. Ported over from the shop floor's own
 * Insights tab — Insights now lives here instead. Moved into its own file
 * (Sept 2026) so it can be shared between the console SPA and the
 * standalone Settings/Feedback pages that reuse the same nav (see
 * ../lib/nav.js).
 */
export default function InsightsIcon({ size = 16, className }) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2383e2" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="15.2" y1="15.2" x2="20.5" y2="20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle
        cx="16.5"
        cy="6"
        r="5.5"
        style={{ fill: "var(--row-bg, var(--color-canvas))", transition: "fill 100ms" }}
      />
      <g transform="translate(11 1) scale(0.42)">
        <path
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          fill={`url(#${gradientId})`}
        />
      </g>
    </svg>
  );
}
