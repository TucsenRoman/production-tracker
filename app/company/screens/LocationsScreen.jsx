"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  MoveRight,
  Pencil,
  Plus,
  Route,
  Store,
  Trash2,
  TriangleAlert,
  UsersRound,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  MetaRow,
  StickyFadeHeader,
  Switch,
  cx,
} from "../../components/ui";
import {
  DAY_LABELS,
  DEFAULT_DAY_HOURS,
  EMPTY_HOURS,
  PROVIDERS,
  ROLE_LABEL,
  newCompanyId,
  openStateAt,
} from "../lib/companyDomain";
import { locationStats } from "../lib/insights";
import { relativeTime } from "../../lib/domain";
import LocationConnections, {
  ConnectDialog,
  connectionFor,
  connectionMetaFor,
} from "../components/LocationConnections";

/* One derivation for the roster this screen quotes, so the list and the
 * detail can never disagree about the same location again: everyone assigned
 * to it, the same roster the Team screen lists, pending invites included. */
const teamAtLocation = (users, locationId) =>
  users.filter((u) => u.locationIds.includes(locationId));

/* Second derivation, same rule: `connectionFor` in LocationConnections.jsx is
 * the only place integration records become "is this location connected", so
 * the row and the detail section can never disagree either. */

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

/**
 * Seven rows, because a week has seven days and a meat counter's Saturday is
 * not its Tuesday. Compact on purpose: this sits inside a form that is mostly
 * three text fields, and it should not become the form.
 */
function HoursField({ value, onChange }) {
  const hours = Array.isArray(value) && value.length === 7 ? value : EMPTY_HOURS;
  const setDay = (index, next) => onChange(hours.map((d, i) => (i === index ? next : d)));

  return (
    <Field
      label="Opening hours" hint="Read in this location's own timezone."
    >
      <div className="space-y-1.5">
        {DAY_LABELS.map((label, index) => {
          const day = hours[index];
          return (
            <div key={label} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-xs font-medium text-ink-2">{label}</span>
              <Switch
                checked={Boolean(day)}
                label={`${label} — ${day ? "open" : "closed"}`}
                onChange={(on) => setDay(index, on ? { ...DEFAULT_DAY_HOURS } : null)}
              />
              {day ? (
                <>
                  <input
                    type="time" aria-label={`${label} opening time`}
                    value={day.open}
                    onChange={(e) => setDay(index, { ...day, open: e.target.value })}
                    className="px-1.5 h-[var(--ctl-h)] bg-surface border border-line-strong rounded-md text-xs text-ink focus:border-primary transition-colors duration-100"
                  />
                  <span className="text-xs text-ink-3">to</span>
                  <input
                    type="time" aria-label={`${label} closing time`}
                    value={day.close}
                    onChange={(e) => setDay(index, { ...day, close: e.target.value })}
                    className="px-1.5 h-[var(--ctl-h)] bg-surface border border-line-strong rounded-md text-xs text-ink focus:border-primary transition-colors duration-100"
                  />
                </>
              ) : (
                <span className="text-xs text-ink-3">Closed</span>
              )}
            </div>
          );
        })}
      </div>
    </Field>
  );
}

const BLANK_LOCATION = {
  name: "",
  address: "",
  photoUrl: "",
  hours: EMPTY_HOURS,
  timezone: "America/Chicago",
};

/* Two groups, because they are answered at two different moments: what the
 * building IS, and when it is open. The dialog shows one at a time; the inline
 * editor on a location's own page shows both. Either way there is one copy of
 * each field. */
function LocationIdentityFields({ form, set }) {
  return (
    <>
      {/* What a location is CALLED and where it IS are two different facts,
       *  and the name is the one people say out loud — nobody at Milaca Meats
       *  calls it "Milaca Meats — Main St", they call it Milaca. The street
       *  address sits right below and says the rest. Naming by town also
       *  survives a second location without a schema change. */}
      <Field label="What people call it" hint="The town or the shorthand — e.g. Milaca, Main Street, the plant.">
        <Input
          autoFocus
          value={form.name}
          placeholder="e.g. Milaca" onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <Field label="Address">
        <Input
          value={form.address}
          placeholder="Street, city, state, ZIP" onChange={(e) => set("address", e.target.value)}
        />
      </Field>
      {/* Optional, and the card has a real fallback when it's blank — this is
       *  a link rather than an upload because there's no file storage in this
       *  build to upload anything to. */}
      <Field label="Photo (optional)" hint="A link to a picture of the building. Leave blank for the house glyph.">
        <Input
          value={form.photoUrl || ""}
          placeholder="https://…" onChange={(e) => set("photoUrl", e.target.value)}
        />
      </Field>
    </>
  );
}

function LocationHoursFields({ form, set }) {
  return (
    <>
      {/* Timezone leads: the hours below are read in it, so asking for them
       *  first and the frame of reference second is backwards. */}
      <Field label="Timezone">
        <Select value={form.timezone} onChange={(v) => set("timezone", v)} options={TIMEZONES} />
      </Field>
      <HoursField value={form.hours} onChange={(v) => set("hours", v)} />
    </>
  );
}

/* The form keeps its box on a location's own page: a card around a thing you
 * FILL IN is the half of the grain that survives — it's the boxes around lists
 * that went away. */
function LocationForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial || BLANK_LOCATION);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim() && form.address.trim();

  return (
    <Card inset className="space-y-4">
      <LocationIdentityFields form={form} set={set} />
      <LocationHoursFields form={form} set={set} />
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

/**
 * Adding a location from the list is a dialog, not an inline card. The list is
 * a grid of locations that exist; a form for one that doesn't yet isn't a peer
 * of theirs, and dropping it in line pushed every real card down the page.
 *
 * It asks in two passes because the two halves are answered at different
 * moments — you know the name and the street the second you decide to add the
 * place; you have to go and check what time it opens on a Saturday. Seven day
 * rows and a timezone stacked under three text fields made one long scroll of
 * a form where most of the length is optional.
 */
function LocationDialog({ onCancel, onSave }) {
  const [form, setForm] = useState(BLANK_LOCATION);
  const [step, setStep] = useState(0);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const named = Boolean(form.name.trim() && form.address.trim());
  const last = step === 1;

  return (
    <Modal
      open
      onClose={onCancel}
      title={step === 0 ? "New location" : form.name.trim() || "New location"}
      icon={Store}
      footer={
        <>
          {/* Where you are, on the left, so the two buttons on the right stay
           *  the two buttons on the right at every step. */}
          <span className="text-xs text-ink-3 tnum mr-auto">Step {step + 1} of 2</span>
          {step === 0 ? (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : (
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(0)}>
              Back
            </Button>
          )}
          {last ? (
            <Button variant="primary" icon={Plus} disabled={!named} onClick={() => onSave(form)}>
              Add location
            </Button>
          ) : (
            <Button
              variant="primary"
              iconRight={ArrowRight}
              disabled={!named}
              onClick={() => setStep(1)}
            >
              Next
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {step === 0 ? (
          <LocationIdentityFields form={form} set={set} />
        ) : (
          <>
            {/* Both halves are optional, and a location with no hours on file
             *  simply shows no status chip — worth saying once, here, rather
             *  than hanging it off the bottom of the day rows. */}
            <p className="text-xs text-ink-1 leading-relaxed">
              Optional. Leave every day shut and {form.name.trim() || "this location"} just won&rsquo;t
              show an open-or-closed status.
            </p>
            <LocationHoursFields form={form} set={set} />
          </>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------- Detail view -- */

function LocationDetail({
  location,
  users,
  integrations,
  canManage,
  onBack,
  onUpdate,
  onRemove,
  onRequestConnect,
  onDisconnect,
  onSync,
  onToggleWebhook,
}) {
  const [editingInfo, setEditingInfo] = useState(false);
  const team = teamAtLocation(users, location.id);
  const timezoneLabel =
    TIMEZONES.find((t) => t.value === location.timezone)?.label || location.timezone;

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
                  <UsersRound size={12} className="shrink-0" /> {team.length} team member
                  {team.length === 1 ? "" : "s"}
                </span>
                <Badge tone="neutral">{timezoneLabel}</Badge>
                <OpenStatus hours={location.hours} timezone={location.timezone} />
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


        {/* Third thing a location HAS, after its people and its tablets: the
         *  till it talks to. This used to be a console screen of its own
         *  rendering a grid of every location again — see
         *  LocationConnections.jsx for why it lives here instead. */}
        <LocationConnections
          location={location}
          integrations={integrations}
          canManage={canManage}
          onRequestConnect={onRequestConnect}
          onDisconnect={onDisconnect}
          onSync={onSync}
          onToggleWebhook={onToggleWebhook}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Card pieces -- */

const initials = (name) =>
  String(name || "")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

/**
 * Open or shut, right now, in the location's OWN timezone — the point of the
 * chip is telling someone three states away whether the door is open, so the
 * admin's clock is the wrong clock to read.
 *
 * Renders nothing when no hours are on file (see `openStateAt`): a chip
 * reading "Closed" because nobody filled the hours in states a fact about the
 * building that isn't in evidence.
 *
 * Mounted-only on purpose. The server renders at one instant and the browser
 * at another, so deriving this during SSR is a hydration mismatch waiting to
 * happen. Rendering nothing until mounted costs one frame and is never wrong.
 */
function OpenStatus({ hours, timezone, bare = false, className }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    const tick = () => setState(openStateAt(hours, timezone));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [hours, timezone]);

  if (!state) return null;

  /* On the cover the hours are one of three plain lines under the name, with
   * no icon column to join and their own colour decided by whether there is a
   * photograph underneath. Everywhere else this is still a row. */
  if (bare) {
    return (
      <p className={className}>
        <span className="font-semibold">{state.open ? "Open" : "Closed"}</span>
        {state.detail && <> · {state.detail}</>}
      </p>
    );
  }

  return (
    /* A row on the card's icon column, not a chip. The 6px dot it used to
     *  carry was a second glyph in a column that already has one. */
    <p className="flex items-start gap-2.5 text-ink-1">
      <Clock size={15} className="text-ink-3 shrink-0 mt-0.5" />
      <span className="min-w-0">
        {/* No colour on either state. The card spends its two-colour budget
         *  on things that are WRONG — a flagged batch, a failed sync — and a
         *  green "Open" competing with those is what made the old card read
         *  as decorated rather than informative. */}
        <span className="font-medium text-ink">{state.open ? "Open" : "Closed"}</span>
        {state.detail && (
          <>
            <span className="px-1.5 text-ink-3">·</span>
            {state.detail}
          </>
        )}
      </span>
    </p>
  );
}

/**
 * A section label inside a card: a muted glyph, an unbolded 12px name, a rule
 * that runs to the right edge, and an optional count parked at its end. Not
 * `SectionHeading` — that one is uppercase, tracked and bolded, which is the
 * treatment a whole PAGE section earns. Inside a 400px card it shouts.
 */
function CardSection({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-[7px] mb-3">
      <Icon size={13} strokeWidth={1.5} aria-hidden="true" className="text-ink-3 shrink-0" />
      <span className="text-xs text-ink-2">{label}</span>
      <span className="flex-1 h-px bg-line" aria-hidden="true" />
      {count != null && <span className="text-xs text-ink-3 tnum shrink-0">{count}</span>}
    </div>
  );
}

/**
 * A person, as a face if we have one and as their initials if we don't. The
 * photo is demo seed data (see COMPANY_SEED.users) — the initials path is the
 * one that has to keep working, because it is what a real account gets.
 */
function Avatar({ user, size = 32, className }) {
  const dim = { width: size, height: size };
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        style={dim}
        className={cx("rounded-full object-cover bg-hover shrink-0", className)}
      />
    );
  }
  return (
    <span
      style={dim}
      className={cx(
        "flex items-center justify-center rounded-full bg-hover text-ink-1 font-medium shrink-0",
        size >= 30 ? "text-xs" : "text-[11px]",
        className
      )}
    >
      {initials(user.name)}
    </span>
  );
}

/* ------------------------------------------------------------------- Root -- */

export default function LocationsScreen({
  locations,
  users,
  integrations,
  production,
  stationTargets,
  onNavigate,
  canManage,
  onAdd,
  onUpdate,
  onRemove,
  onConnect,
  onDisconnect,
  onSync,
  onToggleWebhook,
}) {
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);
  /* Credentials are the one thing here that still breaks out to a modal, so
   * it's tracked at the root rather than inside the detail: which location and
   * which provider we're entering a key for. */
  const [connectFor, setConnectFor] = useState(null); // { locationId, providerId }

  /* Mounted-only clock, for the same reason `OpenStatus` keeps one: "how long
   * since this POS last spoke" is a fact about NOW, and the server renders at
   * one instant and the browser at another. Null until mounted, so the first
   * paint simply doesn't claim anything is stale. */
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const connectLocation = connectFor && locations.find((l) => l.id === connectFor.locationId);
  const connectProvider = connectFor && PROVIDERS.find((p) => p.id === connectFor.providerId);
  const connectExisting = connectLocation
    ? connectionFor(integrations, connectLocation.id).record
    : null;

  const connectDialog =
    connectLocation && connectProvider ? (
      <ConnectDialog
        location={connectLocation}
        provider={connectProvider}
        existing={connectExisting}
        onCancel={() => setConnectFor(null)}
        onConnect={(fields) => {
          onConnect(connectLocation.id, connectProvider.id, fields);
          setConnectFor(null);
        }}
      />
    ) : null;

  /* Everything each location needs, derived once. The toolbar's roll-up and
   * the cards below it read the same objects, so the summary can never quote a
   * number the grid disagrees with — the failure this file has a comment about
   * at the top and now enforces structurally. */
  const rows = locations.map((loc) => {
    const team = teamAtLocation(users, loc.id);
    /* One derivation for the POS, shared with the detail section. */
    const conn = connectionFor(integrations, loc.id);
    const syncFailed = conn.connected && conn.record.lastResult === "error";
    /* Same rollup the Insights screen quotes rather than a second copy of the
     * yield math — `locationStats` is the one derivation, the way
     * `connectionFor` is for the POS. */
    const stats = locationStats(production?.[loc.id] || [], stationTargets);
    /* Who to ask about this building: the floor manager assigned to it,
     * falling back to whoever else is actually working here. An
     * invited-but-never-accepted account is not a contact. */
    const active = team.filter((u) => u.status === "active");
    const contact = active.find((u) => u.role === "manager") || active[0] || null;
    /* Everyone else here, capped at three. They are presence, not a list — the
     * count on the section rule says how many there really are. */
    const others = team.filter((u) => u.id !== contact?.id).slice(0, 3);

    /* The things someone may have to DO something about. One list, so the
     * marker on the cover and the estate-wide count in the toolbar are the
     * same fact counted once. A POS that has not spoken in a week is a
     * problem the card used to state in the same muted grey as a healthy one. */
    const syncAgeDays =
      now && conn.connected && conn.record.lastSynced
        ? Math.floor((now - new Date(conn.record.lastSynced).getTime()) / 86400000)
        : null;
    const issues = [];
    if (stats.flagged > 0) {
      issues.push({
        tone: "danger",
        text: `${stats.flagged} flagged batch${stats.flagged === 1 ? "" : "es"}`,
      });
    }
    if (syncFailed) {
      issues.push({ tone: "danger", text: `${conn.provider.name} sync failed` });
    } else if (syncAgeDays !== null && syncAgeDays >= 7) {
      issues.push({ tone: "warn", text: `${conn.provider.name} sync ${syncAgeDays} days old` });
    }

    return { loc, team, conn, contact, others, issues };
  });

  const totalPeople = new Set(rows.flatMap((r) => r.team.map((u) => u.id))).size;
  const totalConnected = rows.filter((r) => r.conn.connected).length;
  const totalIssues = rows.reduce((a, r) => a + r.issues.length, 0);

  const openLocation = locations.find((l) => l.id === openId);
  if (openLocation) {
    return (
      <>
        <LocationDetail
          location={openLocation}
          users={users}
          integrations={integrations}
          canManage={canManage}
          onBack={() => setOpenId(null)}
          onUpdate={onUpdate}
          onRemove={() => onRemove(openLocation.id)}
          onRequestConnect={(providerId) =>
            setConnectFor({ locationId: openLocation.id, providerId })
          }
          onDisconnect={onDisconnect}
          onSync={onSync}
          onToggleWebhook={onToggleWebhook}
        />
        {connectDialog}
      </>
    );
  }

  return (
    <div>
      {/* The same sticky toolbar Tasks and Team use: what you are looking at
       *  on the left, the one primary action on the right. Search earns its
       *  place the moment a business has more locations than fit a screen —
       *  which is the whole reason this console exists. */}
      <StickyFadeHeader pad={28}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Search would be dead weight at this size — a business does not
           *  have enough locations to lose one. What a toolbar over an estate
           *  can say instead is the shape of it, and whether any of it needs
           *  you today. */}
          <MetaRow className="min-w-0">
            <span className="tnum">
              {locations.length} location{locations.length === 1 ? "" : "s"}
            </span>
            <span className="tnum">
              {totalPeople} {totalPeople === 1 ? "person" : "people"}
            </span>
            <span className="tnum">
              {totalConnected} connected
            </span>
            {totalIssues > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-danger tnum">
                <TriangleAlert size={13} strokeWidth={1.75} className="shrink-0 opacity-70" />
                {totalIssues} need{totalIssues === 1 ? "s" : ""} attention
              </span>
            )}
          </MetaRow>

          {canManage && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add location
              </Button>
            </div>
          )}
        </div>
      </StickyFadeHeader>

      {adding && (
        <LocationDialog
          onCancel={() => setAdding(false)}
          onSave={(form) => {
            onAdd({ id: newCompanyId("LOC"), ...form });
            setAdding(false);
          }}
        />
      )}

      <div className="space-y-5">
        {locations.length === 0 ? (
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
          /* A CARD, in the full sense the rest of this app avoids: rounded,
           *  bordered on four sides, a box around a group. That is a deliberate
           *  exception to the rule `Card` in ui.jsx exists to enforce — two
           *  rules with the page showing through, never a box — and it is worth
           *  saying so here rather than quietly contradicting that component's
           *  own comment.
           *
           *  What earns the exception: a location is not a peer in a list of
           *  like things, it is the subject the whole console hangs off, and
           *  this tile carries five distinct bands (identity, figures, who runs
           *  it, what it's wired to, and the way in) that no row holds at any
           *  width. If a second location ever turns this back into a real list
           *  of peers, this is the first decision to revisit.
           *
           *  The card is NOT itself a button, unlike the row it replaced. It
           *  now contains its own interactive parts, and nesting those inside
           *  one big button is both invalid HTML and unusable from a keyboard.
           *  The full-width action at the foot is the way in. */
          <div className="flex flex-wrap gap-4">
            {rows.map(({ loc, team, conn, contact, others, issues }) => {
              const syncFailed = conn.connected && conn.record.lastResult === "error";

              /* ENTITY-CARD DNA (.claude/skills/entity-card/PROMPT.md).
               *  Anatomy from GitHub's profile sidebar, finish from Notion's
               *  own card surfaces (.claude/skills/notion/CARDS.md): a shape
               *  rather than a box, three type sizes, hierarchy by weight and
               *  ink, and an edge made of a colour change instead of a border.
               *
               *  All the size goes to the cover, none to the title. The name,
               *  the address and the hours ride the photograph; underneath it
               *  the card is two labelled sections and nothing else. Anything
               *  analytic lives on Insights, behind the arrow. */
              return (
                <div
                  key={loc.id}
                  /* The card lifts under the pointer. `--shadow-lift` is the
                   *  one shadow the system lends a resting surface, and only
                   *  with the 2px of travel that earns it — a shadow without
                   *  the movement is just a resting shadow, which is banned. */
                  className={cx(
                    "group relative w-full max-w-[400px] rounded-card bg-sunken overflow-hidden",
                    "transition-[translate,box-shadow] duration-[260ms] ease-[cubic-bezier(0.22,0.7,0.28,1)]",
                    "hover:-translate-y-0.5 hover:shadow-lift",
                    "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  )}
                >
                  {/* Identity. With a photo the type sits on it over a scrim;
                   *  without one the same block sits on a tinted band in ink,
                   *  because a location with no photo is the DEFAULT state —
                   *  `photoUrl` is optional and every new location starts
                   *  without one. */}
                  <div className="relative w-full aspect-[5/2] overflow-hidden">
                    {loc.photoUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={loc.photoUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ objectPosition: "50% 58%" }}
                        />
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-[image:var(--scrim-cover)]"
                        />
                      </>
                    ) : (
                      <div aria-hidden="true" className="absolute inset-0 bg-inset" />
                    )}

                    {/* Everything wrong with this location, counted once. The
                     *  card does not say WHAT — the arrow is the answer. A dark
                     *  plate rather than a filled red pill, so the marker holds
                     *  over a bright photo as well as a dark one. */}
                    {issues.length > 0 && (
                      <span
                        className={cx(
                          "absolute top-3.5 right-3.5 z-10 inline-flex items-center gap-1.5",
                          "h-[26px] px-2.5 rounded-full text-xs font-medium tnum",
                          "bg-[rgba(20,16,14,0.62)] text-white",
                          "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
                        )}
                        title={issues.map((i) => i.text).join(" · ")}
                      >
                        <TriangleAlert
                          size={14}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          className="text-[#ff9c86] shrink-0"
                        />
                        {issues.length}
                      </span>
                    )}

                    {/* The block shrinks to its widest line, so the arrow parked
                     *  at the end of the name's row lands exactly where the
                     *  address terminates — and tracks it as addresses change
                     *  length, rather than sitting on the card's own edge. */}
                    <div className="absolute inset-x-6 bottom-[15px] z-[1]">
                      <div className="inline-block max-w-full">
                        <div className="flex items-center justify-between gap-4">
                          <h3
                            className={cx(
                              "text-base font-semibold leading-snug truncate",
                              loc.photoUrl ? "text-white" : "text-ink"
                            )}
                          >
                            {loc.name}
                          </h3>
                          {/* Slides in from where it points, so the gesture
                           *  and the glyph say the same thing. Always visible
                           *  on touch, where `:hover` never fires and a hidden
                           *  affordance is a missing one. */}
                          <MoveRight
                            size={20}
                            strokeWidth={1.5}
                            aria-hidden="true"
                            className={cx(
                              "shrink-0 opacity-0 -translate-x-1.5",
                              "transition-[opacity,translate] duration-[260ms] ease-[cubic-bezier(0.22,0.7,0.28,1)]",
                              "group-hover:opacity-100 group-hover:translate-x-0",
                              "group-focus-within:opacity-100 group-focus-within:translate-x-0",
                              "[@media(hover:none)]:opacity-100 [@media(hover:none)]:translate-x-0",
                              "motion-reduce:transition-none motion-reduce:translate-x-0",
                              loc.photoUrl ? "text-white/90" : "text-ink-2"
                            )}
                          />
                        </div>
                        <p
                          className={cx(
                            "mt-0.5 text-sm truncate",
                            loc.photoUrl ? "text-white/90" : "text-ink-1"
                          )}
                        >
                          {loc.address}
                        </p>
                        <OpenStatus
                          bare
                          hours={loc.hours}
                          timezone={loc.timezone}
                          className={cx(
                            "mt-0.5 text-sm truncate",
                            loc.photoUrl ? "text-white/90" : "text-ink-1"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="px-6 pt-[18px] pb-[22px] space-y-[26px]">
                    {/* Who to ask. The manager is named because he is the person
                     *  you would actually call; the rest are presence, not a
                     *  list, so they stack and the row stays one line at any
                     *  headcount. */}
                    <section>
                      <CardSection icon={UsersRound} label="Team" count={team.length} />
                      {contact ? (
                        <div className="flex items-center gap-3">
                          <Avatar user={contact} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink truncate">{contact.name}</p>
                            <p className="text-xs text-ink-1 truncate">{ROLE_LABEL[contact.role]}</p>
                          </div>
                          {others.length > 0 && (
                            <div className="flex items-center shrink-0">
                              {others.map((u) => (
                                <Avatar
                                  key={u.id}
                                  user={u}
                                  size={26}
                                  className="-ml-2 first:ml-0 ring-2 ring-sunken"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-ink-1">Nobody assigned here yet.</p>
                      )}
                    </section>

                    {/* What it is wired to. Status only — syncing, disconnecting
                     *  and the credentials live on the location's own page,
                     *  where the history is. The provider's own published mark,
                     *  not a stand-in glyph: a brand mark is content, and does
                     *  not spend the card's two-colour budget. */}
                    <section>
                      <CardSection
                        icon={Route}
                        label="Connections"
                        count={conn.connected ? 1 : 0}
                      />
                      {conn.connected ? (
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-start w-8 h-8 shrink-0">
                            {conn.provider.id === "clover" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src="/clover.svg" alt="" className="w-7 h-7" />
                            ) : (
                              <conn.provider.icon size={20} className="text-icon" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink truncate">
                              {conn.provider.name}
                            </p>
                            <p className="text-xs text-ink-1 truncate">{conn.provider.blurb}</p>
                          </div>
                          <span className="inline-flex items-center h-[22px] px-2.5 rounded-full bg-hover text-xs text-ink-1 tnum shrink-0">
                            {syncFailed
                              ? "Sync failed"
                              : conn.record.lastSynced
                                ? `Synced ${relativeTime(conn.record.lastSynced)}`
                                : "Never synced"}
                          </span>
                        </div>
                      ) : canManage ? (
                        /* Only Clover is connectable in this build (see
                         *  PROVIDERS), and a location holds one connection, so
                         *  this is a single action rather than a picker. */
                        <button
                          onClick={() => setConnectFor({ locationId: loc.id, providerId: "clover" })}
                          className="-mx-2 w-[calc(100%+1rem)] flex items-center gap-3 px-2 py-1 rounded-md text-left transition-colors hover:bg-faint"
                        >
                          <span className="flex items-center justify-start w-8 h-8 shrink-0 text-ink-3">
                            <Plus size={18} strokeWidth={1.5} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink">
                              Connect Clover
                            </span>
                            <span className="block text-xs text-ink-1">No POS connected</span>
                          </span>
                        </button>
                      ) : (
                        <p className="text-sm text-ink-1">No POS connected.</p>
                      )}
                    </section>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
