"use client";

import { cx } from "./cx";

export function Card({
  as: Tag = "div",
  inset = false,
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      {...rest}
      className={cx(
        // Not a box: two rules, one above and one below, with the page showing
        // through. No side borders, radius or shadow — the DNA bans wrapping a
        // group in a box.
        "bg-surface border-y border-line",
        inset && "py-3",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
