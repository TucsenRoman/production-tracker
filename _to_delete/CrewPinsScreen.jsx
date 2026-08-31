"use client";

import React, { useState } from "react";
import { Dices, Factory, Flame, KeyRound, Package, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";

import { Badge, Button, Card, EmptyState, Field, IconButton, Input, Modal, Segmented, cx } from "../../components/ui";
import { CREW_ROLE_LABEL, CREW_ROLES, generatePin, isValidPin, newCompanyId } from "../lib/companyDomain";

const CREW_ROLE_TONE = { crew: "neutral", lead: "info" };
const STATION_ICON = { Smokehouse: Flame, Packaging: Package };

function PinDialog({ location, existing, allPins, stations, onCancel, onSave }) {
  const [form, setForm] = useState(
    existing || { role: "crew", station: stations[0] || "", label: "", name: "", pin: generatePin(allPins) }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pinTaken = allPins.includes(form.pin) && form.pin !== existing?.pin;
  const identityValid = form.role === "lead" ? form.name.trim().length > 0 : Boolean(form.station);
  const valid = identityValid && isValidPin(form.pin) && !pinTaken;

  return (
    <Modal
      open
      onClose={onCancel}
      title={existing ? "Edit PIN" : `New PIN — ${location.name}`}
      icon={KeyRound}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" icon={Plus} disabled={!valid} onClick={() => onSave(form)}>
            {existing ? "Save changes" : "Add PIN"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type" hint={form.role === "crew" ? "Belongs to the station — anyone on that shift uses it. No name attached." : "Belongs to a person — a manager or lead's own PIN, kept for accountability."}>
          <Segmented
            value={form.role}
            onChange={(v) => set("role", v)}
            options={CREW_ROLES.map((r) => ({ value: r, label: CREW_ROLE_LABEL[r] }))}
          />
        </Field>

        {form.role === "crew" ? (
          <>
            <Field
              label="Station"
              hint={stations.length === 0 ? "No stations set up yet — add one from the Stations screen first." : null}
            >
              <Segmented value={form.station} onChange={(v) => set("station", v)} options={stations.map((s) => ({ value: s, label: s }))} />
            </Field>
            <Field label="Shift label (optional)" hint='e.g. "AM shift" — only needed if this station runs more than one PIN.'>
              <Input
                autoFocus
                value={form.label || ""}
                placeholder="Leave blank for a single shift"
                onChange={(e) => set("label", e.target.value)}
              />
            </Field>
          </>
        ) : (
          <Field label="Name" hint="This PIN is theirs — swap it out only if the person changes.">
            <Input autoFocus value={form.name || ""} placeholder="Full name" onChange={(e) => set("name", e.target.value)} />
          </Field>
        )}

        <Field label="PIN" error={pinTaken ? "That PIN is already in use — try another." : null}>
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

function PinRow({ pin: p, onEdit, onRemove }) {
  const StationIcon = p.station ? STATION_ICON[p.station] || Factory : ShieldCheck;
  const title = p.role === "lead" ? p.name : p.station;
  const subtitle = p.role === "lead" ? "Lead — personal PIN" : p.label ? p.label : "Station PIN — any shift";

  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3">
      <span className="flex items-center justify-center w-9 h-9 rounded-full bg-sunken text-ink-2 text-[11px] font-mono font-semibold shrink-0 tracking-wider">
        {p.pin}
      </span>
      <StationIcon size={15} className="text-ink-3 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-ink truncate">{title}</p>
          <Badge tone={CREW_ROLE_TONE[p.role]}>{CREW_ROLE_LABEL[p.role]}</Badge>
        </div>
        <p className="text-xs text-ink-3">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <IconButton label={`Edit PIN ${p.pin}`} icon={Pencil} size={14} onClick={onEdit} />
        <IconButton label={`Remove PIN ${p.pin}`} icon={Trash2} size={14} onClick={onRemove} className="hover:text-danger" />
      </div>
    </div>
  );
}

function LocationPinList({ location, pins, allPins, stations, onAdd, onUpdate, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-line">
        <div>
          <h3 className="text-sm font-semibold text-ink">{location.name}</h3>
          <p className="text-xs text-ink-3">{location.address}</p>
        </div>
        {!adding && (
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Add PIN
          </Button>
        )}
      </div>

      {pins.length === 0 ? (
        <p className="px-4 sm:px-5 py-6 text-center text-xs text-ink-4">No PINs issued at this location yet.</p>
      ) : (
        <div className="divide-y divide-line">
          {pins.map((p) => (
            <PinRow key={p.id} pin={p} onEdit={() => setEditing(p)} onRemove={() => onRemove(p.id)} />
          ))}
        </div>
      )}

      {adding && (
        <PinDialog
          location={location}
          allPins={allPins}
          stations={stations}
          onCancel={() => setAdding(false)}
          onSave={(form) => {
            onAdd({ id: newCompanyId("PIN"), locationId: location.id, ...form });
            setAdding(false);
          }}
        />
      )}

      {editing && (
        <PinDialog
          location={location}
          existing={editing}
          allPins={allPins.filter((pin) => pin !== editing.pin)}
          stations={stations}
          onCancel={() => setEditing(null)}
          onSave={(form) => {
            onUpdate(editing.id, form);
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

export default function CrewPinsScreen({ locations, stations, crewPins, onAdd, onUpdate, onRemove }) {
  const allPins = crewPins.map((p) => p.pin);

  if (locations.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="Add a location first"
          description="PINs are issued per location — add one from the Locations tab, then come back here."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className={cx("flex items-start gap-1.5 text-xs text-ink-3 leading-relaxed", "px-3 py-2.5 rounded-lg bg-sunken")}>
        <KeyRound size={13} className="shrink-0 mt-0.5 text-primary-ink" />
        A station PIN belongs to the work, not a person — a station stays the same code no matter who's working the
        shift, so turnover never touches the roster. Leads keep their own PIN for accountability. Manage the station
        list itself from the Stations screen.
      </p>

      {locations.map((loc) => (
        <LocationPinList
          key={loc.id}
          location={loc}
          pins={crewPins.filter((p) => p.locationId === loc.id)}
          allPins={allPins}
          stations={stations}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
