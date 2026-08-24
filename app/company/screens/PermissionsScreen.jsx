"use client";

import React from "react";
import { Lock, ShieldCheck, ShieldPlus, Trash2, Unlock } from "lucide-react";

import { Badge, Card, IconButton, Switch, cx } from "../../components/ui";
import { GATED_ACTIONS } from "../lib/companyDomain";

function PermissionRow({ action, requiresLead, onToggle, onRemove }) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
      <span
        className={cx(
          "flex items-center justify-center w-9 h-9 rounded-full shrink-0",
          requiresLead ? "bg-primary-soft text-primary-ink" : "bg-sunken text-ink-3"
        )}
      >
        {requiresLead ? <Lock size={15} /> : <Unlock size={15} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-ink truncate">{action.label}</p>
          {action.custom && <Badge tone="neutral">Custom</Badge>}
        </div>
        {action.detail && <p className="text-xs text-ink-3 leading-relaxed">{action.detail}</p>}
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <Badge tone={requiresLead ? "info" : "neutral"}>{requiresLead ? "Lead PIN" : "Any station PIN"}</Badge>
        <Switch
          checked={requiresLead}
          onChange={() => onToggle(action.id)}
          label={`Require a Lead PIN for ${action.label}`}
        />
        {action.custom && (
          <IconButton
            label={`Remove ${action.label}`}
            icon={Trash2}
            size={14}
            onClick={onRemove}
            className="hover:text-danger"
          />
        )}
      </div>
    </div>
  );
}

export default function PermissionsScreen({ permissions, onToggle, customActions, onRemoveCustom, onRequest }) {
  const actions = [...GATED_ACTIONS, ...customActions];

  return (
    <div className="space-y-4">
      <p className={cx("flex items-start gap-1.5 text-xs text-ink-3 leading-relaxed", "px-3 py-2.5 rounded-lg bg-sunken")}>
        <ShieldCheck size={13} className="shrink-0 mt-0.5 text-primary-ink" />
        Switch an action on to require a Lead's personal PIN — off, any station PIN on the floor can do it. These
        rules apply company-wide, across every location.
      </p>

      <Card className="overflow-hidden">
        <div className="divide-y divide-line">
          {actions.map((action) => (
            <PermissionRow
              key={action.id}
              action={action}
              requiresLead={Boolean(permissions[action.id])}
              onToggle={onToggle}
              onRemove={() => onRemoveCustom(action.id)}
            />
          ))}
        </div>
      </Card>

      <button
        type="button"
        onClick={onRequest}
        className="flex items-center gap-1.5 px-1 text-sm font-medium text-primary-ink hover:text-primary transition-colors"
      >
        <ShieldPlus size={15} />
        Request a permission
      </button>
    </div>
  );
}
