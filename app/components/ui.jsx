"use client";

/**
 * UI primitives.
 *
 * Every surface in the product is composed from these — screens never reach for
 * raw colour or spacing utilities. Variants are plain objects rather than a
 * class-variance library so there's no dependency to keep in step.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Search, X } from "lucide-react";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- Button -- */

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-md " +
  "transition-colors duration-100 select-none whitespace-nowrap " +
  "disabled:cursor-not-allowed disabled:opacity-55";

const BTN_VARIANT = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-xs",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken shadow-xs",
  ghost: "bg-transparent text-ink-2 hover:bg-sunken hover:text-ink",
  success: "bg-ok text-white hover:brightness-95 shadow-xs",
  danger: "bg-danger text-white hover:brightness-95 shadow-xs",
  subtle: "bg-primary-soft text-primary-ink hover:brightness-97",
};

// min-h values keep every control a comfortable target on a station tablet.
const BTN_SIZE = {
  sm: "text-xs px-2.5 min-h-8",
  md: "text-sm px-3.5 min-h-10",
  lg: "text-base px-4 min-h-12",
};

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
}) {
  const iconSize = size === "lg" ? 17 : size === "sm" ? 13 : 15;
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], block && "w-full", className)}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin shrink-0" />
      ) : (
        Icon && <Icon size={iconSize} className="shrink-0" />
      )}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} className="shrink-0" />}
    </button>
  );
}

export function IconButton({ label, icon: Icon, size = 16, className, ...rest }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex items-center justify-center w-8 h-8 rounded-md shrink-0",
        "text-ink-3 hover:text-ink hover:bg-sunken transition-colors duration-100",
        className
      )}
    >
      <Icon size={size} />
    </button>
  );
}

/* ------------------------------------------------------------------ Card -- */

export function Card({ as: Tag = "div", inset = false, className, children, ...rest }) {
  return (
    <Tag
      {...rest}
      className={cx(
        "bg-surface border border-line rounded-lg shadow-xs",
        inset && "p-4 sm:p-5",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, actions, className }) {
  return (
    <div
      className={cx(
        "flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-line",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          {Icon && <Icon size={15} className="text-ink-3 shrink-0" />}
          <span className="truncate">{title}</span>
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-ink-3 leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cx("p-4 sm:p-5", className)}>{children}</div>;
}

/* ----------------------------------------------------------------- Badge -- */

const BADGE_TONE = {
  neutral: "bg-sunken text-ink-2 border-line",
  ok: "bg-ok-soft text-ok border-ok-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  info: "bg-primary-soft text-primary-ink border-primary-soft",
  cold: "bg-cold-soft text-cold border-cold-soft",
};

export function Badge({ tone = "neutral", icon: Icon, className, children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border",
        "text-[11px] font-medium leading-5 whitespace-nowrap",
        BADGE_TONE[tone],
        className
      )}
    >
      {Icon && <Icon size={11} className="shrink-0" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Kbd/Meta */

export function MetaRow({ className, children }) {
  return (
    <div className={cx("flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3", className)}>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- Fields -- */

export function Label({ htmlFor, className, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cx("block text-xs font-medium text-ink-2 mb-1.5", className)}
    >
      {children}
    </label>
  );
}

export function Field({ label, hint, error, htmlFor, className, children }) {
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

const INPUT_BASE =
  "w-full bg-surface border rounded-md text-sm text-ink placeholder:text-ink-4 " +
  "transition-colors duration-100 focus:border-primary " +
  "disabled:bg-sunken disabled:text-ink-3";

export function Input({ invalid, className, size = "md", ...rest }) {
  const pad = size === "lg" ? "px-3 min-h-12" : "px-2.5 min-h-10";
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={cx(INPUT_BASE, pad, invalid ? "border-danger" : "border-line-strong", className)}
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
        "px-3 min-h-12 text-lg tracking-[0.4em] text-center font-mono",
        invalid ? "border-danger" : "border-line-strong",
        className
      )}
    />
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", className }) {
  return (
    <div
      className={cx(
        "flex items-center gap-2 px-3 min-h-10 bg-surface border border-line-strong rounded-md",
        "focus-within:border-primary transition-colors duration-100",
        className
      )}
    >
      <Search size={15} className="text-ink-4 shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-ink placeholder:text-ink-4"
      />
      {value && <IconButton label="Clear search" icon={X} size={14} onClick={() => onChange("")} className="w-6 h-6" />}
    </div>
  );
}

/* ------------------------------------------------------------- Segmented -- */

export function Segmented({ options, value, onChange, size = "md", className, scroll = false }) {
  const pad = size === "sm" ? "text-xs px-2.5 min-h-8" : "text-sm px-3 min-h-9";
  return (
    <div
      role="tablist"
      className={cx(
        "inline-flex gap-1 p-1 bg-sunken rounded-lg",
        scroll && "max-w-full overflow-x-auto no-scrollbar",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-medium shrink-0",
              "transition-colors duration-100 disabled:opacity-45 disabled:cursor-not-allowed",
              pad,
              active ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink-2"
            )}
          >
            {o.icon && <o.icon size={14} className="shrink-0" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- Switch */

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
        className
      )}
    >
      <span
        className={cx(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-xs",
          "transition-transform duration-150",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
}

/* ---------------------------------------------------------------- StatCard */

export function StatCard({ icon: Icon, label, value, unit, hint, tone = "neutral" }) {
  const toneClass = {
    neutral: "text-ink",
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
    primary: "text-primary-ink",
  }[tone];
  return (
    <div className="bg-surface border border-line rounded-lg shadow-xs px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-ink-3 mb-2">
        {Icon && <Icon size={13} className="shrink-0" />}
        <span className="text-[11px] font-medium uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cx("text-2xl font-semibold tnum leading-none", toneClass)}>{value}</span>
        {unit && <span className="text-xs text-ink-3 font-medium">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-xs text-ink-3 truncate">{hint}</div>}
    </div>
  );
}

export function StatGrid({ className, children }) {
  return (
    <div className={cx("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}>{children}</div>
  );
}

/* ------------------------------------------------------------ ProgressBar -- */

export function ProgressBar({ value, tone = "primary", size = "md", className }) {
  const toneClass = {
    primary: "bg-primary",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
    muted: "bg-line-strong",
  }[tone];
  const h = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className={cx("flex-1 rounded-full bg-sunken overflow-hidden", h, className)}>
      {/* width is a runtime percentage, so it stays an inline style */}
      <div
        className={cx("rounded-full transition-[width] duration-300", h, toneClass)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- EmptyState -- */

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cx("flex flex-col items-center text-center px-6 py-12", className)}>
      {Icon && (
        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-sunken text-ink-3 mb-3">
          <Icon size={19} />
        </div>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-ink-3 leading-relaxed max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- Skeleton -- */

export function Skeleton({ className }) {
  return <div className={cx("skeleton rounded-md", className)} />;
}

export function SkeletonRows({ rows = 3 }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="bg-surface border border-line rounded-lg px-4 py-3.5">
          <Skeleton className="h-4 w-40 mb-2.5" />
          <Skeleton className="h-3 w-64" />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Modal -- */

/**
 * Bottom sheet on phones, centred dialog from `sm` up. Closes on Escape and on
 * backdrop click; focus is moved into the panel on open.
 */
export function Modal({ open, onClose, title, icon: Icon, footer, size = "sm", children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector("input, button, [tabindex]")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg" }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative w-full bg-surface shadow-pop border border-line",
          "rounded-t-xl sm:rounded-xl sm:m-4 pb-safe sm:pb-0",
          "animate-slide-up sm:animate-pop-in",
          width
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2 min-w-0">
              {Icon && <Icon size={16} className="text-ink-3 shrink-0" />}
              <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
            </div>
            <IconButton label="Close" icon={X} size={17} onClick={onClose} />
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line bg-canvas rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Toasts -- */

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

const TOAST_ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TOAST_ACCENT = {
  success: "text-ok",
  error: "text-danger",
  info: "text-primary-ink",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message, { tone = "success", detail, duration = 4000 } = {}) => {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, message, detail, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={cx(
          "fixed z-[60] flex flex-col gap-2 pointer-events-none",
          // Above the mobile tab bar on phones, bottom-right on desktop.
          "left-4 right-4 bottom-20 items-stretch",
          "sm:left-auto sm:right-5 sm:bottom-5 sm:w-80 sm:items-end"
        )}
      >
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.tone];
          return (
            <div
              key={t.id}
              className={cx(
                "pointer-events-auto w-full flex items-start gap-2.5 px-3.5 py-3",
                "bg-surface border border-line rounded-lg shadow-lg animate-toast-in"
              )}
            >
              <Icon size={16} className={cx("shrink-0 mt-px", TOAST_ACCENT[t.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink leading-snug">{t.message}</p>
                {t.detail && <p className="mt-0.5 text-xs text-ink-3 leading-snug">{t.detail}</p>}
              </div>
              <IconButton label="Dismiss" icon={X} size={14} onClick={() => dismiss(t.id)} className="w-6 h-6 -mr-1 -mt-0.5" />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
