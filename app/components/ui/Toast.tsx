"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cx } from "./cx";
import { IconButton } from "./Button";
import type { IconComponent } from "./types";

export type ToastTone = "success" | "error" | "info";

export interface ToastOptions {
  tone?: ToastTone;
  detail?: ReactNode;
  /** ms before it dismisses itself. `0` keeps it up. */
  duration?: number;
}

/** Returns the toast's id. Nothing reads it today; it is the handle a manual
 *  dismiss API would need. */
export type ToastFn = (message: ReactNode, options?: ToastOptions) => number;

interface ToastItem {
  id: number;
  message: ReactNode;
  detail?: ReactNode;
  tone: ToastTone;
}

const ToastContext = createContext<ToastFn>(() => 0);
export const useToast = (): ToastFn => useContext(ToastContext);

const TOAST_ICON: Record<ToastTone, IconComponent> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};
const TOAST_ACCENT: Record<ToastTone, string> = {
  success: "text-ok",
  error: "text-danger",
  info: "text-primary",
};

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  const toast = useCallback<ToastFn>(
    (message, { tone = "success", detail, duration = 4000 } = {}) => {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, message, detail, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
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
          "sm:left-auto sm:right-5 sm:bottom-5 sm:w-80 sm:items-end",
        )}
      >
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.tone];
          return (
            <div
              key={t.id}
              className={cx(
                "pointer-events-auto w-full flex items-start gap-2.5 px-3 py-2.5",
                "bg-surface rounded-md shadow-md animate-toast-in",
              )}
            >
              <Icon
                size={16}
                className={cx("shrink-0 mt-px", TOAST_ACCENT[t.tone])}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t.message}</p>
                {t.detail && (
                  <p className="mt-0.5 text-xs text-ink-3">{t.detail}</p>
                )}
              </div>
              <IconButton
                label="Dismiss"
                icon={X}
                size={14}
                onClick={() => dismiss(t.id)}
                className="w-6 h-6 -mr-1 -mt-0.5"
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
