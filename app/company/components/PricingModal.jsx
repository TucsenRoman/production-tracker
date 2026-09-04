"use client";

import React from "react";
import { Check, Sparkles } from "lucide-react";

import { Badge, Button, Modal, cx } from "../../components/ui";

/**
 * Mock pricing tiers for the demo — there's no real billing system behind
 * this app, so these numbers/features are illustrative, not a real price
 * list. Picked to roughly track what the console actually gates by role/
 * plan tier elsewhere (locations, POS integrations, permissions).
 */
const PLANS = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    blurb: "For a single shop finding its footing.",
    features: [
      "1 location",
      "Up to 5 team members",
      "Production targets & assignments",
      "Basic inventory tracking",
    ],
  },
  {
    name: "Growth",
    price: "$149",
    period: "/mo",
    blurb: "For a few locations running in sync.",
    features: [
      "Up to 5 locations",
      "Unlimited team members",
      "POS integrations (Clover)",
      "Roles & permissions",
      "Everything in Starter",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    blurb: "For growing chains that need it all.",
    features: [
      "Unlimited locations",
      "Dedicated support",
      "Advanced permissions & audit",
      "Priority integrations support",
      "Everything in Growth",
    ],
  },
];

function PlanCard({ plan, isCurrent, onSelect }) {
  return (
    <div
      className={cx(
        "flex flex-col rounded-lg border p-3",
        isCurrent ? "border-primary bg-primary-soft" : "border-line"
      )}
    >
      {plan.highlighted && !isCurrent && (
        <Badge tone="info" className="self-start mb-1.5">
          Most popular
        </Badge>
      )}

      <h3 className="text-sm font-semibold text-ink">{plan.name}</h3>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span className="text-xl font-semibold text-ink">{plan.price}</span>
        {plan.period && <span className="text-xs text-ink-3">{plan.period}</span>}
      </p>
      <p className="mt-1 text-xs text-ink-3">{plan.blurb}</p>

      <ul className="mt-3 space-y-1.5 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-xs text-ink-2">
            <Check size={13} className="text-ok shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-3">
        {isCurrent ? (
          <Badge tone="info" className="w-full justify-center h-7">
            Current plan
          </Badge>
        ) : (
          <Button variant={plan.highlighted ? "primary" : "secondary"} size="sm" block onClick={() => onSelect(plan.name)}>
            Switch to {plan.name}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Pricing/plan modal (Sept 2026) — a new brand-dropdown entry (ConsoleShell's
 * BrandMenu, third item after Settings/Feedback), not gated behind Settings.
 * Selecting a plan applies immediately and closes, same "pick it and you're
 * done" feel as AccountSwitcherMenu's account switch — no separate Save
 * step, unlike SettingsModal's form. `onSelectPlan` is CompanyConsole's
 * `handleChangePlan`, which updates `company.plan` and shows its own toast;
 * this modal doesn't toast itself.
 */
export default function PricingModal({ onClose, currentPlan, onSelectPlan }) {
  const handleSelect = (name) => {
    onSelectPlan(name);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Plan" icon={Sparkles} size="lg">
      <div className="space-y-3">
        <p className="text-xs text-ink-3">
          This is a demo — switching plans here doesn't charge anything, it just updates what's shown as your plan.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              isCurrent={plan.name === currentPlan}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
