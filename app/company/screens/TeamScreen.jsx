"use client";

import React, { useState } from "react";
import { Mail, Pencil, Trash2, UserPlus, Users } from "lucide-react";

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

const ROLE_TONE = { owner: "info", admin: "ok", manager: "neutral", staff: "neutral" };

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

export default function TeamScreen({ users, locations, currentUser, onInvite, onUpdate, onRemove }) {
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
        <SearchInput value={query} onChange={setQuery} placeholder="Search teammates…" className="flex-1 min-w-52" />
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "invited", label: "Invited" },
          ]}
        />
        <Button variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>
          Invite
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No teammates match"
            description="Invite managers and admins to help run your locations."
            action={
              <Button variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>
                Invite a teammate
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {visible.map((u) => {
              const assigned = locations.filter((l) => u.locationIds.includes(l.id));
              const locked = ROLE_LOCKED[u.role];
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-soft text-primary-ink text-xs font-semibold shrink-0">
                    {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
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
                      <IconButton label={`Edit ${u.name}`} icon={Pencil} size={14} onClick={() => setEditing(u)} />
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
