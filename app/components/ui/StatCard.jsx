"use client";

import { cx } from "./cx";

/** A number, and — when `onClick` is given — the filter that number describes,
 *  so the count and the way to act on it are the same target. */
export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  onClick,
  active = false,
}) {
  const toneClass = {
    neutral: "text-ink",
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
    primary: "text-ink",
  }[tone];

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick
        ? {
            onClick,
            type: "button",
            "aria-pressed": active,
            className: undefined,
          }
        : {})}
      className={cx(
        "border rounded-md px-3.5 py-2.5 text-left w-full transition-colors duration-100",
        // Selection is the 5% tint and a firmer hairline — never a colour wash.
        active ? "border-line-strong bg-hover" : "border-line bg-surface",
        onClick && !active && "hover:bg-faint cursor-pointer",
      )}
    >
      <div className="flex items-center gap-1.5 text-ink-3 mb-1">
        {Icon && <Icon size={12} className="shrink-0" />}
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        {/* 24px against 14px body = 1.7:1. The tile is a number, not a headline. */}
        <span
          className={cx("text-2xl font-semibold tnum leading-none", toneClass)}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-ink-3 font-medium">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-3 truncate">{hint}</div>}
    </Tag>
  );
}

export function StatGrid({ className, children }) {
  return (
    <div className={cx("grid grid-cols-2 lg:grid-cols-4 gap-2", className)}>
      {children}
    </div>
  );
}
