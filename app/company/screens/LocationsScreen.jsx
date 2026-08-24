"use client";

import React, { useState } from "react";
import { ArrowLeft, Dices, Factory, KeyRound, MapPin, Pencil, Plus, Store, Trash2, Users } from "lucide-react";

import { Badge, Button, Card, EmptyState, Field, IconButton, Input, Modal, cx } from "../../components/ui";
import { generatePin, isValidPin, newCompanyId, stationPinsFor } from "../lib/companyDomain";

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

/* ------------------------------------------------------- Device code dialog -- */

/**
 * A device code is deliberately NOT framed like the lead PIN dialog on Team —
 * no name, no "who is this." It just identifies a tablet to a station, so the
 * only real choices are an optional label (for when a station runs more than
 * one tablet at once) and the code itself.
 */
function DeviceDialog({ location, station, existing, allPins, onCancel, onSave }) {
  const [form, setForm] = useState(existing || { label: "", pin: generatePin(allPins) });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pinTaken = allPins.includes(form.pin) && form.pin !== existing?.pin;
  const valid = isValidPin(form.pin) && !pinTaken;

  return (
    <Modal
      open
      onClose={onCancel}
      title={existing ? `Edit device — ${station}` : `New device — ${station}`}
      icon={KeyRound}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" icon={Plus} disabled={!valid} onClick={() => onSave(form)}>
            {existing ? "Save changes" : "Add device"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-3 leading-relaxed">
          This code is what a tablet at {location.name} punches in to identify itself as the {station} station for
          the shift — it&rsquo;s not a personal login, so anyone working {station} uses the same one.
        </p>
        <Field
          label="Device label (optional)"
          hint='Only needed if this station runs more than one tablet at once — e.g. "Tablet 2".'
        >
          <Input
            autoFocus
            value={form.label || ""}
            placeholder="Leave blank for a single tablet"
            onChange={(e) => set("label", e.target.value)}
          />
        </Field>
        <Field label="Code" error={pinTaken ? "That code is already in use — try another." : null}>
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              maxLength={4}
              value={form.pin}
              onChange={(e) => set("pin", e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="font-mono tracking-[0.3em] text-center"
            />
            <Button variant="secondary" icon={Dices} onClick={() => set("pin", generatePin(allPins))}>
              Generate
            </Button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function StationDevices({ location, station, crewPins, allPins, canManagePins, onAddPin, onUpdatePin, onRemovePin }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const devices = stationPinsFor(crewPins, location.id, station);

  return (
    <div className="px-4 sm:px-5 py-3.5 border-b border-line last:border-b-0">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          <Factory size={14} className="text-ink-3 shrink-0" /> {station}
        </span>
        {canManagePins && !adding && (
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding(true)}>
            Add device
          </Button>
        )}
      </div>

      {devices.length === 0 && !adding ? (
        <p className="text-xs text-ink-4">No device code set up yet.</p>
      ) : (
        <div className="space-y-1.5">
          {devices.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-sunken">
              <span className="font-mono text-xs font-semibold tracking-wider text-ink-2 shrink-0">{p.pin}</span>
              <span className="flex-1 min-w-0 truncate text-xs text-ink-3">{p.label || "Single tablet"}</span>
              {canManagePins && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <IconButton label={`Edit device code ${p.pin}`} icon={Pencil} size={13} onClick={() => setEditing(p)} />
                  <IconButton
                    label={`Remove device code ${p.pin}`}
                    icon={Trash2}
                    size={13}
                    onClick={() => onRemovePin(p.id)}
                    className="hover:text-danger"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-2">
          <DeviceDialog
            location={location}
            station={station}
            allPins={allPins}
            onCancel={() => setAdding(false)}
            onSave={(form) => {
              onAddPin({ id: newCompanyId("PIN"), locationId: location.id, role: "station", station, ...form });
              setAdding(false);
            }}
          />
        </div>
      )}

      {editing && (
        <DeviceDialog
          location={location}
          station={station}
          existing={editing}
          allPins={allPins.filter((pin) => pin !== editing.pin)}
          onCancel={() => setEditing(null)}
          onSave={(form) => {
            onUpdatePin(editing.id, form);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Detail view -- */

function LocationDetail({
  location,
  users,
  stations,
  crewPins,
  canManage,
  canManagePins,
  onBack,
  onUpdate,
  onRemove,
  onAddPin,
  onUpdatePin,
  onRemovePin,
}) {
  const [editingInfo, setEditingInfo] = useState(false);
  const team = users.filter((u) => u.locationIds.includes(location.id) && u.status === "active");
  const allPins = crewPins.map((p) => p.pin);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
      >
        <ArrowLeft size={15} /> Locations
      </button>

      {editingInfo ? (
        <LocationForm
          initial={location}
          onCancel={() => setEditingInfo(false)}
          onSave={(form) => {
            onUpdate(location.id, form);
            setEditingInfo(false);
          }}
        />
      ) : (
        <Card inset>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-soft text-primary-ink shrink-0">
                <Store size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{location.name}</p>
                <p className="mt-0.5 flex items-start gap-1 text-xs text-ink-3">
                  <MapPin size={11} className="shrink-0 mt-0.5" /> {location.address}
                </p>
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-1 shrink-0">
                <IconButton label={`Edit ${location.name}`} icon={Pencil} size={14} onClick={() => setEditingInfo(true)} />
                <IconButton
                  label={`Remove ${location.name}`}
                  icon={Trash2}
                  size={14}
                  onClick={onRemove}
                  className="hover:text-danger"
                />
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-line flex items-center gap-1.5 text-xs text-ink-3">
            <Users size={12} /> {team.length} team member{team.length === 1 ? "" : "s"} here
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-line">
          <h3 className="text-sm font-semibold text-ink">Floor stations</h3>
          <p className="mt-0.5 text-xs text-ink-3 leading-relaxed">
            Every station here gets its own device code, separate from any other location — that&rsquo;s what keeps
            two buildings&rsquo; tablets from ever colliding.
          </p>
        </div>
        {stations.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="No stations set up yet"
            description="Add a station from the Stations screen, then come back here to give it a device code."
          />
        ) : (
          <div>
            {stations.map((station) => (
              <StationDevices
                key={station}
                location={location}
                station={station}
                crewPins={crewPins}
                allPins={allPins}
                canManagePins={canManagePins}
                onAddPin={onAddPin}
                onUpdatePin={onUpdatePin}
                onRemovePin={onRemovePin}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------- Root -- */

export default function LocationsScreen({
  locations,
  users,
  stations,
  crewPins,
  canManage,
  canManagePins,
  onAdd,
  onUpdate,
  onRemove,
  onAddPin,
  onUpdatePin,
  onRemovePin,
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);

  const openLocation = locations.find((l) => l.id === openId);
  if (openLocation) {
    return (
      <LocationDetail
        location={openLocation}
        users={users}
        stations={stations}
        crewPins={crewPins}
        canManage={canManage}
        canManagePins={canManagePins}
        onBack={() => setOpenId(null)}
        onUpdate={onUpdate}
        onRemove={() => onRemove(openLocation.id)}
        onAddPin={onAddPin}
        onUpdatePin={onUpdatePin}
        onRemovePin={onRemovePin}
      />
    );
  }

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
            const pinCount = crewPins.filter((p) => p.locationId === loc.id && p.role === "station").length;
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
                <button
                  onClick={() => setOpenId(loc.id)}
                  className={cx(
                    "mt-3 w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md",
                    "bg-sunken hover:bg-line/60 text-sm font-medium text-ink-2 hover:text-ink transition-colors duration-100"
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <KeyRound size={14} className="shrink-0" /> Floor stations
                  </span>
                  <span className="text-xs text-ink-3">
                    {pinCount} code{pinCount === 1 ? "" : "s"} →
                  </span>
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
