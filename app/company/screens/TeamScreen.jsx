"use client";

import React, { useState } from "react";
import {
  Dices,
  List,
  Mail,
  MapPin,
  Network,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  RowActions,
  SearchInput,
  SectionHeading,
  Segmented,
  StickyFadeHeader,
  cx,
} from "../../components/ui";
import {
  ROLES,
  ROLE_LABEL,
  generatePin,
  isValidEmail,
  isValidPin,
  leadPinFor,
  newCompanyId,
} from "../lib/companyDomain";

const ROLE_TONE = { admin: "info", manager: "neutral" };
const TIER_ORDER = ["admin", "manager"];

/* One icon per role, so a section is identifiable before you read it. */
const ROLE_ICON = { admin: ShieldCheck, manager: UserCog };

/* Highest rank first — the roster reads as a hierarchy, same as the floor
 * team screen. */
const ROLE_RANK = { admin: 2, manager: 1 };
const roleRank = (role) => ROLE_RANK[role] || 0;

const initials = (name) => name.split(" ").map((p) => p[0]).slice(0, 2).join("");

function LocationChecklist({ locations, selected, onToggle }) {
  if (locations.length === 0) {
    return <p className="text-xs text-ink-4">No locations to assign yet — add one first.</p>;
  }
  return (
    <div className="space-y-1.5">
      {locations.map((loc) => {
        const on = selected.includes(loc.id);
        return (
          <label
            key={loc.id}
            className={cx(
              "flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer text-sm",
              on ? "border-line-strong bg-hover text-ink" : "border-line text-ink-2 hover:bg-hover"
            )}
          >
            <input type="checkbox" checked={on} onChange={() => onToggle(loc.id)} className="accent-current" />
            {loc.name}
          </label>
        );
      })}
    </div>
  );
}

function InviteDialog({ locations, onCancel, onInvite }) {
  const [form, setForm] = useState({ name: "", email: "", role: "manager", locationIds: [] });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleLoc = (id) =>
    setForm((f) => ({
      ...f,
      locationIds: f.locationIds.includes(id) ? f.locationIds.filter((x) => x !== id) : [...f.locationIds, id],
    }));

  const valid = form.name.trim() && isValidEmail(form.email) && form.locationIds.length > 0;

  return (
    <Modal
      open
      onClose={onCancel}
      title="Invite a teammate" icon={UserPlus}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary" icon={Mail}
            disabled={!valid}
            onClick={() =>
              onInvite({
                id: newCompanyId("U"),
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                role: form.role,
                locationIds: form.locationIds,
                status: "invited",
                invitedAt: new Date().toISOString(),
              })
            }
          >
            Send invite
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input autoFocus value={form.name} placeholder="Full name" onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input
            type="email" value={form.email}
            placeholder="teammate@company.com" onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Role">
          <Segmented
            value={form.role}
            onChange={(v) => set("role", v)}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
        </Field>
        <Field label="Locations">
          <LocationChecklist locations={locations} selected={form.locationIds} onToggle={toggleLoc} />
        </Field>
      </div>
    </Modal>
  );
}

function EditDialog({ user, locations, onCancel, onSave }) {
  const [role, setRole] = useState(user.role);
  const [locationIds, setLocationIds] = useState(user.locationIds);
  const toggleLoc = (id) =>
    setLocationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Modal
      open
      onClose={onCancel}
      title={user.name}
      icon={Pencil}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave({ role, locationIds })}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Role">
          <Segmented
            value={role}
            onChange={setRole}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
        </Field>
        <Field label="Locations">
          <LocationChecklist locations={locations} selected={locationIds} onToggle={toggleLoc} />
        </Field>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------- Lead PIN chips -- */

/**
 * Deliberately not styled like the device-code dialog on Locations: this one
 * is about a person, momentarily, not a station long-term — so it talks
 * about "authorizing an action," never "signing in as."
 */
function LeadPinDialog({ user, location, existing, allPins, onCancel, onSave, onRemove }) {
  const [pin, setPin] = useState(existing?.pin || generatePin(allPins));
  const pinTaken = allPins.includes(pin) && pin !== existing?.pin;
  const valid = isValidPin(pin) && !pinTaken;

  return (
    <Modal
      open
      onClose={onCancel}
      title={existing ? `Edit lead PIN — ${user.name}` : `Issue lead PIN — ${user.name}`}
      icon={ShieldCheck}
      footer={
        <>
          {/* Revoking used to be a ~10px trash icon riding inside the roster
           *  chip. It lives here now: full-size, on the far side of the
           *  footer, behind the same deliberate open as the digits. */}
          {existing && (
            <Button variant="ghost" icon={Trash2} className="mr-auto hover:text-danger" onClick={onRemove}>
              Revoke
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" icon={Plus} disabled={!valid} onClick={() => onSave(pin)}>
            {existing ? "Save changes" : "Issue PIN"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-3 leading-relaxed">
          {user.name.split(" ")[0]} punches this in on the floor at {location.name} to authorize a gated action —
          it&rsquo;s personal to them, unlike a station&rsquo;s device code, and never shared.
        </p>
        <p className="text-xs text-ink-4 leading-relaxed">
          The roster only shows that a PIN is set. The digits are here, behind an open you had to mean, rather than
          printed down a list anyone passing the desk or watching a screenshare can read.
        </p>
        <Field label="Code" error={pinTaken ? "That code is already in use — try another." : null}>
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              inputMode="numeric" maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="font-mono tracking-[0.3em]"
            />
            <Button variant="secondary" icon={Dices} onClick={() => setPin(generatePin(allPins))}>
              Generate
            </Button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function LeadPinChips({ user, locations, crewPins, onAddPin, onUpdatePin, onRemovePin }) {
  const [editing, setEditing] = useState(null); // { location, existing }
  const assigned = locations.filter((l) => user.locationIds.includes(l.id));
  const allPins = crewPins.map((p) => p.pin);

  // Nothing to issue a PIN against. The row's own meta line already says
  // "No locations assigned", so a second sentence saying it again here would
  // be noise rather than an explanation.
  if (assigned.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {assigned.map((loc) => {
        const existing = leadPinFor(crewPins, user.id, loc.id);
        const shortName = loc.name.includes("—") ? loc.name.split("—").pop().trim() : loc.name;
        // Each chip is ONE control at --ctl-h, the height every other button
        // on the screen uses. It used to be a label plus two ~10px icon
        // buttons, the smallest targets in the app by a wide margin; edit and
        // revoke both moved into the dialog the chip opens.
        return existing ? (
          <button
            key={loc.id}
            type="button" title={`Manage lead PIN for ${loc.name}`}
            onClick={() => setEditing({ location: loc, existing })}
            className="inline-flex items-center gap-1.5 h-[var(--ctl-h)] px-2.5 rounded-full bg-sunken text-xs text-ink-3 hover:bg-hover hover:text-ink transition-colors"
          >
            <ShieldCheck size={12} className="text-icon-2 shrink-0" />
            {/* Masked, always. A floor door code printed on the roster is
             *  legible to anyone walking past the desk or watching the
             *  screenshare; the chip says a PIN exists, and the dialog
             *  behind it is where the digits are. */}
            <span>{shortName}:</span>
            <span aria-label="PIN set, hidden" className="font-mono font-semibold tracking-[0.2em] text-ink-2">
              ••••
            </span>
          </button>
        ) : (
          <button
            key={loc.id}
            type="button" title={`Issue a lead PIN for ${loc.name}`}
            onClick={() => setEditing({ location: loc, existing: null })}
            className="inline-flex items-center gap-1.5 h-[var(--ctl-h)] px-2.5 rounded-full border border-dashed border-line-strong text-xs text-ink-3 hover:text-ink hover:border-ink-4 transition-colors"
          >
            <Plus size={12} /> {shortName} PIN
          </button>
        );
      })}

      {editing && (
        <LeadPinDialog
          user={user}
          location={editing.location}
          existing={editing.existing}
          allPins={editing.existing ? allPins.filter((p) => p !== editing.existing.pin) : allPins}
          onCancel={() => setEditing(null)}
          onRemove={() => {
            if (editing.existing) onRemovePin(editing.existing.id);
            setEditing(null);
          }}
          onSave={(pin) => {
            if (editing.existing) {
              onUpdatePin(editing.existing.id, { pin });
            } else {
              onAddPin({ id: newCompanyId("PIN"), role: "lead", userId: user.id, locationId: editing.location.id, pin });
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------- List view -- */

function TeamList({ users, locations, currentUser, crewPins, onEdit, onRemove, onAddPin, onUpdatePin, onRemovePin }) {
  if (users.length === 0) {
    return (
      <div className="border-b border-line">
        <EmptyState icon={Users} title="No teammates match" description="Try a different search or filter." />
      </div>
    );
  }

  /* One section per role rather than one flat roster. Role is what you
   * actually scan this screen for, and hoisting it into a heading lets every
   * row below drop its own role chip — the section already said it. A role
   * nobody holds gets no heading; a role held by one person still gets one,
   * because a list that quietly stops sectioning itself once a group is
   * small reads as broken rather than tidy. Sort by rank first, then a
   * single pass is enough to group. */
  const ordered = [...users].sort(
    (a, b) => roleRank(b.role) - roleRank(a.role) || a.name.localeCompare(b.name)
  );
  const groups = [];
  for (const person of ordered) {
    const last = groups[groups.length - 1];
    if (last && last.role === person.role) last.people.push(person);
    else groups.push({ role: person.role, people: [person] });
  }

  return (
    <div className="space-y-5">
      {groups.map(({ role, people }) => {
        const Icon = ROLE_ICON[role] || Users;
        return (
          <div key={role}>
            <SectionHeading icon={Icon} label={ROLE_LABEL[role]} count={people.length} />

            {/* Nested under its heading rather than flush with it — with no
             *  box or divider around the list, the indent is what reads as
             *  "these belong to that heading". */}
            <ul className="pl-6">
              {people.map((u) => {
                const assigned = locations.filter((l) => u.locationIds.includes(l.id));
                // No more a single locked "owner" role — the guard now is just
                // "you can't edit or remove yourself from here" (same idea as the
                // floor roster's own self-exclusion).
                const locked = u.id === currentUser.id;
                return (
                  <li
                    key={u.id}
                    className="group flex items-center gap-3 py-3 px-1 rounded-md transition-colors hover:bg-faint"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-hover text-ink-2 text-xs font-semibold shrink-0">
                      {initials(u.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-ink truncate">{u.name}</p>
                        {u.status === "invited" && <Badge tone="warn">Invited</Badge>}
                        {u.id === currentUser.id && <Badge tone="info">You</Badge>}
                      </div>
                      <p className="text-xs text-ink-3 truncate">{u.email}</p>
                      <p className="mt-0.5 text-xs text-ink-4 truncate">
                        {assigned.length === 0 ? "No locations assigned" : assigned.map((l) => l.name).join(", ")}
                      </p>
                      {/* An invited teammate has no account to attach a
                       *  personal PIN to yet. Saying so where the chips would
                       *  be beats rendering nothing: two rows listing the same
                       *  locations, one with chips and one blank, otherwise
                       *  reads as a bug. */}
                      {u.status === "active" ? (
                        <LeadPinChips
                          user={u}
                          locations={locations}
                          crewPins={crewPins}
                          onAddPin={onAddPin}
                          onUpdatePin={onUpdatePin}
                          onRemovePin={onRemovePin}
                        />
                      ) : (
                        <p className="mt-1.5 text-xs text-ink-4">
                          Lead PINs open up once {u.name.split(" ")[0]} accepts the invite.
                        </p>
                      )}
                    </div>
                    {!locked && (
                      <RowActions>
                        <IconButton label={`Edit ${u.name}`} icon={Pencil} size={14} onClick={() => onEdit(u)} />
                        <IconButton
                          label={`Remove ${u.name}`}
                          icon={Trash2}
                          size={14}
                          onClick={() => onRemove(u.id)}
                          className="hover:text-danger"
                        />
                      </RowActions>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- Hierarchy view -- */

function PersonCard({ user, currentUser, locations, onEdit, onRemove }) {
  const assigned = locations.filter((l) => user.locationIds.includes(l.id));
  const locked = user.id === currentUser.id;

  return (
    <div className="w-56 shrink-0 rounded-md border border-line bg-surface p-3 shadow-xs">
      <div className="flex items-start gap-2.5">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-hover text-ink-2 text-xs font-semibold shrink-0">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-ink truncate">{user.name}</p>
            {user.id === currentUser.id && <Badge tone="info">You</Badge>}
          </div>
          <p className="text-xs text-ink-3 truncate">{user.email}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-line">
        <span className="min-w-0 flex-1 text-xs text-ink-4 truncate">
          {assigned.length === 0 ? "No locations" : assigned.map((l) => l.name).join(", ")}
        </span>
        {!locked && (
          <div className="flex items-center gap-0.5 shrink-0">
            <IconButton label={`Edit ${user.name}`} icon={Pencil} size={12} onClick={() => onEdit(user)} />
            <IconButton
              label={`Remove ${user.name}`}
              icon={Trash2}
              size={12}
              onClick={() => onRemove(user.id)}
              className="hover:text-danger"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center">
      <span className="w-px h-5 bg-line-strong" />
    </div>
  );
}

function TeamHierarchy({ users, locations, currentUser, onEdit, onRemove }) {
  const active = users.filter((u) => u.status === "active");
  const pending = users.filter((u) => u.status !== "active");

  const byTier = Object.fromEntries(TIER_ORDER.map((t) => [t, active.filter((u) => u.role === t)]));

  const managerGroups = [];
  const managers = byTier.manager;
  const grouped = new Set();
  locations.forEach((loc) => {
    const here = managers.filter((m) => m.locationIds.includes(loc.id));
    if (here.length) {
      here.forEach((m) => grouped.add(m.id));
      managerGroups.push({ key: loc.id, label: loc.name, people: here });
    }
  });
  const unassigned = managers.filter((m) => !grouped.has(m.id));
  if (unassigned.length) managerGroups.push({ key: "unassigned", label: "No location assigned", people: unassigned });

  if (active.length === 0) {
    return (
      <div className="border-b border-line">
        <EmptyState icon={Network} title="Nothing to chart yet" description="Invite a teammate to see your org take shape." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {byTier.admin.length > 0 && (
        <section>
          <SectionHeading
            icon={ROLE_ICON.admin}
            label={ROLE_LABEL.admin}
            count={byTier.admin.length}
            className="mb-3"
          />
          <div className="flex flex-wrap justify-center gap-3">
            {byTier.admin.map((u) => (
              <PersonCard key={u.id} user={u} currentUser={currentUser} locations={locations} onEdit={onEdit} onRemove={onRemove} />
            ))}
          </div>
        </section>
      )}

      {byTier.manager.length > 0 && (
        <>
          <Connector />
          <section>
            <SectionHeading
              icon={ROLE_ICON.manager}
              label={ROLE_LABEL.manager}
              count={byTier.manager.length}
              className="mb-3"
            />
            <div className="flex flex-wrap justify-center gap-4">
              {managerGroups.map((group) => (
                <div key={group.key} className="rounded-md border border-line bg-sunken/60 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3 mb-2.5">
                    <MapPin size={11} /> {group.label}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {group.people.map((u) => (
                      <PersonCard key={u.id} user={u} currentUser={currentUser} locations={locations} onEdit={onEdit} onRemove={onRemove} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {pending.length > 0 && (
        <section className="pt-2 border-t border-line">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3 mt-4 mb-2.5">
            <Mail size={12} /> Pending invites ({pending.length}) — not yet part of the chart
          </p>
          <div className="flex flex-wrap gap-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-dashed border-line-strong text-xs text-ink-3"
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sunken text-ink-4 text-xs font-semibold">
                  {initials(u.name)}
                </span>
                <span>{u.name}</span>
                <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Root -- */

export default function TeamScreen({
  users,
  locations,
  currentUser,
  crewPins,
  onInvite,
  onUpdate,
  onRemove,
  onAddPin,
  onUpdatePin,
  onRemovePin,
}) {
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(null);

  const visible = users.filter((u) => {
    if (status !== "all" && u.status !== status) return false;
    const q = query.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div>
      {/* One page-level toolbar, same as the Tasks screen: the view switch,
       *  the filters that belong to it and the one primary action, all in a
       *  single row that stays put while the roster scrolls under it and
       *  fades its own bottom edge. The two Segmented controls in the
       *  dialogs below are form fields, not view state, so they stay put. */}
      <StickyFadeHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: "List", icon: List },
                { value: "hierarchy", label: "Hierarchy", icon: Network },
              ]}
            />
            {view === "list" && (
              <Segmented
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "invited", label: "Invited" },
                ]}
              />
            )}
            {view === "list" && (
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search teammates…"
                className="flex-1 min-w-52"
              />
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>
              Invite
            </Button>
          </div>
        </div>
      </StickyFadeHeader>

      <div className="space-y-5">
        {view === "list" ? (
          <TeamList
            users={visible}
            locations={locations}
            currentUser={currentUser}
            crewPins={crewPins}
            onEdit={setEditing}
            onRemove={onRemove}
            onAddPin={onAddPin}
            onUpdatePin={onUpdatePin}
            onRemovePin={onRemovePin}
          />
        ) : (
          <TeamHierarchy users={users} locations={locations} currentUser={currentUser} onEdit={setEditing} onRemove={onRemove} />
        )}
      </div>

      {inviting && (
        <InviteDialog
          locations={locations}
          onCancel={() => setInviting(false)}
          onInvite={(user) => {
            onInvite(user);
            setInviting(false);
          }}
        />
      )}

      {editing && (
        <EditDialog
          user={editing}
          locations={locations}
          onCancel={() => setEditing(null)}
          onSave={(patch) => {
            onUpdate(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
