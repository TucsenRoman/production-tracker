"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "./cx";
import { IconButton } from "./Button";
import type { IconComponent } from "./types";

export type ModalSize = "sm" | "md" | "lg" | "xl";

/* `xl` is for a modal whose content is a table: four columns do not fit in
 * `lg`, and a table that wraps is not a table. */
const MODAL_WIDTH: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-3xl",
};

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  /** Also the dialog's `aria-label`, so it is text rather than a node. */
  title?: string;
  icon?: IconComponent;
  footer?: ReactNode;
  size?: ModalSize;
  children?: ReactNode;
}

/**
 * Bottom sheet on phones, centred dialog from `sm` up. Closes on Escape and on
 * backdrop click; focus is moved into the panel on open.
 */
export function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  footer,
  size = "sm",
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current
      ?.querySelector<HTMLElement>("input, button, [tabindex]")
      ?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div
        className="absolute inset-0 bg-ink/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative w-full bg-surface shadow-pop",
          "rounded-t-md sm:rounded-md sm:m-4 pb-safe sm:pb-0",
          // Capped-height column: header and footer hold, the body scrolls.
          // dvh, not vh, because mobile browser chrome makes vh overshoot.
          "flex flex-col max-h-[88dvh] sm:max-h-[calc(100dvh-2rem)]",
          "animate-slide-up sm:animate-pop-in",
          MODAL_WIDTH[size],
        )}
      >
        {title && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              {Icon && <Icon size={16} className="text-icon-2 shrink-0" />}
              <h2 className="text-sm font-medium text-ink truncate">{title}</h2>
            </div>
            <IconButton label="Close" icon={X} size={17} onClick={onClose} />
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar px-4 pb-4">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-line rounded-b-md">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
