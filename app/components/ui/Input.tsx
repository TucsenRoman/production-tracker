"use client";

import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";

const INPUT_BASE =
  "w-full bg-surface border text-ink placeholder:text-ink-4 " +
  "transition-colors duration-100 focus:border-primary outline-none " +
  "disabled:bg-sunken disabled:text-ink-3";

/** `size` is ours, not the HTML character-width attribute. */
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
  /** For an input sitting in a row of chips: takes their shape and size. */
  pill?: boolean;
  size?: "md" | "lg";
}

export function Input({
  invalid,
  pill = false,
  className,
  size = "md",
  ...rest
}: InputProps) {
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

export interface PinInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
}

/** Numeric PIN entry — large, spaced, never remembered by the browser. */
export function PinInput({ invalid, className, ...rest }: PinInputProps) {
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
