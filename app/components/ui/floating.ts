"use client";

/* Shared by every floating surface in this folder. */

/** The one surface every floating panel is cut from, so a pinned control and
 *  the option list can never drift apart. */
export const PANEL = "rounded-md border border-line-strong bg-surface shadow-md";

export const POPOVER_GAP = 6; // trigger-to-panel gap
export const POPOVER_MARGIN = 8; // never closer than this to the viewport edge
