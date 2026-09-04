"use client";

import React from "react";

import SettingsModal from "./SettingsModal";
import FeedbackModal from "./FeedbackModal";
import PricingModal from "./PricingModal";

/**
 * Renders whichever of the three brand-dropdown modals is currently open
 * (see useBrandModals.js). Each modal is mounted only while its own flag
 * is true, so its local form state always starts fresh on open — no
 * reset-on-reopen effect needed in any of them.
 *
 * `company`/`canManage`/`onUpdateCompany` feed Settings; `onChangePlan`
 * feeds Plan; Feedback needs neither.
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
