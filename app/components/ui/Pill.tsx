"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";
import { Tooltip } from "./Tooltip";
import type { IconComponent } from "./types";

/**
 * A bordered run of options — the same choice a Segmented row makes, wearing a
 * container.
 *
 * Segmented has no track: its chips sit on the page and the active one takes
 * the 5% tint. That is right in a toolbar, where the page's own rules and
 * spacing already say where the group starts and stops. It is wrong inside a
 * panel, where there is no rule to lean on and four loose chips read as four
 * unrelated buttons. The Pill draws its own edge, so the group is an object.
 *
 * ONE border wraps the whole control in every variant. What changes is how an
 * individual option is marked inside it — which is a question about what the
 * choice MEANS, not about taste:
 *
 *   press   — a neutral view switch. Nothing is "on"; one of them is showing.
 *   ink     — the same, when the choice is the loudest thing on the screen.
 *   accent  — a FILTER. The brand colour says something is narrowing the data,
 *             which a grey tint cannot say from the corner of your eye. Mark
 *             the off position `resting` and it stays grey there, so the blue
 *             only ever means "narrowed".
 *   marker  — options that each mean something (flagged, over target). The dot
 *             carries the meaning and the fill stays out of the way.
 */
export type PillVariant = "press" | "ink" | "accent" | "marker";

/** Only `marker` reads this — it colours the option's dot. */
export type PillTone = "neutral" | "warn" | "danger" | "ok" | "info";

const DOT_TONE: Record<PillTone, string> = {
  neutral: "bg-ink-3",
  warn: "bg-warn",
  danger: "bg-danger",
  ok: "bg-ok",
  info: "bg-primary",
};

/* Each variant is four decisions — the shell's fill, the option's treatment,
 * what the RESTING option gets when it is the one selected, and what the count
 * badge does when the option is on. Kept as one table so a new variant cannot
 * forget one. */
const VARIANT: Record<
  PillVariant,
  { shell: string; on: string; restingOn?: string; off: string; countOn: string; countOff: string }
> = {
  press: {
    shell: "bg-surface",
    on: "bg-sunken text-ink shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]",
    off: "text-ink-2 hover:text-ink",
    countOn: "bg-line-strong/60 text-ink-1",
    countOff: "bg-line text-ink-3",
  },
  ink: {
    shell: "bg-surface",
    on: "bg-ink text-canvas",
    restingOn: "bg-hover text-ink",
    off: "text-ink-2 hover:bg-faint hover:text-ink",
    countOn: "bg-canvas/25 text-canvas",
    countOff: "bg-line text-ink-3",
  },
  accent: {
    shell: "bg-surface",
    on: "bg-primary-soft text-primary",
    restingOn: "bg-hover text-ink",
    off: "text-ink-2 hover:bg-faint hover:text-ink",
    countOn: "bg-primary text-white",
    countOff: "bg-line text-ink-3",
  },
  marker: {
    shell: "bg-surface",
    on: "text-ink",
    off: "text-ink-3 hover:text-ink-1",
    countOn: "bg-line-strong/50 text-ink-1",
    countOff: "bg-line/60 text-ink-3",
  },
};

export interface PillOption<T extends string = string> {
  value: T;
  label?: ReactNode;
  icon?: IconComponent;
  /** `null`/`0` renders nothing. */
  count?: number | null;
  /** `marker` only: what this option's dot means. */
  tone?: PillTone;
  /**
   * This option is the OFF position — "All", "Any", "Everyone". A loud variant
   * goes quiet on it, because a control shouting while nothing is narrowed is
   * the one way a filter control can lie.
   */
  resting?: boolean;
  /** Shown on hover, for an option whose one word cannot say what changes. */
  hint?: string;
  disabled?: boolean;
}

export interface PillProps<T extends string = string> {
  options: readonly PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: PillVariant;
  size?: "sm" | "md";
  className?: string;
  /** Labels the group for screen readers. */
  "aria-label"?: string;
}

/**
 * The label renders TWICE: an invisible bold copy sets the box, and the
 * visible one changes weight inside it. Without that, going active bumps the
 * label to semibold and shoves every option to its right — a control that
 * reflows when you use it feels broken even when nobody can say why.
 */
function PillLabel({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className="grid">
      <span className="col-start-1 row-start-1 font-semibold invisible" aria-hidden="true">
        {children}
      </span>
      <span className={cx("col-start-1 row-start-1", on ? "font-semibold" : "font-medium")}>
        {children}
      </span>
    </span>
  );
}

export function Pill<T extends string = string>({
  options,
  value,
  onChange,
  variant = "press",
  size = "md",
  className,
  "aria-label": ariaLabel,
}: PillProps<T>) {
  const v = VARIANT[variant];
  const marker = variant === "marker";
  // The SHELL is the control, so the shell is what has to measure --ctl-h
  // (28px): 1px border + 2px gutter + a 22px option on each side. Sizing the
  // option to 28 instead put a 36px lozenge next to 28px inputs, and one
  // control standing taller than the row it sits in is the whole of what
  // "chunky" means here.
  //
  // Fixed rather than var(--ctl-h), matching Segmented: the coarse-pointer
  // bump scales height alone, which would squash the options rather than
  // enlarge them.
  const pad = size === "sm" ? "h-[18px] text-[11px] px-2" : "h-[22px] text-xs px-2.5";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx("inline-flex items-center rounded-full border border-line p-[2px]", v.shell, className)}
    >
      {options.map((o) => {
        const on = o.value === value;
        const chip = (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              "relative inline-flex items-center justify-center gap-1.5 rounded-full whitespace-nowrap shrink-0 select-none",
              "transition-[color,background-color,box-shadow] duration-100",
              "disabled:opacity-45 disabled:cursor-not-allowed",
              pad,
              marker && "pl-2",
              on ? (o.resting && v.restingOn) || v.on : v.off,
            )}
          >
            {marker && (
              <span
                className={cx(
                  "w-1.5 h-1.5 rounded-full shrink-0 transition-opacity duration-100",
                  DOT_TONE[o.tone ?? "neutral"],
                  on ? "opacity-100" : "opacity-30",
                )}
                aria-hidden="true"
              />
            )}
            {o.icon && (
              <o.icon
                size={13}
                className={cx("shrink-0", on && variant === "ink" ? "" : on ? "text-ink" : "text-ink-3")}
              />
            )}
            <PillLabel on={on}>{o.label}</PillLabel>
            {/* The count takes the option's state — a badge that stays one
              * colour in every state is decoration, not information — and a
              * RESTING option has none at all, same rule as Segmented: "All
              * 12" is the size of the list you are already looking at. */}
            {o.count && !o.resting ? (
              <span
                className={cx(
                  "inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 -mr-0.5 rounded-full",
                  "text-[10px] font-semibold leading-none tnum transition-colors duration-100",
                  on ? v.countOn : v.countOff,
                )}
              >
                {o.count > 99 ? "99+" : o.count}
              </span>
            ) : null}
          </button>
        );
        if (!o.hint) return chip;
        return (
          <Tooltip key={o.value} label={o.hint}>
            {chip}
          </Tooltip>
        );
      })}
    </div>
  );
}
