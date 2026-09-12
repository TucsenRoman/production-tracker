"use client";

import { useState } from "react";

/**
 * Open/close state for the brand-dropdown modals (Settings, Feedback, Plan),
 * shared by CompanyConsole.jsx and the Help page. `openModal` also closes the
 * dropdown, since every caller needs that pairing.
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
