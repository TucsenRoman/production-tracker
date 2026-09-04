"use client";

import React, { useState } from "react";
import { ArrowLeft, ChevronRight, Dices, Factory, KeyRound, Pencil, Plus, Store, Trash2, Users } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  MetaRow,
  Modal,
  RowActions,
  SectionHeading,
  StickyFadeHeader,
  cx,
} from "../../components/ui";
import { generatePin, isValidPin, newCompanyId, stationPinsFor } from "../lib/companyDomain";

/* One derivation each for the two numbers this screen quotes, so the list and
 * the detail can never disagree about the same location again: everyone
 * assigned to it (the same roster the Team screen lists, pending invites
 * included) and the station device codes issued for it. */
const teamAtLocation = (users, locationId) =>
  users.filter((u) => u.locationIds.includes(locationId));

const deviceCodesAtLocation = (crewPins, locationId) =>
  crewPins.filter((p) => p.locationId === locationId && p.role === "station");

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
        "w-full px-2.5 h-[var(--ctl-h)] bg-surface border border-line-strong rounded-md text-sm text-ink",
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

/* The form keeps its box: a card around a thing you FILL IN is the half of
 * the grain that survives — it's the boxes around lists that went away. */
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
          placeholder="e.g. Milaca Meats — Main St" onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <Field label="Address">
        <Input
          value={form.address}
          placeholder="Street, city, state, ZIP" onChange={(e) => set("address", e.target.value)}
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
          label="Device label (optional)" hint='Only needed if this station runs more than one tablet at once — e.g. "Tablet 2".'
        >
          <Input
            autoFocus
            value={form.label || ""}
            placeholder="Leave blank for a single tablet" onChange={(e) => set("label", e.target.value)}
          />
        </Field>
        <Field label="Code" error={pinTaken ? "That code is already in use — try another." : null}>
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric" maxLength={4}
              value={form.pin}
              onChange={(e) => set("pin", e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="font-mono tracking-[0.3em]"
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

/**
 * One station inside a location's section. This used to be a bordered card
 * band with its own justify-between header, which read as a second toolbar
 * stacked under the page's own. It's nested content now: a quiet station
 * label with its one action, and the codes ruled underneath it, indented
 * one more step so they read as belonging to the station rather than to
 * the location heading above.
 */
function StationDevices({ location, station, crewPins, allPins, canManagePins, onAddPin, onUpdatePin, onRemovePin }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const devices = stationPinsFor(crewPins, location.id, station);

  return (
    /* A station is a row in the Floor stations list now, so the row's own
     * padding comes from the list item and the label line sits flush inside
     * it. The device codes stay indented one step beneath — that nesting is
     * what says they belong to this station rather than to the section. */
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          <Factory size={14} className="text-icon-2 shrink-0" /> {station}
        </span>
        {canManagePins && !adding && (
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding(true)}>
            Add device
          </Button>
        )}
      </div>

      {devices.length === 0 && !adding ? (
        <p className="pl-6 py-1 text-xs text-ink-4">No device code set up yet.</p>
      ) : (
        <ul className="pl-6">
          {devices.map((p) => (
            <li
              key={p.id}
              className="group flex items-center gap-3 py-3 px-1 rounded-md transition-colors hover:bg-faint"
            >
              <span className="font-mono text-xs font-medium text-ink-3 shrink-0">{p.pin}</span>
              <span className="flex-1 min-w-0 truncate text-sm text-ink">{p.label || "Single tablet"}</span>
              {canManagePins && (
                <RowActions>
                  <IconButton label={`Edit device code ${p.pin}`} icon={Pencil} size={13} onClick={() => setEditing(p)} />
                  <IconButton
                    label={`Remove device code ${p.pin}`}
                    icon={Trash2}
                    size={13}
                    onClick={() => onRemovePin(p.id)}
                    className="hover:text-danger"
                  />
                </RowActions>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-2 pl-6">
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
    </li>
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
  const team = teamAtLocation(users, location.id);
  const codeCount = deviceCodesAtLocation(crewPins, location.id).length;
  const timezoneLabel =
    TIMEZONES.find((t) => t.value === location.timezone)?.label || location.timezone;
  const allPins = crewPins.map((p) => p.pin);

  return (
    <div>
      {/* One page-level toolbar: where you came from on the left, what you
       *  can do to this location on the right. The edit and remove controls
       *  used to sit inside a card around the location's own details — but
       *  they act on the whole screen's subject, so they belong up here
       *  rather than on a row. */}
      <StickyFadeHeader pad={28}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
          >
            <ArrowLeft size={15} /> Locations
          </button>

          {canManage && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="secondary" icon={Pencil} onClick={() => setEditingInfo(true)}>
                Edit location
              </Button>
              <IconButton
                label={`Remove ${location.name}`}
                icon={Trash2}
                onClick={onRemove}
                className="shrink-0 hover:text-danger"
              />
            </div>
          )}
        </div>
      </StickyFadeHeader>

      <div className="space-y-5">
        {/* The location's own name is the title of its own page. The shell's
         *  nav title and the back-link above both read "Locations", so
         *  without this nothing said WHICH one you opened. */}
        <div>
          <h2 className="text-xl font-semibold text-ink leading-tight">{location.name}</h2>

          {!editingInfo && (
            <>
              <p className="mt-1 text-sm text-ink-3">{location.address}</p>
              {/* The same two quantities the list row shows, labelled with
               *  the same words — an unlabelled count next to a heading only
               *  ever left the reader guessing which of them it counted. */}
              <MetaRow className="mt-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Users size={12} className="shrink-0" /> {team.length} team member
                  {team.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound size={12} className="shrink-0" /> {codeCount} device code
                  {codeCount === 1 ? "" : "s"}
                </span>
                <Badge tone="neutral">{timezoneLabel}</Badge>
              </MetaRow>
            </>
          )}
        </div>

        {editingInfo && (
          <LocationForm
            initial={location}
            onCancel={() => setEditingInfo(false)}
            onSave={(form) => {
              onUpdate(location.id, form);
              setEditingInfo(false);
            }}
          />
        )}

        <div>
          <SectionHeading icon={Factory} label="Floor stations" count={stations.length} />

          <p className="py-1 px-1 text-xs text-ink-3 leading-relaxed">
            Every station here gets its own device code, separate from any other location — that&rsquo;s what keeps
            two buildings&rsquo; tablets from ever colliding.
          </p>

          {stations.length === 0 ? (
            <div className="border-b border-line">
              <EmptyState
                icon={Factory}
                title="No stations set up yet" description="Add a station from the Stations screen, then come back here to give it a device code."
              />
            </div>
          ) : (
            /* Rule a grouped list; box a flat one. One heading over a flat
             *  list of peers is still a flat list: the heading names the
             *  group, but nothing draws its edges, so the stations were left
             *  floating on open white with only an indent to hold them. The
             *  indent goes and `Card` takes over — border-y only, a rule
             *  above and a rule below with the page showing through, so the
             *  group gets edges without being wrapped in a box. */
            <Card className="mt-1">
              <ul className="divide-y divide-line">
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
              </ul>
            </Card>
          )}
        </div>
      </div>
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
    <div>
      {/* The same sticky toolbar Tasks and Team use: the count on the left,
       *  the one primary action on the right. The grid of location cards it
       *  used to head is a sectioned list now — a card per location was a
       *  box around a group, which is the thing this app doesn't do. */}
      <StickyFadeHeader pad={28}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-ink-3">
            {locations.length} location{locations.length === 1 ? "" : "s"}
          </p>

          {canManage && !adding && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add location
              </Button>
            </div>
          )}
        </div>
      </StickyFadeHeader>

      <div className="space-y-5">
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
          <div className="border-b border-line">
            <EmptyState
              icon={Store}
              title="No locations yet" description="Each location gets its own staff, inventory, and Clover connection." action={
                canManage ? (
                  <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                    Add your first location
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <div>
            {/* One section for the whole list, and the location itself is a
             *  ROW under it: its name is the row's primary text and the
             *  address the metadata beneath. A section per location wrapping
             *  exactly two rows was structure for its own sake, and it left
             *  the name reading as a small grey uppercase label while its own
             *  address read louder than it. */}
            {/* No SectionHeading here. The "always render a heading" rule is
             *  for lists with a real grouping dimension that can narrow to a
             *  single group — this list has none: every row is a peer. A
             *  heading reading "LOCATIONS 2" directly under a page titled
             *  "Locations" beside a toolbar reading "2 locations" states the
             *  same fact three times. Same call as StationsScreen. */}
            {/* No heading, but the rows still need edges: `Card` is two
             *  rules with the page between them, not a box around a group. */}
            <Card>
              <ul className="divide-y divide-line">
                {locations.map((loc) => {
                  const teamCount = teamAtLocation(users, loc.id).length;
                  const codeCount = deviceCodesAtLocation(crewPins, loc.id).length;
                  const timezoneLabel =
                    TIMEZONES.find((t) => t.value === loc.timezone)?.label || loc.timezone;

                  if (editing === loc.id) {
                    return (
                      <li key={loc.id} className="px-4 py-3">
                        <LocationForm
                          initial={loc}
                          onCancel={() => setEditing(null)}
                          onSave={(form) => {
                            onUpdate(loc.id, form);
                            setEditing(null);
                          }}
                        />
                      </li>
                    );
                  }

                  return (
                    /* The whole row opens the location — same contract as a task
                     *  row on the floor list, keyboard included — instead of a
                     *  faint "2 codes →" parked a thousand pixels away being the
                     *  only way in. The row's own controls stop their click from
                     *  drilling in behind them. */
                    <li
                      key={loc.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${loc.name}`}
                      onClick={() => setOpenId(loc.id)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        setOpenId(loc.id);
                      }}
                      className="group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-faint"
                    >
                      <Store size={14} className="text-icon-2 shrink-0" />

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{loc.name}</p>
                        <p className="text-xs text-ink-3 truncate">{loc.address}</p>
                        <MetaRow className="mt-0.5">
                          <span className="inline-flex items-center gap-1.5">
                            <Users size={12} className="shrink-0" /> {teamCount} team member
                            {teamCount === 1 ? "" : "s"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <KeyRound size={12} className="shrink-0" /> {codeCount} device code
                            {codeCount === 1 ? "" : "s"}
                          </span>
                        </MetaRow>
                      </div>

                      <Badge tone="neutral" className="shrink-0">
                        {timezoneLabel}
                      </Badge>

                      {canManage && (
                        /* Console screen: hover/focus reveal is right here, at a
                         *  desk — no `always`, that's the floor terminal's job. */
                        <RowActions>
                          <IconButton
                            label={`Edit ${loc.name}`}
                            icon={Pencil}
                            size={14}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(loc.id);
                            }}
                          />
                          <IconButton
                            label={`Remove ${loc.name}`}
                            icon={Trash2}
                            size={14}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemove(loc.id);
                            }}
                            className="hover:text-danger"
                          />
                        </RowActions>
                      )}

                      <ChevronRight size={16} aria-hidden="true" className="text-icon-2 shrink-0" />
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
