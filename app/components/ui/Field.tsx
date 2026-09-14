"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

export interface LabelProps {
  htmlFor?: string;
  className?: string;
  children?: ReactNode;
}

export function Label({ htmlFor, className, children }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cx("block text-xs font-medium text-ink-3 mb-1.5", className)}
    >
      {children}
    </label>
  );
}

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  /** Shown instead of `hint`, never alongside it. */
  error?: ReactNode;
  htmlFor?: string;
  className?: string;
  children?: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: FieldProps) {
  return (
    <div className={className}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>
      )}
    </div>
  );
}
