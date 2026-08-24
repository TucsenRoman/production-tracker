"use client";

import React, { useState } from "react";
import { List, Mail, MapPin, Network, Pencil, Trash2, UserPlus, Users } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SearchInput,
  Segmented,
  cx,
} from "../../components/ui";
import { ROLES, ROLE_LABEL, ROLE_LOCKED, isValidEmail, newCompanyId } from "../lib/companyDomain";

const ROLE_TONE = { owner: "info", admin: "ok", manager: "neutral" };
const TIER_ORDER = ["owner", "admin", "manager"];
const TIER_LABEL = { owner: "Owner", admin: "Admins", manager: "Managers" };

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
              on ? "border-primary bg-primary-soft text-primary-ink" : "border-line-strong text-ink-2 hover:bg-sunken"
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
      title="Invite a teammate"
      icon={UserPlus}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Mail}
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
            type="email"
            value={form.email}
            placeholder="teammate@company.com"
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Role">
          <Segmented
            value={form.role}
            onChange={(v) => set("role", v)}
            options={ROLES.filter((r) => r !== "owner").map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
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
            options={ROLES.filter((r) => r !== "owner").map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
        </Field>
        <Field label="Locations">
          <LocationChecklist locations={locations} selected={locationIds} onToggle={toggleLoc} />
        </Field>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------- List view -- */

function TeamList({ users, locations, currentUser, onEdit, onRemove }) {
  if (users.length === 0) {
    return (
      <Card>
        <EmptyState icon={Users} title="No teammates match" description="Try a different search or filter." />
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-line">
        {users.map((u) => {
          const assigned = locations.filter((l) => u.locationIds.includes(l.id));
          const locked = ROLE_LOCKED[u.role];
          return (
            <div key={u.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-soft text-primary-ink text-xs font-semibold shrink-0">
                {initials(u.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-ink truncate">{u.name}</p>
                  <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  {u.status === "invited" && <Badge tone="warn">Invited</Badge>}
                  {u.id === currentUser.id && <Badge tone="info">You</Badge>}
                </div>
                <p className="text-xs text-ink-3 truncate">{u.email}</p>
                <p className="mt-0.5 text-xs text-ink-4 truncate">
                  {assigned.length === 0 ? "No locations assigned" : assigned.map((l) => l.name).join(", ")}
                </p>
              </div>
              {!locked && (
                <div className="flex items-center gap-1 shrink-0">
                  <IconButton label={`Edit ${u.name}`} icon={Pencil} size={14} onClick={() => onEdit(u)} />
                  <IconButton
                    label={`Remove ${u.name}`}
                    icon={Trash2}
                    size={14}
                    onClick={() => onRemove(u.id)}
                    className="hover:text-danger"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* --------------------------------------------------------- Hierarchy view -- */

function PersonCard({ user, currentUser, locations, onEdit, onRemove }) {
  const assigned = locations.filter((l) => user.locationIds.includes(l.id));
  const locked = ROLE_LOCKED[user.role];

  return (
    <div className="w-56 shrink-0 rounded-lg border border-line bg-surface p-3 shadow-xs">
      <div className="flex items-start gap-2.5">
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-soft text-primary-ink text-xs font-semibold shrink-0">
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

function TierLabel({ tier, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{TIER_LABEL[tier]}</span>
      <span className="text-[11px] text-ink-4">
        {count} {count === 1 ? "person" : "people"}
      </span>
      <span className="flex-1 h-px bg-line" />
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
      <Card>
        <EmptyState icon={Network} title="Nothing to chart yet" description="Invite a teammate to see your org take shape." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {byTier.owner.length > 0 && (
        <section>
          <TierLabel tier="owner" count={byTier.owner.length} />
          <div className="flex flex-wrap justify-center gap-3">
            {byTier.owner.map((u) => (
              <PersonCard key={u.id} user={u} currentUser={currentUser} locations={locations} onEdit={onEdit} onRemove={onRemove} />
            ))}
          </div>
        </section>
      )}

      {byTier.admin.length > 0 && (
        <>
          <Connector />
          <section>
            <TierLabel tier="admin" count={byTier.admin.length} />
            <div className="flex flex-wrap justify-center gap-3">
              {byTier.admin.map((u) => (
                <PersonCard key={u.id} user={u} currentUser={currentUser} locations={locations} onEdit={onEdit} onRemove={onRemove} />
              ))}
            </div>
          </section>
        </>
      )}

      {byTier.manager.length > 0 && (
        <>
          <Connector />
          <section>
            <TierLabel tier="manager" count={byTier.manager.length} />
            <div className="flex flex-wrap justify-center gap-4">
              {managerGroups.map((group) => (
                <div key={group.key} className="rounded-xl border border-line bg-sunken/60 p-3">
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
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sunken text-ink-4 text-[10px] font-semibold">
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

export default function TeamScreen({ users, locations, currentUser, onInvite, onUpdate, onRemove }) {
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
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "List", icon: List },
            { value: "hierarchy", label: "Hierarchy", icon: Network },
          ]}
        />
        {view === "list" && (
          <SearchInput value={query} onChange={setQuery} placeholder="Search teammates…" className="flex-1 min-w-52" />
        )}
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
        <Button variant="primary" icon={UserPlus} className={view === "hierarchy" ? "ml-auto" : ""} onClick={() => setInviting(true)}>
          Invite
        </Button>
      </div>

      {view === "list" ? (
        <TeamList users={visible} locations={locations} currentUser={currentUser} onEdit={setEditing} onRemove={onRemove} />
      ) : (
        <TeamHierarchy users={users} locations={locations} currentUser={currentUser} onEdit={setEditing} onRemove={onRemove} />
      )}

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
