"use client";

import React from "react";
import { Lock, Pencil, ShieldCheck, ShieldPlus, Trash2, Unlock, UsersRound } from "lucide-react";

import { Badge, Card, IconButton, Switch, cx } from "../../components/ui";
import { GATED_ACTIONS } from "../lib/companyDomain";

const firstInitial = (name) => (name || "").trim().charAt(0).toUpperCase();

/**
 * Solid avatar fills, cycled deterministically per person — the `identity`
 * tokens in globals.css, a palette kept separate from status color (ok/
 * warn/danger/cold) and from primary/brand (both reserved elsewhere: the
 * accent's budget is "under 1% of any screen", the brand rust is "the
 * wordmark and nothing else") so this doesn't borrow meaning that belongs
 * to another part of the UI. Solid, not soft — this control is meant to
 * pop against a screen that's otherwise all neutrals and a hairline
 * accent, since it's the one row on this list that isn't a plain switch.
 */
const AVATAR_FILLS = [
  "bg-identity-1",
  "bg-identity-2",
  "bg-identity-3",
  "bg-identity-4",
];

function avatarFillFor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_FILLS[hash % AVATAR_FILLS.length];
}

/**
 * The overlapping-avatars-plus-pencil control for a `targeted` action —
 * a mock of a per-person permissions microinteraction, standing in for
 * what the rest of this list does with a single company-wide Switch.
 * Nothing wired behind the click yet (see onManage), same as every other
 * control on this screen.
 */
function TargetedAccessControl({ people, onManage, label }) {
  return (
    <button
      type="button"
      onClick={onManage}
      aria-label={label}
      className="group flex items-center -space-x-2.5 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {people.map((p) => (
        <span
          key={p.id}
          className={cx(
            "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold text-white",
            "ring-2 ring-surface shadow-xs",
            avatarFillFor(p.id)
          )}
        >
          {firstInitial(p.name)}
        </span>
      ))}
      <span
        className={cx(
          "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
          "border-2 border-solid border-line-strong bg-surface text-ink-3 ring-2 ring-surface shadow-xs",
          "transition-colors group-hover:border-primary group-hover:text-primary"
        )}
      >
        <Pencil size={13} />
      </span>
    </button>
  );
}

function PermissionRow({ action, requiresLead, people, onToggle, onManageAccess, onRemove }) {
  if (action.targeted) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-hover text-ink-3 shrink-0">
          <UsersRound size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-ink truncate">{action.label}</p>
            {action.custom && <Badge tone="neutral">Custom</Badge>}
          </div>
          {action.detail && <p className="text-xs text-ink-3 leading-relaxed">{action.detail}</p>}
        </div>
        <TargetedAccessControl
          people={people}
          onManage={() => onManageAccess(action)}
          label={`${people.map((p) => p.name).join(", ")} — click to change who can ${action.label.toLowerCase()}`}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={cx(
          "flex items-center justify-center w-7 h-7 rounded-full shrink-0",
          requiresLead ? "bg-hover text-ink" : "bg-inset text-ink-3"
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

export default function PermissionsScreen({ permissions, onToggle, customActions, onRemoveCustom, onRequest, users = [], onManageAccess }) {
  const actions = [...GATED_ACTIONS, ...customActions];

  return (
    <div className="space-y-4">
      <p className={cx("flex items-start gap-1.5 text-xs text-ink-3 leading-relaxed", "px-3 py-2.5 rounded-md bg-sunken")}>
        <ShieldCheck size={13} className="shrink-0 mt-0.5 text-icon-2" />
        Switch an action on to require a Lead's personal PIN — off, any station PIN on the floor can do it. A few
        are scoped to specific people instead — click their avatars to change who. These rules apply company-wide,
        across every location.
      </p>

      <Card className="overflow-hidden">
        <div className="divide-y divide-line">
          {actions.map((action) => (
            <PermissionRow
              key={action.id}
              action={action}
              requiresLead={Boolean(permissions[action.id])}
              people={
                action.targeted
                  ? (action.accessUserIds || []).map((id) => users.find((u) => u.id === id)).filter(Boolean)
                  : undefined
              }
              onToggle={onToggle}
              onManageAccess={onManageAccess}
              onRemove={() => onRemoveCustom(action.id)}
            />
          ))}
        </div>
      </Card>

      <button
        type="button" onClick={onRequest}
        className="flex items-center gap-1.5 px-1 text-sm font-medium text-ink-2 hover:text-ink hover:underline transition-colors"
      >
        <ShieldPlus size={15} />
        Request a permission
      </button>
    </div>
  );
}
