"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cx } from "./cx";
import type { IconComponent } from "./types";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "success"
  | "danger"
  | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-md " +
  "transition-colors duration-100 select-none whitespace-nowrap " +
  "disabled:cursor-not-allowed disabled:opacity-55";

// No variant carries a resting shadow. `primary` is the one filled accent on a
// screen — a second one on the same view breaks the under-1% coverage budget.
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-transparent text-ink border border-line-strong hover:bg-hover",
  ghost: "bg-transparent text-ink-2 hover:bg-hover hover:text-ink",
  success: "bg-transparent text-ok border border-ok-line hover:bg-ok-soft",
  danger:
    "bg-transparent text-danger border border-danger-line hover:bg-danger-soft",
  subtle: "bg-hover text-ink hover:bg-faint",
};

// Heights come from the density variables, so a station tablet gets a 44px
// target and a desk gets Notion's 28px without either being a special case.
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "text-xs px-2 h-[var(--ctl-h)]",
  md: "text-sm px-2.5 h-[var(--ctl-h)]",
  lg: "text-sm px-3 h-[var(--ctl-h-lg)]",
};

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconComponent;
  iconRight?: IconComponent;
  /** Swaps `icon` for a spinner and disables the button. */
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 12 : 16;
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        BTN_BASE,
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        block && "w-full",
        className,
      )}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin shrink-0" />
      ) : (
        Icon && <Icon size={iconSize} className="shrink-0" />
      )}
      {children}
      {IconRight && !loading && (
        <IconRight size={iconSize} className="shrink-0" />
      )}
    </button>
  );
}

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  label: string;
  icon: IconComponent;
  size?: number;
  /* `label` becomes a native `title` by default. Pass `title={null}` to
   * suppress it (Tooltip does this to its child so only one label shows).
   * `aria-label` is unaffected either way. */
  title?: string | null;
}

export function IconButton({
  label,
  icon: Icon,
  size = 16,
  className,
  title,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={title === null ? undefined : (title ?? label)}
      className={cx(
        "inline-flex items-center justify-center rounded-md shrink-0",
        "w-[var(--ctl-h)] h-[var(--ctl-h)]",
        "text-icon-2 hover:text-icon hover:bg-hover transition-colors duration-100",
        className,
      )}
    >
      <Icon size={size} />
    </button>
  );
}
