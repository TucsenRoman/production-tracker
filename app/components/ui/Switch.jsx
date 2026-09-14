"use client";

import { cx } from "./cx";

export function Switch({ checked, onChange, disabled, label, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full",
        "transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
        checked ? "bg-primary" : "bg-line-strong",
        className,
      )}
    >
      <span
        className={cx(
          "inline-block h-4 w-4 transform rounded-full bg-white",
          "transition-transform duration-150",
          checked ? "translate-x-5" : "translate-x-1",
        )}
      />
    </button>
  );
}
