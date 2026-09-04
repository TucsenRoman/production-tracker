"use client";

import { useState } from "react";

/**
 * Shared open/close state for the three modals hanging off the brand-title
 * dropdown (ConsoleShell's BrandMenu — Settings, Feedback, Plan). Factored
 * out (Sept 2026, when Plan was added as a third modal) so both
 * CompanyConsole.jsx and the standalone Help page can wire up an identical
 * brand dropdown without tripling the same three `useState`s + handlers.
 *
 * `openModal` also closes the brand dropdown itself in one call, same as
 * the old inline handleOpenSettings/handleOpenFeedback did — every caller
 * needs that pairing, so it lives here instead of at each call site.
 */
export function useBrandModals(onBrandMenuOpenChange) {
  const [open, setOpen] = useState({ settings: false, feedback: false, pricing: false });

  const openModal = (key) => {
    onBrandMenuOpenChange(false);
    setOpen((prev) => ({ ...prev, [key]: true }));
  };

  const closeModal = (key) => {
    setOpen((prev) => ({ ...prev, [key]: false }));
  };

  return { open, openModal, closeModal };
}
