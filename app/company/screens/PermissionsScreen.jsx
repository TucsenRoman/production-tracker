"use client";

import React, { useState } from "react";
import {
  ListChecks,
  ShieldCheck,
  ShieldOff,
  ShieldPlus,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";

import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Modal,
  RowActions,
  ScreenToolbar,
  SearchInput,
  SectionHeading,
  Segmented,
  Slot,
  Tooltip,
  cx,
} from "../../components/ui";
import { GATED_ACTIONS, ROLE_LABEL } from "../lib/companyDomain";
import { useActionAccess } from "../lib/actionAccess";

/* Two named options rather than a Switch, so the label IS the state. The
 * loose option means nobody is asked anything, not a lesser credential. */
const PIN_MODES = [
  { value: "lead", label: "Manager PIN" },
  { value: "any", label: "No approval" },
];

/**
 * Which bucket an action is in. `targeted` is a different question ("which
 * named people") with its own control; every action lands in exactly one
 * bucket so the view counts add up to the whole list.
 */
const modeOf = (action, permissions) =>
  action.targeted ? "targeted" : permissions[action.id] ? "lead" : "any";

/* Named views with counted badges, same shape as Tasks and Team. Flipping a
 * row's mode while a mode view is active drops it out of the list on
 * purpose — the row goes where it now belongs and both counts move. */
const VIEWS = [
  { id: "all", label: "All", icon: ListChecks },
  { id: "lead", label: "Manager PIN", icon: ShieldCheck },
  { id: "any", label: "No approval", icon: ShieldOff },
  { id: "targeted", label: "By person", icon: Users },
];

/** How the named people on a targeted action read on the row's control. */
function accessSummary(people) {
  if (!people.length) return "No one";
  if (people.length <= 2) return people.map((p) => p.name).join(", ");
  return `${people.length} people`;
}

/**
 * Picker for who may do one targeted action. Everyone on the roster is
 * listed, admins included: "who is trusted to do this" is a different
 * question from "who is senior".
 */
function AccessDialog({ action, users, selected, onCancel, onSave }) {
  const [ids, setIds] = useState(selected);
  const [query, setQuery] = useState("");
  const toggle = (id) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const q = query.trim().toLowerCase();
  const visible = users.filter((u) => !q || u.name.toLowerCase().includes(q));
  const allOn = users.length > 0 && ids.length === users.length;

  /* Search only once the list is long enough to hunt through. */
  const searchable = users.length > 8;

  return (
    <Modal
      open
      onClose={onCancel}
      title={action.label}
      icon={Users}
      footer={
        <>
          {/* Nobody selected is a valid answer, but never one reached by accident. */}
          <p className={cx("mr-auto text-xs", ids.length === 0 ? "text-danger" : "text-ink-3")}>
            {ids.length === 0
              ? "No one will be able to do this."
              : `${ids.length} of ${users.length} ${users.length === 1 ? "person" : "people"}.`}
          </p>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(ids)}>
            Save
          </Button>
        </>
      }
    >
      <p className="text-xs text-ink-3 leading-relaxed">{action.detail}</p>

      <div className="flex items-center gap-2 mt-3 mb-2">
        {searchable && (
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search people…"
            className="flex-1 min-w-0"
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setIds(allOn ? [] : users.map((u) => u.id))}
        >
          {allOn ? "Clear" : "Select everyone"}
        </Button>
      </div>

      {/* Same checklist idiom as the location pickers on Team. */}
      <div className="space-y-1.5">
        {visible.map((u) => {
          const on = ids.includes(u.id);
          /* A person with no PIN can't approve anything on a tablet, so
           * ticking them buys nothing until they claim one. */
          const note = u.status !== "active" ? "invite pending" : !u.pin ? "no PIN yet" : null;
          return (
            <label
              key={u.id}
              className={cx(
                "flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer text-sm",
                on ? "border-line-strong bg-hover text-ink" : "border-line text-ink-2 hover:bg-hover",
              )}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(u.id)}
                className="accent-current"
              />
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              {note && <span className="text-xs text-warn shrink-0">{note}</span>}
              <span className="text-xs text-ink-4 shrink-0">{ROLE_LABEL[u.role]}</span>
            </label>
          );
        })}
        {visible.length === 0 && (
          <p className="text-xs text-ink-4 px-3 py-2">Nobody matches “{query}”.</p>
        )}
      </div>
    </Modal>
  );
}

/**
 * One gated action. Both shapes are name, detail, then ONE control at
 * `--ctl-h` in the value slot. No left-gutter icon: one that renders the same
 * on every row encodes nothing.
 */
function PermissionRow({ action, permissions, people, onToggle, onManageAccess, onRemove, reserveActions }) {
  const requiresLead = Boolean(permissions[action.id]);
  const names = people?.map((p) => p.name).join(", ");

  return (
    <li className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-faint">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink truncate">{action.label}</p>
        {action.detail && <p className="text-xs text-ink-3 leading-relaxed">{action.detail}</p>}
      </div>

      {action.targeted ? (
        /* The names are the control. Empty takes the danger variant: an
         * unassigned targeted action is a locked door. */
        <Tooltip label={names || "Nobody can do this yet — pick who"}>
          <Button
            size="sm"
            variant={people.length === 0 ? "danger" : "secondary"}
            icon={Users}
            className="shrink-0 max-w-[15rem]"
            onClick={() => onManageAccess(action)}
          >
            <span className="truncate min-w-0">{accessSummary(people)}</span>
          </Button>
        </Tooltip>
      ) : (
        /* The mode is the row's content, so it stays visible; only the
         *  destructive control hides. `onToggle` flips the boolean, so only
         *  call it when the picked option differs. */
        <Segmented
          size="sm"
          className="shrink-0"
          value={requiresLead ? "lead" : "any"}
          options={PIN_MODES}
          onChange={(next) => {
            if ((next === "lead") !== requiresLead) onToggle(action.id);
          }}
        />
      )}

      {action.custom ? (
        <RowActions>
          <IconButton
            label={`Remove ${action.label}`}
            icon={Trash2}
            size={14}
            onClick={onRemove}
            className="hover:text-danger"
          />
        </RowActions>
      ) : (
        /* Spacer so built-in rows line up with custom rows' trash button. */
        reserveActions && <span aria-hidden="true" className="w-[var(--ctl-h)] shrink-0" />
      )}
    </li>
  );
}

export default function PermissionsScreen({
  permissions,
  onToggle,
  customActions,
  onRemoveCustom,
  onRequest,
  users = [],
}) {
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");

  const actions = [...GATED_ACTIONS, ...customActions];

  /* From the shared store, not props: the shop floor reads the same answer
   * from a different React tree. */
  const { idsFor, setIdsFor } = useActionAccess();
  const [managing, setManaging] = useState(null);

  const peopleFor = (action) =>
    idsFor(action.id)
      .map((id) => users.find((u) => u.id === id))
      .filter(Boolean);

  const counts = Object.fromEntries(
    VIEWS.slice(1).map((v) => [v.id, actions.filter((a) => modeOf(a, permissions) === v.id).length]),
  );

  const q = query.trim().toLowerCase();
  const matches = (a) =>
    (view === "all" || modeOf(a, permissions) === view) &&
    (!q || a.label.toLowerCase().includes(q) || (a.detail || "").toLowerCase().includes(q));

  /* Subtitle names a door that is shut and shouldn't be. Neither sentence
   * fires in the resting state — a subtitle that always speaks stops being
   * read. */
  const orphaned = actions.filter((a) => a.targeted && peopleFor(a).length === 0);
  const leadCount = actions.filter((a) => modeOf(a, permissions) === "lead").length;
  const noPins = users.length > 0 && users.every((u) => !u.pin);
  const subtitle = orphaned.length ? (
    <span>
      <span className="font-medium text-ink">{orphaned[0].label}</span> has nobody assigned, so
      nobody can do it
      {orphaned.length > 1 ? ` — and ${orphaned.length - 1} more like it.` : "."}
    </span>
  ) : noPins && leadCount > 0 ? (
    <span>
      Nobody has claimed a PIN yet, so the{" "}
      <span className="font-medium text-ink">{leadCount}</span>{" "}
      {leadCount === 1 ? "action" : "actions"} below that need one can&rsquo;t be approved on the
      floor.
    </span>
  ) : null;

  /* Built-in vs custom. Headings only once there are genuinely two groups —
   * a lone "BUILT IN 7" just restates the toolbar. */
  const groups = [
    { id: "built-in", label: "Built in", icon: ShieldCheck, actions: GATED_ACTIONS.filter(matches) },
    ...(customActions.length
      ? [{ id: "custom", label: "Custom", icon: Wrench, actions: customActions.filter(matches) }]
      : []),
  ];
  const sectioned = groups.length > 1;
  const shown = groups.reduce((n, g) => n + g.actions.length, 0);

  const renderRow = (action) => (
    <PermissionRow
      key={action.id}
      action={action}
      permissions={permissions}
      people={action.targeted ? peopleFor(action) : undefined}
      onToggle={onToggle}
      onManageAccess={setManaging}
      onRemove={() => onRemoveCustom(action.id)}
      reserveActions={customActions.length > 0}
    />
  );

  return (
    <div>
      <Slot name="page-subtitle">{subtitle}</Slot>

      {/* Same toolbar shape as Tasks and Team. "Request a permission" stays
       *  secondary: the badges already spend the accent budget, and it's a
       *  utility, not what a person came here to do. */}
      <ScreenToolbar
        tabs={
          <Segmented
            value={view}
            onChange={setView}
            className="min-w-0"
            options={VIEWS.map((v) => ({
              value: v.id,
              label: v.label,
              icon: v.icon,
              /* All is the resting state, not a queue with a number. */
              count: v.id === "all" ? undefined : counts[v.id],
            }))}
          />
        }
        actions={
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search actions…"
              className="w-52"
            />
            <Button variant="secondary" icon={ShieldPlus} onClick={onRequest}>
              Request a permission
            </Button>
          </>
        }
        /* Non-obvious and inferable from nowhere else on screen. */
        status={<p className="text-xs text-ink-4">These rules apply at every location.</p>}
      />

      <div className="space-y-5">
        {shown === 0 ? (
          <div className="border-b border-line">
            <EmptyState
              icon={ShieldCheck}
              title={q ? "No actions match that" : "Nothing in this view"}
              description={
                q
                  ? `Nothing here is called “${query}”.`
                  : view === "targeted"
                    ? "No action is scoped to named people yet."
                    : "Every action is set the other way right now."
              }
              action={
                <Button variant="ghost" onClick={() => { setQuery(""); setView("all"); }}>
                  Show all actions
                </Button>
              }
            />
          </div>
        ) : sectioned ? (
          groups
            .filter((g) => g.actions.length > 0)
            .map(({ id, label, icon: Icon, actions: groupActions }) => (
              <div key={id}>
                <SectionHeading icon={Icon} label={label} count={groupActions.length} />
                <Card>
                  <ul className="divide-y divide-line">{groupActions.map(renderRow)}</ul>
                </Card>
              </div>
            ))
        ) : (
          <Card>
            <ul className="divide-y divide-line">{groups[0].actions.map(renderRow)}</ul>
          </Card>
        )}
      </div>

      {managing && (
        <AccessDialog
          action={managing}
          users={users}
          selected={idsFor(managing.id)}
          onCancel={() => setManaging(null)}
          onSave={(ids) => {
            setIdsFor(managing.id, ids);
            setManaging(null);
          }}
        />
      )}
    </div>
  );
}
