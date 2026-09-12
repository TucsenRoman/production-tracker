"use client";

import React from "react";

import SettingsModal from "./SettingsModal";
import FeedbackModal from "./FeedbackModal";
import PricingModal from "./PricingModal";

/**
 * Renders whichever brand-dropdown modal is open (see useBrandModals.js).
 * Each modal mounts only while its flag is true, so its form state starts
 * fresh on every open without a reset effect.
 */
export default function BrandModals({ open, onClose, company, canManage, onUpdateCompany, onChangePlan }) {
  return (
    <>
      {open.settings && (
        <SettingsModal
          onClose={() => onClose("settings")}
          company={company}
          canManage={canManage}
          onUpdate={onUpdateCompany}
        />
      )}

      {open.feedback && <FeedbackModal onClose={() => onClose("feedback")} />}

      {open.pricing && (
        <PricingModal
          onClose={() => onClose("pricing")}
          currentPlan={company.plan}
          onSelectPlan={onChangePlan}
        />
      )}
    </>
  );
}
