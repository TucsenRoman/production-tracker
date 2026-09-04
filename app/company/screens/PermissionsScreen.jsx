"use client";

import React from "react";
import { Pencil, ShieldCheck, ShieldPlus, Trash2, Wrench } from "lucide-react";

import {
  Button,
  Card,
  IconButton,
  RowActions,
  SectionHeading,
  Segmented,
  StickyFadeHeader,
  cx,
} from "../../components/ui";
import { GATED_ACTIONS } from "../lib/companyDomain";

/* The two PIN modes as one labelled control. They were a Badge plus a
 * Switch: the badge said the state and the switch said it again, and the
 * switch's polarity ran backwards from convention — blue/on meant *more*
 * restricted, while the looser "any station PIN" state rendered grey/off,
 * which reads as inactive rather than as permissive. You had to go back up
 * to the intro paragraph to decode it. As two named options the label is
 * the state: nothing to decode, nothing said twice. */
const PIN_MODES = [
  { value: "lead", label: "Lead PIN" },
  { value: "any", label: "Any station PIN" },
];

/** How the named people on a targeted action read in the value slot. */
function accessSummary(people) {
  if (!people.length) return "No one yet";
  if (people.length <= 2) return people.map((p) => p.name).join(", ");
  return `${people.length} people`;
}

/* Rows are list items in a flat, un-boxed list now. `group` on the row is
 * what RowActions below hangs its hover/focus reveal off; the Custom chip
 * that used to ride along on each row is gone, since the section heading
 * above already says which half of the list you're in — when there are two
 * halves to be in.
 *
 * No left-gutter icon on either row shape any more. The lock/unlock glyph
 * was a third encoding of the very binary the control below now spells out
 * in words, and once it went the targeted row's people glyph was the only
 * icon left on the list — which is exactly the odd-one-out shape that row
 * was already being read as. Both rows are now: name, detail, value. */
function PermissionRow({ action, requiresLead, people, onToggle, onManageAccess, onRemove }) {
  if (action.targeted) {
    return (
      <li className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-faint">
        <span
          aria-hidden="true"
          className="flex items-center justify-center w-7 h-7 rounded-md bg-sunken text-icon-2 shrink-0"
        >
          <ShieldCheck size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink truncate">{action.label}</p>
          {action.detail && <p className="text-xs text-ink-3 leading-relaxed">{action.detail}</p>}
        </div>
        {/* Same grammar as every other row: a readable value in the value
         *  slot, then a labelled way to change it. It used to be overlapping
         *  avatars and a bare pencil with no words on it, which next to its
         *  neighbours read as a row still loading. */}
        <div className="flex items-center gap-2.5 shrink-0">
          <p className="text-sm text-ink-2 truncate max-w-[16rem]" title={people.map((p) => p.name).join(", ")}>
            {accessSummary(people)}
          </p>
          <Button
            size="sm"
            variant="secondary"
            icon={Pencil}
            onClick={() => onManageAccess(action)}
          >
            Change people
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-faint">
      <span
        aria-hidden="true"
        className="flex items-center justify-center w-7 h-7 rounded-md bg-sunken text-icon-2 shrink-0"
      >
        <ShieldCheck size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink truncate">{action.label}</p>
        {action.detail && <p className="text-xs text-ink-3 leading-relaxed">{action.detail}</p>}
      </div>
      {/* The mode is the row's content, not one of its actions — it stays
       *  visible. Only the destructive control hides. Same `onToggle(id)`
       *  behind it as before: the handler flips the boolean, so we only
       *  call it when the picked option differs from the current one. */}
      <Segmented
        size="sm"
        className="shrink-0"
        value={requiresLead ? "lead" : "any"}
        options={PIN_MODES}
        onChange={(next) => {
          if ((next === "lead") !== requiresLead) onToggle(action.id);
        }}
      />
      {action.custom && (
        <RowActions>
          <IconButton
            label={`Remove ${action.label}`}
            icon={Trash2}
            size={14}
            onClick={onRemove}
            className="hover:text-danger"
          />
        </RowActions>
      )}
    </li>
  );
}

export default function PermissionsScreen({ permissions, onToggle, customActions, onRemoveCustom, onRequest, users = [], onManageAccess }) {
  const actions = [...GATED_ACTIONS, ...customActions];

  /* Two sections: what ships with the product, and what this company added
   * itself. */
  const groups = [
    { id: "built-in", label: "Built in", icon: ShieldCheck, actions: GATED_ACTIONS },
    ...(customActions.length
      ? [{ id: "custom", label: "Custom", icon: Wrench, actions: customActions }]
      : []),
  ];

  /* Headings only once there are genuinely two groups — don't add an
   * always-on heading back.
   *
   * The style spec's "always render a section heading, even for one group"
   * rule is about a list whose grouping is real but happens to narrow to one
   * category: there the heading still names *which* group you're in, so
   * dropping it would read as broken. Here, with no custom actions, there is
   * no second group to be told apart from — a lone "BUILT IN 6" only restates
   * the toolbar's "6 gated actions" a row above it. So one group renders as a
   * plain list, and the headings appear the moment a custom action creates a
   * real distinction to draw. */
  const sectioned = groups.length > 1;

  const renderRow = (action) => (
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
  );

  return (
    <div>
      {/* Read once, then scrolls away — so it sits above the sticky
       *  toolbar rather than riding along inside it. */}
      <p className={cx("flex items-start gap-1.5 text-xs text-ink-3 leading-relaxed", "px-3 py-2.5 rounded-md bg-sunken")}>
        <ShieldCheck size={13} className="shrink-0 mt-0.5 text-icon-2" />
        Each action either needs a Lead&rsquo;s personal PIN or can be done with any station PIN on the floor — pick
        one per row. A few are scoped to specific people instead. These rules apply company-wide, across every
        location.
      </p>

      {/* Request-a-permission was a bare text link stranded under the list;
       *  it's this screen's one real action, so it takes the toolbar slot
       *  every other screen's primary action sits in. */}
      <StickyFadeHeader pad={28}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-ink-3">
            {actions.length} gated action{actions.length === 1 ? "" : "s"}
          </p>

          {/* secondary, not primary: the accent budget on this screen is
           *  already spent by the mode column, which is the actual
           *  interaction here. Requesting a new gated action is a utility,
           *  not the one next thing a person came to this screen to do. */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="secondary" icon={ShieldPlus} onClick={onRequest}>
              Request a permission
            </Button>
          </div>
        </div>
      </StickyFadeHeader>

      {/* Rule a grouped list; box a flat one.
       *
       *  Tasks can drop the container because its section headings ARE the
       *  containing device — each ruled heading opens a group and the indent
       *  closes it. This screen has no real grouping dimension, so dropping
       *  the container AND the heading left six rows floating on an open
       *  white field with no edge anywhere: unmoored, not clean. `Card` here
       *  is still not a box — it's `border-y` only, a rule above and a rule
       *  below with the page showing through — so the group gets edges
       *  without breaking the ban on wrapping a group in a box. */}
      <div className="space-y-5">
        {sectioned ? (
          groups.map(({ id, label, icon: Icon, actions: groupActions }) => (
            <div key={id}>
              <SectionHeading icon={Icon} label={label} count={groupActions.length} />
              <Card>
                <ul className="divide-y divide-line">
                  {groupActions.map(renderRow)}
                </ul>
              </Card>
            </div>
          ))
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {groups[0].actions.map(renderRow)}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
