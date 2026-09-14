"use client";

import { cx } from "./cx";

/**
 * Per-row controls (edit, remove, …). Put `group` on the row itself.
 *
 * Hover-reveal is a console pattern. On the floor's touch tablets `:hover`
 * never fires and reaching a control via `focus-within` means tapping the
 * row first, which on a row that is itself a button fires the row's action.
 * So `hover: none` forces them visible, and floor screens should also pass
 * `always` so the same screen opened on a desktop behaves the same.
 */
export function RowActions({ always = false, className, children }) {
  return (
    <div
      className={cx(
        "flex items-center gap-0.5 shrink-0 transition-opacity duration-100",
        !always && [
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          "[@media(hover:none)]:opacity-100",
        ]
          .join(" "),
        className,
      )}
    >
      {children}
    </div>
  );
}
