"use client";

import { cx } from "./cx";

const INPUT_BASE =
  "w-full bg-surface border text-ink placeholder:text-ink-4 " +
  "transition-colors duration-100 focus:border-primary outline-none " +
  "disabled:bg-sunken disabled:text-ink-3";

/** `pill` is for an input that sits in a row of chips and must take their
 *  shape and size. */
export function Input({
  invalid,
  pill = false,
  className,
  size = "md",
  ...rest
}) {
  const shape = pill
    ? "rounded-full px-3 text-xs h-[var(--ctl-h)]"
    : size === "lg"
      ? "rounded-md px-2.5 text-sm h-[var(--ctl-h-lg)]"
      : "rounded-md px-2.5 text-sm h-[var(--ctl-h)]";
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={cx(
        INPUT_BASE,
        shape,
        invalid ? "border-danger" : "border-line-strong",
        className,
      )}
    />
  );
}

/** Numeric PIN entry — large, spaced, never remembered by the browser. */
export function PinInput({ invalid, className, ...rest }) {
  return (
    <input
      {...rest}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      placeholder="••••"
      aria-invalid={invalid || undefined}
      className={cx(
        INPUT_BASE,
        "rounded-md px-3 h-[var(--ctl-h-lg)] text-base tracking-[0.4em] font-mono",
        invalid ? "border-danger" : "border-line-strong",
        className,
      )}
    />
  );
}
