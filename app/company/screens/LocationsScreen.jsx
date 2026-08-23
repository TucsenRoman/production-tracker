"use client";

import React, { useState } from "react";
import { MapPin, Pencil, Plus, Store, Trash2, Users } from "lucide-react";

import { Badge, Button, Card, EmptyState, Field, IconButton, Input, cx } from "../../components/ui";
import { newCompanyId } from "../lib/companyDomain";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
];

function Select({ value, onChange, options, className }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        "w-full px-2.5 min-h-10 bg-surface border border-line-strong rounded-md text-sm text-ink",
        "focus:border-primary transition-colors duration-100",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function LocationForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(
    initial || { name: "", address: "", timezone: "America/Chicago" }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim() && form.address.trim();

  return (
    <Card inset className="space-y-4">
      <Field label="Location name">
        <Input
          autoFocus
          value={form.name}
          placeholder="e.g. Milaca Meats — Main St"
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <Field label="Address">
        <Input
          value={form.address}
          placeholder="Street, city, state, ZIP"
          onChange={(e) => set("address", e.target.value)}
        />
      </Field>
      <Field label="Timezone">
        <Select value={form.timezone} onChange={(v) => set("timezone", v)} options={TIMEZONES} />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" icon={Plus} disabled={!valid} onClick={() => onSave(form)}>
          {initial ? "Save changes" : "Add location"}
        </Button>
      </div>
    </Card>
  );
}

export default function LocationsScreen({ locations, users, canManage, onAdd, onUpdate, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-3">
          {locations.length} location{locations.length === 1 ? "" : "s"}
        </p>
        {canManage && !adding && (
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Add location
          </Button>
        )}
      </div>

      {adding && (
        <LocationForm
          onCancel={() => setAdding(false)}
          onSave={(form) => {
            onAdd({ id: newCompanyId("LOC"), ...form });
            setAdding(false);
          }}
        />
      )}

      {locations.length === 0 && !adding ? (
        <Card>
          <EmptyState
            icon={Store}
            title="No locations yet"
            description="Each location gets its own staff, inventory, and Clover connection."
            action={
              canManage ? (
                <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                  Add your first location
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {locations.map((loc) => {
            const team = users.filter((u) => u.locationIds.includes(loc.id));
            if (editing === loc.id) {
              return (
                <LocationForm
                  key={loc.id}
                  initial={loc}
                  onCancel={() => setEditing(null)}
                  onSave={(form) => {
                    onUpdate(loc.id, form);
                    setEditing(null);
                  }}
                />
              );
            }
            return (
              <Card key={loc.id} inset>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-soft text-primary-ink shrink-0">
                      <Store size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{loc.name}</p>
                      <p className="mt-0.5 flex items-start gap-1 text-xs text-ink-3">
                        <MapPin size={11} className="shrink-0 mt-0.5" /> {loc.address}
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <IconButton label={`Edit ${loc.name}`} icon={Pencil} size={14} onClick={() => setEditing(loc.id)} />
                      <IconButton
                        label={`Remove ${loc.name}`}
                        icon={Trash2}
                        size={14}
                        onClick={() => onRemove(loc.id)}
                        className="hover:text-danger"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
                    <Users size={12} /> {team.length} team member{team.length === 1 ? "" : "s"}
                  </span>
                  <Badge tone="neutral">
                    {TIMEZONES.find((t) => t.value === loc.timezone)?.label || loc.timezone}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
